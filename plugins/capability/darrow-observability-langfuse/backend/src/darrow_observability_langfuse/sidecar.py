from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from .config import validate_work_item_id


_CONTROL_CHARACTER = re.compile(r"[\x00-\x1f\x7f]")
_GIT_HEAD = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", re.I)


def sidecar_path(rollout: Path) -> Path:
    return Path(f"{rollout}.darrow-langfuse")


def _provisional_path(plugin_data: Path, session_id: str) -> Path:
    if (
        not session_id
        or len(session_id) > 256
        or _CONTROL_CHARACTER.search(session_id)
    ):
        raise ValueError("Langfuse provisional attribution has an invalid session ID")
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return plugin_data / "attribution-snapshots" / f"{digest}.json"


def _load_state(rollout: Path) -> dict[str, Any]:
    return _load_state_path(sidecar_path(rollout))


def _load_state_path(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"uploaded_turn_ids": [], "attribution_snapshots": {}}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("Langfuse sidecar is unreadable or invalid") from error
    if not isinstance(value, dict):
        raise ValueError("Langfuse sidecar is unreadable or invalid")
    version = value.get("version")
    if version is None:
        if "attribution_snapshots" in value:
            raise ValueError("Langfuse sidecar attribution snapshots need version 1")
    elif type(version) is not int or version != 1:
        raise ValueError("Langfuse sidecar has an unsupported version")
    identifiers = value.get("uploaded_turn_ids")
    if not isinstance(identifiers, list) or any(
        not isinstance(item, str)
        or not item
        or len(item) > 256
        or _CONTROL_CHARACTER.search(item)
        for item in identifiers
    ):
        raise ValueError("Langfuse sidecar has an invalid uploaded_turn_ids value")
    snapshots = value.get("attribution_snapshots", {})
    if not isinstance(snapshots, dict):
        raise ValueError("Langfuse sidecar has an invalid attribution_snapshots value")
    for turn_id, snapshot in snapshots.items():
        if (
            not isinstance(turn_id, str)
            or not turn_id
            or len(turn_id) > 256
            or _CONTROL_CHARACTER.search(turn_id)
            or not isinstance(snapshot, dict)
        ):
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
        source = snapshot.get("source")
        if source not in {"configuration", "git_branch", "none"}:
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
        work_item_id = snapshot.get("work_item_id")
        try:
            normalized_work_item_id = validate_work_item_id(work_item_id)
        except ValueError as error:
            raise ValueError(
                "Langfuse sidecar has an invalid attribution snapshot"
            ) from error
        if (source == "none" and normalized_work_item_id is not None) or (
            source != "none" and normalized_work_item_id is None
        ):
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
        branch = snapshot.get("branch")
        if branch is not None and (
            not isinstance(branch, str)
            or not branch
            or len(branch) > 1024
            or _CONTROL_CHARACTER.search(branch)
        ):
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
        if source == "git_branch" and branch is None:
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
        head = snapshot.get("head")
        if head is not None and (
            not isinstance(head, str) or _GIT_HEAD.fullmatch(head) is None
        ):
            raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
    return {
        "uploaded_turn_ids": list(identifiers),
        "attribution_snapshots": dict(snapshots),
    }


def _write_state(rollout: Path, state: dict[str, Any]) -> None:
    _write_state_path(sidecar_path(rollout), state)


def _write_state_path(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            delete=False,
        ) as handle:
            temporary = handle.name
            json.dump(
                {
                    "version": 1,
                    "uploaded_turn_ids": sorted(set(state["uploaded_turn_ids"])),
                    "attribution_snapshots": state["attribution_snapshots"],
                },
                handle,
                separators=(",", ":"),
                sort_keys=True,
            )
            handle.write("\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            try:
                os.unlink(temporary)
            except OSError:
                pass


def load_attribution_snapshots(rollout: Path) -> dict[str, dict[str, Any]]:
    return _load_state(rollout)["attribution_snapshots"]


def load_provisional_attribution_snapshots(
    plugin_data: Path, session_id: str
) -> dict[str, dict[str, Any]]:
    return _load_state_path(_provisional_path(plugin_data, session_id))[
        "attribution_snapshots"
    ]


def record_attribution_snapshot(
    rollout: Path, turn_id: str, snapshot: dict[str, Any]
) -> None:
    state = _load_state(rollout)
    existing = state["attribution_snapshots"].get(turn_id)
    if existing is not None:
        if existing != snapshot:
            raise ValueError("Langfuse sidecar attribution snapshot is immutable")
        return
    state["attribution_snapshots"][turn_id] = snapshot
    _write_state(rollout, state)


def record_provisional_attribution_snapshot(
    plugin_data: Path,
    session_id: str,
    turn_id: str,
    snapshot: dict[str, Any],
) -> None:
    path = _provisional_path(plugin_data, session_id)
    state = _load_state_path(path)
    existing = state["attribution_snapshots"].get(turn_id)
    if existing is not None:
        if existing != snapshot:
            raise ValueError("Langfuse provisional attribution snapshot is immutable")
        return
    state["attribution_snapshots"][turn_id] = snapshot
    _write_state_path(path, state)


def discard_provisional_attribution_snapshots(
    plugin_data: Path, session_id: str, turn_ids: set[str]
) -> None:
    if not turn_ids:
        return
    path = _provisional_path(plugin_data, session_id)
    state = _load_state_path(path)
    snapshots = state["attribution_snapshots"]
    for turn_id in turn_ids:
        snapshots.pop(turn_id, None)
    if snapshots:
        _write_state_path(path, state)
    elif path.exists():
        path.unlink()


def pending_document(document: dict[str, Any], rollout: Path) -> dict[str, Any]:
    uploaded = set(_load_state(rollout)["uploaded_turn_ids"])
    traces = document.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    pending = []
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        if not isinstance(metadata, dict) or metadata.get("codex.completed") is not True:
            continue
        turn_id = metadata.get("codex.turn_id")
        if isinstance(turn_id, str) and turn_id in uploaded:
            continue
        pending.append(trace)
    return {**document, "traces": pending}


def mark_exported_turns(rollout: Path, exported: dict[str, Any]) -> None:
    state = _load_state(rollout)
    uploaded = set(state["uploaded_turn_ids"])
    traces = exported.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        if not isinstance(metadata, dict) or metadata.get("codex.completed") is not True:
            continue
        turn_id = metadata.get("codex.turn_id")
        if isinstance(turn_id, str) and turn_id:
            uploaded.add(turn_id)
    if not uploaded:
        return
    state["uploaded_turn_ids"] = sorted(uploaded)
    _write_state(rollout, state)
