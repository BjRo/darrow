"""Small immutable terminal receipts, independent of capture/database locks."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path

from .sidecar import _load_state_path, load_provisional_attribution_snapshots


def file_identity(stat):
    return [stat.st_dev, stat.st_ino, getattr(stat, "st_birthtime_ns", 0)]


def _atomic_record(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor, temporary = tempfile.mkstemp(prefix=".receipt-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.link(temporary, path)  # First receipt wins; never replace evidence.
        except FileExistsError:
            pass
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        os.unlink(temporary)


def register_rollout(rollout, session_id, plugin_data):
    if plugin_data is None:
        return
    identity = hashlib.sha256(f"{rollout.resolve()}\0{session_id}".encode()).hexdigest()
    _atomic_record(plugin_data / "langfuse-rollouts" / f"{identity}.json",
                   {"rollout": str(rollout.resolve()), "session_id": session_id})


def registered_rollouts(plugin_data):
    if plugin_data is None:
        return
    for path in sorted((plugin_data / "langfuse-rollouts").glob("*.json")):
        value = json.loads(path.read_text())
        if (not isinstance(value, dict) or not isinstance(value.get("rollout"), str)
                or not Path(value["rollout"]).is_absolute()
                or not isinstance(value.get("session_id"), str) or not value["session_id"]):
            raise ValueError("Langfuse rollout registry is invalid")
        yield Path(value["rollout"]), value["session_id"]


def record_terminal(rollout, session_id, event, turn_id, config, plugin_data):
    if event not in {"Interrupt", "SessionEnd"}:
        raise ValueError("invalid terminal hook")
    if not rollout.is_absolute() or not rollout.is_file():
        raise ValueError("transcript_path must name a readable absolute file")
    rollout = rollout.resolve()
    stat = rollout.stat()
    value = {"version": 1, "uploaded_turn_ids": [],
             "attribution_snapshots": load_provisional_attribution_snapshots(plugin_data, session_id) if plugin_data else {},
             "session_id": session_id, "event": event, "turn_id": turn_id,
             "identity": file_identity(stat), "offset": stat.st_size,
             "capture_content": config.capture_content}
    identity = hashlib.sha256(json.dumps([session_id, event, turn_id, value["identity"], stat.st_size]).encode()).hexdigest()
    register_rollout(rollout, session_id, plugin_data)
    _atomic_record(Path(f"{rollout}.darrow-langfuse-events") / f"{identity}.json", value)


def terminal_records(rollout, session_id):
    for path in sorted(Path(f"{rollout}.darrow-langfuse-events").glob("*.json")):
        _load_state_path(path)  # Reuse validated snapshot format, not a second parser.
        value = json.loads(path.read_text())
        if (value.get("session_id") != session_id
                or value.get("event") not in {"Interrupt", "SessionEnd"}
                or not isinstance(value.get("identity"), list) or len(value["identity"]) != 3
                or type(value.get("offset")) is not int or value["offset"] < 0
                or type(value.get("capture_content")) is not bool
                or (value["event"] == "Interrupt" and not isinstance(value.get("turn_id"), str))):
            raise ValueError("Langfuse terminal receipt is invalid")
        yield value
