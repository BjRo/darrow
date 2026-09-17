"""Small immutable terminal receipts, independent of capture/database locks."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
from collections.abc import Iterator
from contextlib import suppress
from pathlib import Path
from typing import Any

from .config import Config
from .context import delivery_context, require_context
from .sidecar import _load_state_path, load_provisional_attribution_snapshots


def file_identity(stat: os.stat_result) -> list[int]:
    return [stat.st_dev, stat.st_ino, getattr(stat, "st_birthtime_ns", 0)]


def _atomic_record(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary = tempfile.mkstemp(prefix=".receipt-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        with suppress(FileExistsError):
            os.link(temporary, path)  # First receipt wins; never replace evidence.
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        os.unlink(temporary)


def bind_rollout_context(
    rollout: Path, session_id: str, context: dict[str, Any]
) -> None:
    """First writer wins without waiting for a capture transaction."""
    path = Path(f"{rollout}.darrow-langfuse-context")
    if not path.exists():
        # Never assign a new origin to old durable evidence. Read-only SQLite
        # inspection is nonblocking; unreadable/locked legacy state refuses.
        _validate_legacy_context(rollout, context)
        _validate_terminal_contexts(rollout, session_id, context)
        _atomic_record(path, context)
    require_context(json.loads(path.read_text()), context)


def _validate_legacy_context(rollout: Path, context: dict[str, Any]) -> None:
    previous = Path(f"{rollout}.darrow-langfuse.sqlite3")
    if not previous.exists():
        return
    connection = sqlite3.connect(f"{previous.as_uri()}?mode=ro", uri=True, timeout=0)
    try:
        binding = connection.execute(
            "SELECT value FROM state WHERE key='delivery_context'"
        ).fetchone()
        if binding:
            require_context(json.loads(binding[0]), context)
        elif _database_has_evidence(connection):
            require_context(None, context)
    finally:
        connection.close()


def _database_has_evidence(connection: sqlite3.Connection) -> bool:
    tables = ("state", "envelopes", "captured_turns", "receipts", "snapshots")
    return any(
        connection.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone()
        for table in tables
    )


def _validate_terminal_contexts(
    rollout: Path, session_id: str, context: dict[str, Any]
) -> None:
    for event in terminal_records(rollout, session_id):
        require_context(event.get("delivery_context"), context)


def register_rollout(
    rollout: Path,
    session_id: str,
    plugin_data: Path | None,
    context: dict[str, Any],
) -> None:
    if plugin_data is None:
        return
    identity = hashlib.sha256(f"{rollout.resolve()}\0{session_id}".encode()).hexdigest()
    _atomic_record(
        plugin_data / "langfuse-rollouts" / f"{identity}.json",
        {
            "rollout": str(rollout.resolve()),
            "session_id": session_id,
            "delivery_context": context,
        },
    )


def registered_rollouts(
    plugin_data: Path | None, context: dict[str, Any]
) -> Iterator[tuple[Path, str]]:
    if plugin_data is None:
        return
    for path in sorted((plugin_data / "langfuse-rollouts").glob("*.json")):
        value = json.loads(path.read_text())
        _validate_registry_entry(value)
        if value.get("delivery_context") == context:
            yield Path(value["rollout"]), value["session_id"]


def _validate_registry_entry(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValueError("Langfuse rollout registry is invalid")
    rollout = value.get("rollout")
    session_id = value.get("session_id")
    if not isinstance(rollout, str) or not Path(rollout).is_absolute():
        raise ValueError("Langfuse rollout registry is invalid")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("Langfuse rollout registry is invalid")


def record_terminal(
    rollout: Path,
    session_id: str,
    event: str,
    turn_id: str | None,
    config: Config,
    plugin_data: Path | None,
    *,
    cwd: str,
) -> None:
    if event not in {"Interrupt", "SessionEnd"}:
        raise ValueError("invalid terminal hook")
    if not rollout.is_absolute() or not rollout.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    rollout = rollout.resolve()
    stat = rollout.stat()
    context = delivery_context(config, cwd)
    bind_rollout_context(rollout, session_id, context)
    value = {
        "version": 1,
        "uploaded_turn_ids": [],
        "attribution_snapshots": load_provisional_attribution_snapshots(
            plugin_data, session_id
        )
        if plugin_data
        else {},
        "session_id": session_id,
        "event": event,
        "turn_id": turn_id,
        "identity": file_identity(stat),
        "offset": stat.st_size,
        "capture_content": config.capture_content,
        "delivery_context": context,
    }
    identity = hashlib.sha256(
        json.dumps(
            [session_id, event, turn_id, value["identity"], stat.st_size]
        ).encode()
    ).hexdigest()
    register_rollout(rollout, session_id, plugin_data, context)
    _atomic_record(
        Path(f"{rollout}.darrow-langfuse-events") / f"{identity}.json", value
    )


def terminal_records(rollout: Path, session_id: str) -> Iterator[dict[str, Any]]:
    for path in sorted(Path(f"{rollout}.darrow-langfuse-events").glob("*.json")):
        _load_state_path(path)  # Reuse validated snapshot format, not a second parser.
        value = json.loads(path.read_text())
        _validate_terminal_record(value, session_id)
        yield value


def _validate_terminal_record(value: Any, session_id: str) -> None:
    if not isinstance(value, dict):
        raise ValueError("Langfuse terminal receipt is invalid")
    if value.get("session_id") != session_id:
        raise ValueError("Langfuse terminal receipt is invalid")
    if value.get("event") not in {"Interrupt", "SessionEnd"}:
        raise ValueError("Langfuse terminal receipt is invalid")
    if not _valid_terminal_position(value) or not _valid_terminal_event(value):
        raise ValueError("Langfuse terminal receipt is invalid")


def _valid_terminal_position(value: dict[str, Any]) -> bool:
    identity = value.get("identity")
    offset = value.get("offset")
    return (
        isinstance(identity, list)
        and len(identity) == 3
        and type(offset) is int
        and offset >= 0
    )


def _valid_terminal_event(value: dict[str, Any]) -> bool:
    if type(value.get("capture_content")) is not bool:
        return False
    return value["event"] != "Interrupt" or isinstance(value.get("turn_id"), str)
