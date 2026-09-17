from __future__ import annotations

import copy
import json
import re
from collections.abc import Callable
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
    r"""(?:"(?:cmd|command)"|'(?:cmd|command)'|\b(?:cmd|command)\b)\s*:\s*"""
    r"""(?P<value>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)""",
    re.S,
)
_TOOL_NAME_MAX_CHARS = 512
_ATTRIBUTION_DIRECTIVE = "@darrow.attribution"


def _clip(value: Any, limit: int, redactions: tuple[str, ...] = ()) -> Any:
    if isinstance(value, str):
        return _clip_string(value, limit, redactions)
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


def _clip_string(value: str, limit: int, redactions: tuple[str, ...]) -> str:
    for secret in filter(None, redactions):
        value = value.replace(secret, "[REDACTED]")
    if len(value) <= limit:
        return value
    return f"{value[:limit]}\n…[truncated {len(value) - limit} chars]"


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
    return "\n".join(filter(None, map(_reasoning_part, candidates))) or None


def _reasoning_part(item: Any) -> str | None:
    if isinstance(item, str):
        return item
    if isinstance(item, dict) and isinstance(item.get("text"), str):
        return str(item["text"])
    return None


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
        decoded = _decode_json_string(value)
        if decoded is not None:
            return decoded
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
    return _decode_escaped_body(body, escapes)


def _decode_json_string(value: str) -> str | None:
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return None
    return decoded if isinstance(decoded, str) else None


def _decode_escaped_body(body: str, escapes: dict[str, str]) -> str:
    decoded: list[str] = []
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
    for index in range(start, len(source)):
        depth, quote = _advance_call_state(source, index, depth, quote)
        if depth == 0:
            return source[start:index]
    return None


def _advance_call_state(
    source: str, index: int, depth: int, quote: str | None
) -> tuple[int, str | None]:
    char = source[index]
    if quote is not None:
        return depth, _quote_after_character(source, index, quote)
    if char in {'"', "'", "`"}:
        return depth, char
    if char == "(":
        return depth + 1, quote
    return (depth - 1, quote) if char == ")" else (depth, quote)


def _quote_after_character(source: str, index: int, quote: str) -> str | None:
    if source[index] != quote:
        return quote
    escapes = 0
    cursor = index - 1
    while cursor >= 0 and source[cursor] == "\\":
        escapes += 1
        cursor -= 1
    return quote if escapes % 2 else None


def _short_tool_name(name: str) -> str:
    return name.rsplit("__", 1)[-1]


def _command_from_arguments(arguments: Any) -> str | None:
    if isinstance(arguments, dict):
        return next(
            (
                _single_line(value)
                for key in ("cmd", "command")
                if isinstance((value := arguments.get(key)), str) and value
            ),
            None,
        )
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
    return _parse_attribution_directive(line.split())


def _parse_attribution_directive(parts: list[str]) -> tuple[str, str | None]:
    if parts in (
        [_ATTRIBUTION_DIRECTIVE, "clear"],
        [_ATTRIBUTION_DIRECTIVE, "auto"],
    ):
        return parts[1], None
    if len(parts) == 3 and parts[:2] == [_ATTRIBUTION_DIRECTIVE, "set"]:
        work_item_id = validate_work_item_id(parts[2])
        if work_item_id is not None:
            return "set", work_item_id
    raise ValueError("invalid @darrow.attribution directive")


def attribution_snapshot(config: Config, cwd: str) -> dict[str, Any]:
    raw_branch, raw_head = git_provenance(cwd)
    work_item_id: str | None
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
    _optional_usage(details, value, "cached_input_tokens", "input_tokens")
    _optional_usage(details, value, "reasoning_output_tokens", "output_tokens")
    return details


def _optional_usage(
    details: dict[str, int], value: dict[str, Any], key: str, limit_key: str
) -> None:
    candidate = value.get(key)
    if isinstance(candidate, int) and 0 <= candidate <= value[limit_key]:
        details[key] = candidate


def load_rollout(path: Path) -> list[dict[str, Any]]:
    if not path.is_absolute() or not path.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise ValueError("transcript_path is not readable") from error
    return [record for raw in lines if (record := _parse_record(raw)) is not None]


def _parse_record(raw: str) -> dict[str, Any] | None:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if isinstance(value, dict) and isinstance(value.get("payload"), dict):
        return value
    return None


def parse_rollout(
    records: list[dict[str, Any]],
    *,
    state: dict[str, Any] | None = None,
    finalize: bool = True,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    parser = _RolloutParser(state)
    for record in records:
        parser.consume(record)
    parser.persist(state)
    if finalize:
        parser = parser.preview() if state is not None else parser
        parser.close_turn(
            parser.final_timestamp(records), completed=False, aborted=False
        )
    return parser.session, parser.turns


class _RolloutParser:
    def __init__(self, state: dict[str, Any] | None) -> None:
        saved = state or {}
        self.session: dict[str, Any] = saved.get(
            "session", {"session_id": None, "is_subagent": False}
        )
        self.turn: dict[str, Any] | None = saved.get("turn")
        self.step: dict[str, Any] | None = saved.get("step")
        self.turns: list[dict[str, Any]] = []
        active_steps = (self.turn or {}).get("steps", [])
        self.tools = {
            tool["call_id"]: tool
            for item in active_steps + ([self.step] if self.step else [])
            for tool in item["tools"]
        }

    def preview(self) -> _RolloutParser:
        duplicate = copy.copy(self)
        duplicate.turn, duplicate.step = copy.deepcopy((self.turn, self.step))
        return duplicate

    def persist(self, state: dict[str, Any] | None) -> None:
        if state is not None:
            state.update(session=self.session, turn=self.turn, step=self.step)

    def final_timestamp(self, records: list[dict[str, Any]]) -> str:
        source = records[-1] if records else self.turn or {}
        return str(source.get("timestamp") or source.get("end_time") or "")

    def ensure_turn(self, timestamp: str) -> dict[str, Any]:
        if self.turn is None:
            self.turn = {
                "start_time": timestamp,
                "end_time": timestamp,
                "steps": [],
                "subagent_thread_ids": [],
                "completed": False,
                "aborted": False,
            }
        return self.turn

    def ensure_step(self, timestamp: str) -> dict[str, Any]:
        current = self.ensure_turn(timestamp)
        if self.step is None:
            self.step = {"start_time": timestamp, "end_time": timestamp, "tools": []}
        current["end_time"] = timestamp
        return self.step

    def close_step(self, timestamp: str, usage: Any = None) -> None:
        if self.step is None:
            return
        self.step["end_time"] = timestamp
        normalized = _valid_usage(usage)
        if normalized:
            self.step["usage"] = normalized
        assert self.turn is not None
        self.turn["steps"].append(self.step)
        self.step = None

    def close_turn(self, timestamp: str, *, completed: bool, aborted: bool) -> None:
        if self.turn is None:
            return
        self.close_step(timestamp)
        self.turn.update(end_time=timestamp, completed=completed, aborted=aborted)
        self._promote_last_message()
        self.turns.append(self.turn)
        self.turn = None
        self.tools = {}

    def _promote_last_message(self) -> None:
        assert self.turn is not None
        last_message = self.turn.pop("last_agent_message", None)
        if "output" not in self.turn and last_message is not None:
            self.turn["output"] = last_message

    def consume(self, record: dict[str, Any]) -> None:
        timestamp = str(record.get("timestamp") or "")
        kind = record.get("type")
        payload = record["payload"]
        handlers = {
            "session_meta": self._session_meta,
            "turn_context": self._turn_context,
            "response_item": self._response_item,
            "event_msg": self._event,
        }
        handler = handlers.get(kind) if isinstance(kind, str) else None
        if handler is not None:
            handler(timestamp, payload)

    def _session_meta(self, _timestamp: str, payload: dict[str, Any]) -> None:
        identifier = payload.get("id")
        if isinstance(identifier, str) and identifier.strip():
            self.session["session_id"] = identifier
        self.session["cli_version"] = payload.get("cli_version")
        self.session["model_provider"] = payload.get("model_provider")
        self.session["is_subagent"] = bool(
            payload.get("parent_thread_id")
            or payload.get("thread_source") == "subagent"
        )

    def _turn_context(self, timestamp: str, payload: dict[str, Any]) -> None:
        current = self.ensure_turn(timestamp)
        current["model"] = payload.get("model")
        current["invocation_parameters"] = payload

    def _response_item(self, timestamp: str, payload: dict[str, Any]) -> None:
        response_type = payload.get("type")
        handlers = {
            "message": self._response_message,
            "function_call": self._response_call,
            "custom_tool_call": self._response_call,
            "function_call_output": self._response_output,
            "custom_tool_call_output": self._response_output,
            "reasoning": self._response_reasoning,
        }
        self.ensure_turn(timestamp)
        handler = (
            handlers.get(response_type) if isinstance(response_type, str) else None
        )
        if handler is not None:
            handler(timestamp, payload)

    def _response_message(self, timestamp: str, payload: dict[str, Any]) -> None:
        text = _message_text(payload.get("content"))
        role = payload.get("role")
        if text and role == "assistant":
            step = self.ensure_step(timestamp)
            step["output"] = "\n".join(filter(None, (step.get("output"), text)))
        elif text and role == "user" and self.turn is not None:
            self.turn.setdefault("input", text)

    def _response_call(self, timestamp: str, payload: dict[str, Any]) -> None:
        call_id = str(payload.get("call_id") or f"call-{len(self.tools) + 1}")
        tool = {
            "call_id": call_id,
            "name": str(payload.get("name") or "tool"),
            "input": _parse_arguments(payload.get("arguments", payload.get("input"))),
            "start_time": timestamp,
            "end_time": timestamp,
        }
        self.ensure_step(timestamp)["tools"].append(tool)
        self.tools[call_id] = tool

    def _response_output(self, timestamp: str, payload: dict[str, Any]) -> None:
        tool = self.tools.get(str(payload.get("call_id")))
        if tool is not None:
            tool.update(output=payload.get("output"), end_time=timestamp)

    def _response_reasoning(self, timestamp: str, payload: dict[str, Any]) -> None:
        text = _reasoning_text(payload)
        if text:
            self.ensure_step(timestamp)["reasoning"] = text

    def _event(self, timestamp: str, payload: dict[str, Any]) -> None:
        event_type = str(payload.get("type") or "")
        if event_type == "task_started":
            self.close_turn(timestamp, completed=False, aborted=False)
            self.ensure_turn(timestamp)["turn_id"] = payload.get("turn_id")
            return
        handlers = {
            "user_message": self._event_user_message,
            "agent_message": self._event_agent_message,
            "token_count": self._event_token_count,
            "collab_agent_spawn_end": self._event_subagent,
            "sub_agent_activity": self._event_subagent,
        }
        self.ensure_turn(timestamp)
        handler = handlers.get(event_type, self._event_tool_end)
        handler(timestamp, payload)
        self._finish_event(timestamp, event_type)

    def _event_user_message(self, _timestamp: str, payload: dict[str, Any]) -> None:
        message = payload.get("message")
        if isinstance(message, str) and self.turn is not None:
            self.turn.setdefault("input", message)

    def _event_agent_message(self, _timestamp: str, payload: dict[str, Any]) -> None:
        message = payload.get("message")
        if isinstance(message, str) and self.turn is not None:
            self.turn["last_agent_message"] = message

    def _event_token_count(self, timestamp: str, payload: dict[str, Any]) -> None:
        raw_info = payload.get("info")
        info = raw_info if isinstance(raw_info, dict) else {}
        total = _valid_usage(info.get("total_token_usage"))
        if total and self.turn is not None:
            self.turn["total_usage"] = total
        self.close_step(timestamp, info.get("last_token_usage"))

    def _event_subagent(self, _timestamp: str, payload: dict[str, Any]) -> None:
        thread_id = payload.get("new_thread_id")
        if thread_id is None and payload.get("kind") == "started":
            thread_id = payload.get("agent_thread_id")
        assert self.turn is not None
        children = self.turn["subagent_thread_ids"]
        if isinstance(thread_id, str) and thread_id not in children:
            children.append(thread_id)

    def _event_tool_end(self, timestamp: str, payload: dict[str, Any]) -> None:
        call_id = payload.get("call_id")
        event_type = str(payload.get("type") or "")
        if not isinstance(call_id, str) or not event_type.endswith("_end"):
            return
        tool = self.tools.get(call_id)
        if tool is None:
            return
        tool["end_time"] = timestamp
        self._record_tool_error(tool, payload)
        if "output" not in tool and payload.get("aggregated_output") is not None:
            tool["output"] = payload["aggregated_output"]

    @staticmethod
    def _record_tool_error(tool: dict[str, Any], payload: dict[str, Any]) -> None:
        if payload.get("status") not in {"failed", "declined"}:
            return
        tool["error"] = str(
            payload.get("error")
            or payload.get("aggregated_output")
            or payload.get("stderr")
            or "tool failed"
        )

    def _finish_event(self, timestamp: str, event_type: str) -> None:
        if event_type == "task_complete":
            self.close_turn(timestamp, completed=True, aborted=False)
        elif event_type == "turn_aborted":
            self.close_turn(timestamp, completed=True, aborted=True)


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
        key: _redacted_metadata_string(item, config) if isinstance(item, str) else item
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
    subagent_loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]]
    | None = None,
) -> list[dict[str, Any]]:
    observations = [
        _generation_observation(step, turn, session, config) for step in turn["steps"]
    ]
    for thread_id in turn["subagent_thread_ids"]:
        observations.extend(
            _subagent_observations(
                path,
                thread_id,
                config,
                attribution,
                visited,
                subagent_loader,
            )
        )
    return observations


def _generation_observation(
    step: dict[str, Any],
    turn: dict[str, Any],
    session: dict[str, Any],
    config: Config,
) -> dict[str, Any]:
    generation: dict[str, Any] = {
        "type": "generation",
        "name": "LLM Subagent" if session["is_subagent"] else "LLM",
        "model": turn.get("model"),
        "start_time": step["start_time"],
        "end_time": step["end_time"],
        "usage_details": step.get("usage"),
        "children": [_tool_observation(tool, config) for tool in step["tools"]],
    }
    if config.capture_content:
        generation["output"] = _captured(
            {"content": step.get("output"), "reasoning": step.get("reasoning")},
            config,
        )
    return generation


def _tool_observation(tool: dict[str, Any], config: Config) -> dict[str, Any]:
    error = tool.get("error")
    child = {
        "type": "tool",
        "name": _tool_observation_name(tool, config),
        "start_time": tool["start_time"],
        "end_time": tool["end_time"],
        "error": _tool_error(error, config),
    }
    if config.capture_content:
        child["input"] = _captured(tool.get("input"), config)
        child["output"] = _captured(tool.get("output"), config)
    return child


def _tool_error(error: Any, config: Config) -> Any:
    if not error:
        return None
    return _captured(error, config) if config.capture_content else "tool failed"


def _subagent_observations(
    path: Path,
    thread_id: str,
    config: Config,
    attribution: dict[str, Any],
    visited: set[Path],
    loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]] | None,
) -> list[dict[str, Any]]:
    child_path = _find_subagent_rollout(path, thread_id)
    if child_path is None or child_path in visited:
        return []
    visited.add(child_path)
    child_session, child_turns = _load_subagent(child_path, loader)
    if child_session.get("session_id") != thread_id:
        raise ValueError("subagent rollout thread ID does not match the spawned thread")
    return [
        _subagent_observation(
            child_path,
            turn,
            child_session,
            config,
            attribution,
            visited,
            loader,
        )
        for turn in child_turns
    ]


def _load_subagent(
    path: Path,
    loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]] | None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    return loader(path) if loader is not None else parse_rollout(load_rollout(path))


def _subagent_observation(
    path: Path,
    turn: dict[str, Any],
    session: dict[str, Any],
    config: Config,
    attribution: dict[str, Any],
    visited: set[Path],
    loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]] | None,
) -> dict[str, Any]:
    observation: dict[str, Any] = {
        "type": "agent",
        "name": "Codex Subagent Turn",
        "session_id": _redacted_metadata_string(session["session_id"], config),
        "start_time": turn["start_time"],
        "end_time": turn["end_time"],
        "metadata": _metadata(turn, session, attribution, config),
        "children": _turn_observations(
            path, turn, session, config, attribution, visited, loader
        ),
    }
    if config.capture_content:
        observation["input"] = _captured(turn.get("input"), config)
        observation["output"] = _captured(turn.get("output"), config)
    return observation


def trace_document(
    path: Path,
    config: Config,
    cwd: str,
    *,
    attribution_snapshots: dict[str, dict[str, Any]] | None = None,
    parsed: tuple[dict[str, Any], list[dict[str, Any]]] | None = None,
    attribution_state: dict[str, Any] | None = None,
    subagent_loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]]
    | None = None,
) -> dict[str, Any]:
    if not path.is_absolute():
        raise ValueError("transcript_path must name a readable absolute file")
    path = path.resolve()
    session, turns = parsed if parsed is not None else parse_rollout(load_rollout(path))
    if not isinstance(session.get("session_id"), str):
        raise ValueError("rollout is missing a valid Codex thread ID")
    thread_id = _redacted_metadata_string(session["session_id"], config)
    assert thread_id is not None
    visited = {path}
    automatic = (
        attribution_snapshot(config, cwd) if attribution_snapshots is None else None
    )
    timeline = attribution_state if attribution_state is not None else {}
    attribution = _AttributionTimeline(
        config,
        thread_id,
        attribution_snapshots,
        automatic,
        timeline,
    )
    traces = [
        _turn_trace(
            path,
            turn,
            session,
            config,
            attribution.for_turn(turn),
            visited,
            subagent_loader,
        )
        for turn in turns
    ]
    attribution.persist(timeline)
    return {"status": "dry-run", "traces": traces}


class _AttributionTimeline:
    def __init__(
        self,
        config: Config,
        thread_id: str,
        snapshots: dict[str, dict[str, Any]] | None,
        automatic: dict[str, Any] | None,
        state: dict[str, Any],
    ) -> None:
        self.config = config
        self.thread_id = thread_id
        self.snapshots = snapshots
        self.automatic = automatic
        self.mode = str(state.get("mode", "auto"))
        self.explicit_work_item_id = state.get("explicit_work_item_id")
        self.epoch = int(state.get("epoch", 0))
        previous = state.get("previous_key")
        self.previous_key = tuple(previous) if previous else None

    def for_turn(self, turn: dict[str, Any]) -> dict[str, Any]:
        directive = _attribution_directive(turn.get("input"))
        if directive is not None:
            self.mode, self.explicit_work_item_id = directive
            self.epoch += 1
        fallback, missing = self._fallback(turn.get("turn_id"))
        attribution = self._base_attribution(fallback)
        attribution["branch"] = fallback.get("branch")
        attribution["head"] = fallback.get("head")
        self._set_epoch(attribution, missing, directive)
        return attribution

    def _fallback(self, turn_id: Any) -> tuple[dict[str, Any], bool]:
        if self.snapshots is None:
            assert self.automatic is not None
            return self.automatic, False
        if isinstance(turn_id, str) and turn_id in self.snapshots:
            return self.snapshots[turn_id], False
        return {
            "work_item_id": None,
            "source": "none",
            "branch": None,
            "head": None,
        }, True

    def _base_attribution(self, fallback: dict[str, Any]) -> dict[str, Any]:
        if self.mode == "set":
            work_item_id = self.explicit_work_item_id
            if _contains_credential(work_item_id, self.config):
                work_item_id = None
            return {"work_item_id": work_item_id, "source": "explicit"}
        if self.mode == "clear":
            return {"work_item_id": None, "source": "explicit"}
        return {
            "work_item_id": fallback.get("work_item_id"),
            "source": fallback["source"],
        }

    def _set_epoch(
        self,
        attribution: dict[str, Any],
        missing_snapshot: bool,
        directive: tuple[str, str | None] | None,
    ) -> None:
        if self.mode == "auto" and missing_snapshot:
            attribution["epoch"] = None
            return
        effective_key = (attribution["source"], attribution.get("work_item_id"))
        if directive is None and self._changed(effective_key):
            self.epoch += 1
        attribution["epoch"] = f"{self.thread_id}:attribution:{self.epoch}"
        self.previous_key = effective_key

    def _changed(self, effective_key: tuple[Any, Any]) -> bool:
        return self.previous_key is not None and effective_key != self.previous_key

    def persist(self, state: dict[str, Any]) -> None:
        state.update(
            mode=self.mode,
            explicit_work_item_id=self.explicit_work_item_id,
            epoch=self.epoch,
            previous_key=self.previous_key,
        )


def _turn_trace(
    path: Path,
    turn: dict[str, Any],
    session: dict[str, Any],
    config: Config,
    attribution: dict[str, Any],
    visited: set[Path],
    loader: Callable[[Path], tuple[dict[str, Any], list[dict[str, Any]]]] | None,
) -> dict[str, Any]:
    trace: dict[str, Any] = {
        "name": "Codex Subagent Turn" if session["is_subagent"] else "Codex Turn",
        "session_id": attribution["epoch"],
        "start_time": turn["start_time"],
        "end_time": turn["end_time"],
        "metadata": _metadata(turn, session, attribution, config),
        "observations": _turn_observations(
            path, turn, session, config, attribution, visited, loader
        ),
    }
    if config.capture_content:
        trace["input"] = _captured(turn.get("input"), config)
        trace["output"] = _captured(turn.get("output"), config)
    return trace
