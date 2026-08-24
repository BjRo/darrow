from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .config import Config, resolve_work_item_id


_SENSITIVE_KEY = re.compile(
    r"(?:authorization|api[-_]?key|secret|password|token|credential)", re.I
)


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
    session = {"session_id": "unknown", "is_subagent": False}
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
            if isinstance(payload.get("id"), str):
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
    turn: dict[str, Any], session: dict[str, Any], work_item_id: str | None
) -> dict[str, Any]:
    value = {
        "codex.turn_id": turn.get("turn_id"),
        "codex.thread_id": session["session_id"],
        "codex.model": turn.get("model"),
        "codex.model_provider": session.get("model_provider"),
        "codex.cli_version": session.get("cli_version"),
        "codex.aborted": turn.get("aborted", False),
        "codex.completed": turn.get("completed", False),
    }
    if work_item_id:
        value["darrow.work_item_id"] = work_item_id
    return value


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
    work_item_id: str | None,
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
                "name": tool["name"],
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
        for child_turn in child_turns:
            child_observation: dict[str, Any] = {
                "type": "agent",
                "name": "Codex Subagent Turn",
                "session_id": child_session["session_id"],
                "start_time": child_turn["start_time"],
                "end_time": child_turn["end_time"],
                "metadata": _metadata(child_turn, child_session, work_item_id),
                "children": _turn_observations(
                    child_path,
                    child_turn,
                    child_session,
                    config,
                    work_item_id,
                    visited,
                ),
            }
            if config.capture_content:
                child_observation["input"] = _captured(child_turn.get("input"), config)
                child_observation["output"] = _captured(child_turn.get("output"), config)
            observations.append(child_observation)
    return observations


def trace_document(path: Path, config: Config, cwd: str) -> dict[str, Any]:
    if not path.is_absolute():
        raise ValueError("transcript_path must name a readable absolute file")
    path = path.resolve()
    session, turns = parse_rollout(load_rollout(path))
    work_item_id = resolve_work_item_id(config, cwd)
    traces = []
    visited = {path}
    for turn in turns:
        trace: dict[str, Any] = {
            "name": "Codex Subagent Turn" if session["is_subagent"] else "Codex Turn",
            "session_id": session["session_id"],
            "start_time": turn["start_time"],
            "end_time": turn["end_time"],
            "metadata": _metadata(turn, session, work_item_id),
            "observations": _turn_observations(
                path, turn, session, config, work_item_id, visited
            ),
        }
        if config.capture_content:
            trace["input"] = _captured(turn.get("input"), config)
            trace["output"] = _captured(turn.get("output"), config)
        traces.append(trace)
    return {"status": "dry-run", "traces": traces}
