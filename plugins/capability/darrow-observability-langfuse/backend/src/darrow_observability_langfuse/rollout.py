from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .config import (
    Config,
    git_provenance,
    infer_work_item_id_from_branch,
    validate_work_item_id,
)


_SENSITIVE_KEY = re.compile(
    r"(?:authorization|api[-_]?key|secret|password|token|credential)", re.I
)
_TOOL_CALL = re.compile(r"\btools\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(")
_COMMAND_ARGUMENT = re.compile(
    r'''(?:"(?:cmd|command)"|'(?:cmd|command)'|\b(?:cmd|command)\b)\s*:\s*'''
    r'''(?P<value>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)''',
    re.S,
)
_TOOL_NAME_MAX_CHARS = 512
_ATTRIBUTION_DIRECTIVE = "@darrow.attribution"


def _clip(value: Any, limit: int, redactions: tuple[str, ...] = ()) -> Any:
    if isinstance(value, str):
        for secret in redactions:
            if secret:
                value = value.replace(secret, "[REDACTED]")
        if len(value) <= limit:
            return value
        return f"{value[:limit]}\n…[truncated {len(value) - limit} chars]"
    if isinstance(value, list):
        return [_clip(item, limit, redactions) for item in value]
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]"
            if _SENSITIVE_KEY.search(str(key))
            else _clip(item, limit, redactions)
            for key, item in value.items()
        }
    return value


def _captured(value: Any, config: Config) -> Any:
    return _clip(
        value,
        config.max_chars,
        tuple(item for item in (config.public_key, config.secret_key) if item),
    )


def _contains_credential(value: str | None, config: Config) -> bool:
    return bool(
        value
        and any(
            credential and credential in value
            for credential in (config.public_key, config.secret_key)
        )
    )


def _redacted_metadata_string(value: str | None, config: Config) -> str | None:
    if value is None:
        return None
    for credential in (config.public_key, config.secret_key):
        if credential:
            value = value.replace(credential, "[REDACTED]")
    return value


def _message_text(content: Any) -> str | None:
    if not isinstance(content, list):
        return None
    parts = []
    for part in content:
        if not isinstance(part, dict) or part.get("type") not in {
            "input_text",
            "output_text",
            "text",
        }:
            continue
        if isinstance(part.get("text"), str) and part["text"]:
            parts.append(part["text"])
    return "\n".join(parts) or None


def _reasoning_text(payload: dict[str, Any]) -> str | None:
    content = payload.get("content")
    if isinstance(content, str):
        return content or None
    candidates = content if isinstance(content, list) else payload.get("summary")
    if not isinstance(candidates, list):
        return None
    parts = []
    for item in candidates:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            parts.append(item["text"])
        elif isinstance(item, str):
            parts.append(item)
    return "\n".join(parts) or None


def _parse_arguments(raw: Any) -> Any:
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _single_line(value: str) -> str:
    return re.sub(r"[\r\n\t]+", " ", value).strip()


def _compact_source(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _decode_js_string(value: str) -> str:
    if value.startswith('"'):
        try:
            decoded = json.loads(value)
            if isinstance(decoded, str):
                return decoded
        except json.JSONDecodeError:
            pass
    quote = value[0]
    body = value[1:-1]
    escapes = {
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "b": "\b",
        "f": "\f",
        "v": "\v",
        quote: quote,
        "\\": "\\",
    }
    decoded = []
    index = 0
    while index < len(body):
        char = body[index]
        if char != "\\" or index + 1 >= len(body):
            decoded.append(char)
            index += 1
            continue
        next_char = body[index + 1]
        decoded.append(escapes.get(next_char, next_char))
        index += 2
    return "".join(decoded)


def _call_arguments(source: str, start: int) -> str | None:
    depth = 1
    quote: str | None = None
    escaped = False
    for index in range(start, len(source)):
        char = source[index]
        if quote is not None:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in {'"', "'", "`"}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return source[start:index]
    return None


def _short_tool_name(name: str) -> str:
    return name.rsplit("__", 1)[-1]


def _command_from_arguments(arguments: Any) -> str | None:
    if isinstance(arguments, dict):
        for key in ("cmd", "command"):
            value = arguments.get(key)
            if isinstance(value, str) and value:
                return _single_line(value)
        return None
    if not isinstance(arguments, str):
        return None
    match = _COMMAND_ARGUMENT.search(arguments)
    if match is None:
        return None
    return _single_line(_decode_js_string(match.group("value")))


def _invocation_label(name: str, arguments: Any) -> str:
    short_name = _short_tool_name(name)
    if short_name in {"exec_command", "ctx_shell"}:
        command = _command_from_arguments(arguments)
        if command:
            return command
    if arguments is None:
        return short_name
    if isinstance(arguments, str):
        serialized = _compact_source(arguments)
    else:
        serialized = json.dumps(
            arguments,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    return f"{short_name} {serialized}" if serialized else short_name


def _nested_invocation_labels(source: str) -> list[str]:
    labels = []
    for match in _TOOL_CALL.finditer(source):
        arguments = _call_arguments(source, match.end())
        if arguments is not None:
            labels.append(_invocation_label(match.group(1), arguments))
    return labels


def _tool_observation_name(tool: dict[str, Any], config: Config) -> str:
    name = str(tool.get("name") or "tool")
    if not config.capture_content:
        return name
    captured_input = _captured(tool.get("input"), config)
    labels = (
        _nested_invocation_labels(captured_input)
        if name == "exec" and isinstance(captured_input, str)
        else []
    )
    value = "; ".join(labels) if labels else _invocation_label(name, captured_input)
    value = _single_line(value)
    if len(value) <= _TOOL_NAME_MAX_CHARS:
        return value
    return f"{value[: _TOOL_NAME_MAX_CHARS - 1]}…"


def _attribution_directive(value: Any) -> tuple[str, str | None] | None:
    if not isinstance(value, str):
        return None
    line = next((line.strip() for line in value.splitlines() if line.strip()), "")
    if not line.startswith(_ATTRIBUTION_DIRECTIVE):
        return None
    parts = line.split()
    if parts == [_ATTRIBUTION_DIRECTIVE, "clear"]:
        return "clear", None
    if parts == [_ATTRIBUTION_DIRECTIVE, "auto"]:
        return "auto", None
    if len(parts) == 3 and parts[:2] == [_ATTRIBUTION_DIRECTIVE, "set"]:
        work_item_id = validate_work_item_id(parts[2])
        if work_item_id is not None:
            return "set", work_item_id
    raise ValueError("invalid @darrow.attribution directive")


def attribution_snapshot(config: Config, cwd: str) -> dict[str, Any]:
    raw_branch, raw_head = git_provenance(cwd)
    if config.work_item_id:
        work_item_id = config.work_item_id
        source = "configuration"
    else:
        work_item_id = infer_work_item_id_from_branch(raw_branch)
        source = "git_branch" if work_item_id else "none"
    if _contains_credential(work_item_id, config):
        work_item_id = None
        source = "none"
    return {
        "work_item_id": work_item_id,
        "source": source,
        "branch": _redacted_metadata_string(raw_branch, config),
        "head": (
            None
            if _contains_credential(raw_head, config)
            else _redacted_metadata_string(raw_head, config)
        ),
    }


def _valid_usage(value: Any) -> dict[str, int] | None:
    if not isinstance(value, dict):
        return None
    required = ("input_tokens", "output_tokens", "total_tokens")
    if any(not isinstance(value.get(key), int) or value[key] < 0 for key in required):
        return None
    if value["total_tokens"] != value["input_tokens"] + value["output_tokens"]:
        return None
    details = {
        "input_tokens": value["input_tokens"],
        "output_tokens": value["output_tokens"],
        "total_tokens": value["total_tokens"],
    }
    cached = value.get("cached_input_tokens")
    reasoning = value.get("reasoning_output_tokens")
    if isinstance(cached, int) and 0 <= cached <= value["input_tokens"]:
        details["cached_input_tokens"] = cached
    if isinstance(reasoning, int) and 0 <= reasoning <= value["output_tokens"]:
        details["reasoning_output_tokens"] = reasoning
    return details


def load_rollout(path: Path) -> list[dict[str, Any]]:
    if not path.is_absolute() or not path.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    records = []
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and isinstance(value.get("payload"), dict):
                records.append(value)
    except OSError as error:
        raise ValueError("transcript_path is not readable") from error
    return records


def parse_rollout(records: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    session = {"session_id": None, "is_subagent": False}
    turns: list[dict[str, Any]] = []
    turn: dict[str, Any] | None = None
    step: dict[str, Any] | None = None
    tools: dict[str, dict[str, Any]] = {}

    def ensure_turn(timestamp: str) -> dict[str, Any]:
        nonlocal turn
        if turn is None:
            turn = {
                "start_time": timestamp,
                "end_time": timestamp,
                "steps": [],
                "subagent_thread_ids": [],
                "completed": False,
                "aborted": False,
            }
        return turn

    def ensure_step(timestamp: str) -> dict[str, Any]:
        nonlocal step
        current = ensure_turn(timestamp)
        if step is None:
            step = {"start_time": timestamp, "end_time": timestamp, "tools": []}
        current["end_time"] = timestamp
        return step

    def close_step(timestamp: str, usage: Any = None) -> None:
        nonlocal step
        if step is None:
            return
        step["end_time"] = timestamp
        normalized = _valid_usage(usage)
        if normalized:
            step["usage"] = normalized
        assert turn is not None
        turn["steps"].append(step)
        step = None

    def close_turn(timestamp: str, *, completed: bool, aborted: bool) -> None:
        nonlocal turn, tools
        if turn is None:
            return
        close_step(timestamp)
        turn["end_time"] = timestamp
        turn["completed"] = completed
        turn["aborted"] = aborted
        if "output" not in turn and "last_agent_message" in turn:
            turn["output"] = turn.pop("last_agent_message")
        else:
            turn.pop("last_agent_message", None)
        turns.append(turn)
        turn = None
        tools = {}

    for record in records:
        timestamp = str(record.get("timestamp") or "")
        kind = record.get("type")
        payload = record["payload"]
        if kind == "session_meta":
            if isinstance(payload.get("id"), str) and payload["id"].strip():
                session["session_id"] = payload["id"]
            session["cli_version"] = payload.get("cli_version")
            session["model_provider"] = payload.get("model_provider")
            session["is_subagent"] = bool(
                payload.get("parent_thread_id") or payload.get("thread_source") == "subagent"
            )
            continue
        if kind == "turn_context":
            current = ensure_turn(timestamp)
            current["model"] = payload.get("model")
            current["invocation_parameters"] = payload
            continue
        if kind == "response_item":
            current = ensure_turn(timestamp)
            response_type = payload.get("type")
            if response_type == "message":
                text = _message_text(payload.get("content"))
                if text and payload.get("role") == "assistant":
                    current_step = ensure_step(timestamp)
                    current_step["output"] = "\n".join(
                        filter(None, (current_step.get("output"), text))
                    )
                elif text and payload.get("role") == "user" and "input" not in current:
                    current["input"] = text
            elif response_type in {"function_call", "custom_tool_call"}:
                call_id = str(payload.get("call_id") or f"call-{len(tools) + 1}")
                tool = {
                    "call_id": call_id,
                    "name": str(payload.get("name") or "tool"),
                    "input": _parse_arguments(payload.get("arguments", payload.get("input"))),
                    "start_time": timestamp,
                    "end_time": timestamp,
                }
                ensure_step(timestamp)["tools"].append(tool)
                tools[call_id] = tool
            elif response_type in {"function_call_output", "custom_tool_call_output"}:
                tool = tools.get(str(payload.get("call_id")))
                if tool is not None:
                    tool["output"] = payload.get("output")
                    tool["end_time"] = timestamp
            elif response_type == "reasoning":
                text = _reasoning_text(payload)
                if text:
                    ensure_step(timestamp)["reasoning"] = text
            continue
        if kind != "event_msg":
            continue

        event_type = payload.get("type")
        if event_type == "task_started":
            close_turn(timestamp, completed=False, aborted=False)
            current = ensure_turn(timestamp)
            current["turn_id"] = payload.get("turn_id")
            continue
        current = ensure_turn(timestamp)
        if event_type == "user_message" and isinstance(payload.get("message"), str):
            current.setdefault("input", payload["message"])
        elif event_type == "agent_message" and isinstance(payload.get("message"), str):
            current["last_agent_message"] = payload["message"]
        elif event_type == "token_count":
            info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
            total = _valid_usage(info.get("total_token_usage"))
            if total:
                current["total_usage"] = total
            close_step(timestamp, info.get("last_token_usage"))
        elif event_type in {"collab_agent_spawn_end", "sub_agent_activity"}:
            thread_id = payload.get("new_thread_id") or (
                payload.get("agent_thread_id") if payload.get("kind") == "started" else None
            )
            if isinstance(thread_id, str) and thread_id not in current["subagent_thread_ids"]:
                current["subagent_thread_ids"].append(thread_id)
        elif isinstance(payload.get("call_id"), str) and event_type.endswith("_end"):
            tool = tools.get(payload["call_id"])
            if tool is not None:
                tool["end_time"] = timestamp
                if payload.get("status") in {"failed", "declined"}:
                    tool["error"] = str(
                        payload.get("error")
                        or payload.get("aggregated_output")
                        or payload.get("stderr")
                        or "tool failed"
                    )
                if "output" not in tool and payload.get("aggregated_output") is not None:
                    tool["output"] = payload["aggregated_output"]
        if event_type == "task_complete":
            close_turn(timestamp, completed=True, aborted=False)
        elif event_type == "turn_aborted":
            close_turn(timestamp, completed=True, aborted=True)

    close_turn(str(records[-1].get("timestamp") if records else ""), completed=False, aborted=False)
    return session, turns


def _metadata(
    turn: dict[str, Any],
    session: dict[str, Any],
    attribution: dict[str, Any],
    config: Config,
) -> dict[str, Any]:
    value = {
        "codex.turn_id": turn.get("turn_id"),
        "codex.thread_id": session["session_id"],
        "codex.model": turn.get("model"),
        "codex.model_provider": session.get("model_provider"),
        "codex.cli_version": session.get("cli_version"),
        "codex.aborted": turn.get("aborted", False),
        "codex.completed": turn.get("completed", False),
        "darrow.attribution_source": attribution["source"],
    }
    if attribution.get("epoch") is not None:
        value["darrow.attribution_epoch"] = attribution["epoch"]
    work_item_id = attribution.get("work_item_id")
    if work_item_id:
        value["darrow.work_item_id"] = work_item_id
    if attribution.get("branch"):
        value["git.branch"] = attribution["branch"]
    if attribution.get("head"):
        value["git.head"] = attribution["head"]
    return {
        key: _redacted_metadata_string(item, config)
        if isinstance(item, str)
        else item
        for key, item in value.items()
    }


def _find_subagent_rollout(parent: Path, thread_id: str) -> Path | None:
    suffix = f"-{thread_id}.jsonl"
    try:
        for candidate in parent.parent.rglob(f"*{suffix}"):
            if candidate.is_file() and candidate.resolve() != parent.resolve():
                return candidate.resolve()
    except OSError:
        return None
    return None


def _turn_observations(
    path: Path,
    turn: dict[str, Any],
    session: dict[str, Any],
    config: Config,
    attribution: dict[str, Any],
    visited: set[Path],
) -> list[dict[str, Any]]:
    observations = []
    for step in turn["steps"]:
        generation: dict[str, Any] = {
            "type": "generation",
            "name": "LLM Subagent" if session["is_subagent"] else "LLM",
            "model": turn.get("model"),
            "start_time": step["start_time"],
            "end_time": step["end_time"],
            "usage_details": step.get("usage"),
            "children": [],
        }
        if config.capture_content:
            generation["output"] = _captured(
                {"content": step.get("output"), "reasoning": step.get("reasoning")},
                config,
            )
        for tool in step["tools"]:
            error = tool.get("error")
            child = {
                "type": "tool",
                "name": _tool_observation_name(tool, config),
                "start_time": tool["start_time"],
                "end_time": tool["end_time"],
                "error": (
                    _captured(error, config)
                    if error and config.capture_content
                    else "tool failed" if error else None
                ),
            }
            if config.capture_content:
                child["input"] = _captured(tool.get("input"), config)
                child["output"] = _captured(tool.get("output"), config)
            generation["children"].append(child)
        observations.append(generation)

    for thread_id in turn["subagent_thread_ids"]:
        child_path = _find_subagent_rollout(path, thread_id)
        if child_path is None or child_path in visited:
            continue
        visited.add(child_path)
        child_session, child_turns = parse_rollout(load_rollout(child_path))
        if child_session.get("session_id") != thread_id:
            raise ValueError(
                "subagent rollout thread ID does not match the spawned thread"
            )
        for child_turn in child_turns:
            child_observation: dict[str, Any] = {
                "type": "agent",
                "name": "Codex Subagent Turn",
                "session_id": _redacted_metadata_string(
                    child_session["session_id"], config
                ),
                "start_time": child_turn["start_time"],
                "end_time": child_turn["end_time"],
                "metadata": _metadata(
                    child_turn, child_session, attribution, config
                ),
                "children": _turn_observations(
                    child_path,
                    child_turn,
                    child_session,
                    config,
                    attribution,
                    visited,
                ),
            }
            if config.capture_content:
                child_observation["input"] = _captured(child_turn.get("input"), config)
                child_observation["output"] = _captured(child_turn.get("output"), config)
            observations.append(child_observation)
    return observations


def trace_document(
    path: Path,
    config: Config,
    cwd: str,
    *,
    attribution_snapshots: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not path.is_absolute():
        raise ValueError("transcript_path must name a readable absolute file")
    path = path.resolve()
    session, turns = parse_rollout(load_rollout(path))
    if not isinstance(session.get("session_id"), str):
        raise ValueError("rollout is missing a valid Codex thread ID")
    thread_id = _redacted_metadata_string(session["session_id"], config)
    assert thread_id is not None
    traces = []
    visited = {path}
    automatic = (
        attribution_snapshot(config, cwd)
        if attribution_snapshots is None
        else None
    )
    mode = "auto"
    explicit_work_item_id: str | None = None
    epoch = 0
    previous_key: tuple[str, str | None] | None = None
    for turn in turns:
        directive = _attribution_directive(turn.get("input"))
        if directive is not None:
            mode, explicit_work_item_id = directive
            epoch += 1
        turn_id = turn.get("turn_id")
        missing_snapshot = False
        if attribution_snapshots is None:
            assert automatic is not None
            fallback = automatic
        elif isinstance(turn_id, str) and turn_id in attribution_snapshots:
            fallback = attribution_snapshots[turn_id]
        else:
            missing_snapshot = True
            fallback = {
                "work_item_id": None,
                "source": "none",
                "branch": None,
                "head": None,
            }
        if mode == "set":
            attribution = {
                "work_item_id": (
                    None
                    if _contains_credential(explicit_work_item_id, config)
                    else explicit_work_item_id
                ),
                "source": "explicit",
            }
        elif mode == "clear":
            attribution = {"work_item_id": None, "source": "explicit"}
        else:
            attribution = {
                "work_item_id": fallback.get("work_item_id"),
                "source": fallback["source"],
            }
        attribution["branch"] = fallback.get("branch")
        attribution["head"] = fallback.get("head")
        if mode == "auto" and missing_snapshot:
            attribution["epoch"] = None
        else:
            effective_key = (attribution["source"], attribution.get("work_item_id"))
            if (
                directive is None
                and previous_key is not None
                and effective_key != previous_key
            ):
                epoch += 1
            attribution["epoch"] = f"{thread_id}:attribution:{epoch}"
            previous_key = effective_key
        trace: dict[str, Any] = {
            "name": "Codex Subagent Turn" if session["is_subagent"] else "Codex Turn",
            "session_id": attribution["epoch"],
            "start_time": turn["start_time"],
            "end_time": turn["end_time"],
            "metadata": _metadata(turn, session, attribution, config),
            "observations": _turn_observations(
                path, turn, session, config, attribution, visited
            ),
        }
        if config.capture_content:
            trace["input"] = _captured(turn.get("input"), config)
            trace["output"] = _captured(turn.get("output"), config)
        traces.append(trace)
    return {"status": "dry-run", "traces": traces}
