"""Validate Codex rollout shapes without retaining private data in diagnostics."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any


def mapping(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("unknown log shape: expected object")
    return value


def sequence(value: Any) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError("unknown log shape: expected array")
    return value


def text(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("unknown log shape: expected text")
    return value


def integer(value: Any) -> int:
    if type(value) is not int or value < 0:
        raise ValueError("unknown log shape: expected nonnegative integer")
    return value


def parts(value: Any) -> None:
    for value_part in sequence(value):
        part = mapping(value_part)
        if part.get("type") not in {"input_text", "output_text", "summary_text"}:
            raise ValueError("unknown log shape: unsupported content type")
        text(part.get("text"))


def message(item: dict[str, Any]) -> None:
    if item.get("role") not in {"system", "developer", "user", "assistant"}:
        raise ValueError("unknown log shape: unsupported message role")
    parts(item.get("content"))


def call(item: dict[str, Any]) -> None:
    text(item.get("name"))
    text(item.get("arguments", item.get("input")))


def output(item: dict[str, Any]) -> None:
    value = item.get("output")
    if isinstance(value, str):
        return
    parts(value)


def reasoning(item: dict[str, Any]) -> None:
    parts(item.get("summary", []))
    parts(item.get("content", []))


def tools(item: dict[str, Any]) -> None:
    if item.get("role") != "developer":
        raise ValueError("unknown log shape: additional_tools role")
    for tool in sequence(item.get("tools")):
        mapping(tool)


def encrypted_compaction(item: dict[str, Any]) -> None:
    text(item.get("encrypted_content"))


ITEMS: dict[str, Callable[[dict[str, Any]], None]] = {
    "message": message,
    "function_call": call,
    "custom_tool_call": call,
    "function_call_output": output,
    "custom_tool_call_output": output,
    "reasoning": reasoning,
    "additional_tools": tools,
    "compaction": encrypted_compaction,
}


def validate_item(value: Any) -> None:
    item = mapping(value)
    validator = ITEMS.get(item.get("type", ""))
    if validator is None:
        raise ValueError("unknown log shape: unsupported response item")
    validator(item)


def base_text(meta: dict[str, Any]) -> str:
    base = meta.get("base_instructions")
    if isinstance(base, dict):
        base = base.get("text")
    return text(base)


def metadata(payload: dict[str, Any]) -> None:
    base_text(payload)
    if payload.get("cli_version") is not None:
        text(payload["cli_version"])


def compacted(payload: dict[str, Any]) -> None:
    for item in sequence(payload.get("replacement_history")):
        validate_item(item)


def token_info(payload: dict[str, Any]) -> dict[str, Any] | None:
    if payload.get("type") != "token_count" or payload.get("info") is None:
        return None
    info = mapping(payload["info"])
    usage = mapping(info.get("last_token_usage"))
    integer(usage.get("total_tokens"))
    window = integer(info.get("model_context_window"))
    if not window:
        raise ValueError("unknown log shape: zero context window")
    return info


def event(payload: dict[str, Any]) -> None:
    text(payload.get("type"))
    token_info(payload)


def ignored(payload: dict[str, Any]) -> None:
    """Known metadata records do not add response content."""


RECORDS: dict[str, Callable[[dict[str, Any]], None]] = {
    "session_meta": metadata,
    "response_item": validate_item,
    "compacted": compacted,
    "event_msg": event,
    "turn_context": ignored,
    "world_state": ignored,
    "token_usage_record": ignored,
}


def decode(line: str) -> dict[str, Any]:
    try:
        return mapping(json.loads(line))
    except json.JSONDecodeError as error:
        raise ValueError("malformed line: invalid JSON") from error


def validate_record(record: dict[str, Any]) -> None:
    validator = RECORDS.get(record.get("type", ""))
    if validator is None:
        raise ValueError("unknown log shape: unsupported record type")
    validator(mapping(record.get("payload")))


def read_records(path: Path) -> list[dict[str, Any]]:
    records = []
    version = "unknown"
    with path.open(encoding="utf-8") as stream:
        for number, line in enumerate(stream, 1):
            try:
                record = decode(line)
                validate_record(record)
                if record["type"] == "session_meta":
                    version = record["payload"].get("cli_version", "unknown")
                records.append(record)
            except (ValueError, TypeError, KeyError) as error:
                raise ValueError(
                    f"{path.resolve()}:{number}: {error}; cli_version={version}"
                ) from error
    require_metadata(records, path, version)
    return records


def require_metadata(records: list[dict[str, Any]], path: Path, version: str) -> None:
    types = [record["type"] for record in records]
    if not types or types[0] != "session_meta" or types.count("session_meta") != 1:
        raise ValueError(
            f"{path.resolve()}: unknown log shape: require one initial session_meta; cli_version={version}"
        )
