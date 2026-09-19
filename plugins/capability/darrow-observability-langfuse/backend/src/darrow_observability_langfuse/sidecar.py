from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import tempfile
from collections.abc import Callable
from contextlib import suppress
from functools import wraps
from pathlib import Path
from typing import Any, ParamSpec, TypeVar, cast

from .config import validate_work_item_id

_CONTROL_CHARACTER = re.compile(r"[\x00-\x1f\x7f]")
_GIT_HEAD = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", re.I)
P = ParamSpec("P")
R = TypeVar("R")


def _locked(
    path_for: Callable[..., Path],
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorate(function: Callable[P, R]) -> Callable[P, R]:
        @wraps(function)
        def invoke(*args: P.args, **kwargs: P.kwargs) -> R:
            path = path_for(*args, **kwargs)
            path.parent.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(f"{path}.lock", os.O_CREAT | os.O_RDWR, 0o600)
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX)
                return function(*args, **kwargs)
            finally:
                os.close(descriptor)

        return invoke

    return decorate


def sidecar_path(rollout: Path) -> Path:
    return Path(f"{rollout}.darrow-langfuse")


def _provisional_path(plugin_data: Path, session_id: str) -> Path:
    if not session_id or len(session_id) > 256 or _CONTROL_CHARACTER.search(session_id):
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
    _validate_version(value)
    identifiers = _validated_identifiers(value.get("uploaded_turn_ids"))
    snapshots = _validated_snapshots(value.get("attribution_snapshots", {}))
    return {
        "uploaded_turn_ids": identifiers,
        "attribution_snapshots": snapshots,
    }


def _validate_version(value: dict[str, Any]) -> None:
    version = value.get("version")
    if version is None and "attribution_snapshots" in value:
        raise ValueError("Langfuse sidecar attribution snapshots need version 1")
    if version is not None and (type(version) is not int or version != 1):
        raise ValueError("Langfuse sidecar has an unsupported version")


def _invalid_identifier(value: Any) -> bool:
    return (
        not isinstance(value, str)
        or not value
        or len(value) > 256
        or _CONTROL_CHARACTER.search(value) is not None
    )


def _validated_identifiers(value: Any) -> list[str]:
    if not isinstance(value, list) or any(_invalid_identifier(item) for item in value):
        raise ValueError("Langfuse sidecar has an invalid uploaded_turn_ids value")
    return cast("list[str]", list(value))


def _validated_snapshots(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict):
        raise ValueError("Langfuse sidecar has an invalid attribution_snapshots value")
    snapshots: dict[Any, Any] = value
    for turn_id, snapshot in snapshots.items():
        _validate_snapshot(turn_id, snapshot)
    return cast("dict[str, dict[str, Any]]", dict(snapshots))


def _validate_snapshot(turn_id: Any, snapshot: Any) -> None:
    if _invalid_identifier(turn_id) or not isinstance(snapshot, dict):
        raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
    source = snapshot.get("source")
    if source not in {"configuration", "git_branch", "none"}:
        raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
    work_item_id = _validated_work_item(snapshot.get("work_item_id"))
    if (source == "none") != (work_item_id is None):
        raise ValueError("Langfuse sidecar has an invalid attribution snapshot")
    _validate_provenance(source, snapshot.get("branch"), snapshot.get("head"))


def _validated_work_item(value: Any) -> str | None:
    try:
        return validate_work_item_id(value)
    except ValueError as error:
        raise ValueError(
            "Langfuse sidecar has an invalid attribution snapshot"
        ) from error


def _validate_provenance(source: Any, branch: Any, head: Any) -> None:
    invalid_branch = branch is not None and (
        not isinstance(branch, str)
        or not branch
        or len(branch) > 1024
        or _CONTROL_CHARACTER.search(branch) is not None
    )
    invalid_head = head is not None and (
        not isinstance(head, str) or _GIT_HEAD.fullmatch(head) is None
    )
    if invalid_branch or invalid_head or (source == "git_branch" and branch is None):
        raise ValueError("Langfuse sidecar has an invalid attribution snapshot")


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
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        temporary = None
    finally:
        if temporary is not None:
            with suppress(OSError):
                os.unlink(temporary)


def load_attribution_snapshots(rollout: Path) -> dict[str, dict[str, Any]]:
    return cast(
        "dict[str, dict[str, Any]]", _load_state(rollout)["attribution_snapshots"]
    )


def load_provisional_attribution_snapshots(
    plugin_data: Path, session_id: str
) -> dict[str, dict[str, Any]]:
    snapshots = _load_state_path(_provisional_path(plugin_data, session_id))[
        "attribution_snapshots"
    ]
    return cast("dict[str, dict[str, Any]]", snapshots)


@_locked(lambda rollout, *args, **kwargs: sidecar_path(rollout))
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


@_locked(
    lambda plugin_data, session_id, *args, **kwargs: _provisional_path(
        plugin_data, session_id
    )
)
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


@_locked(
    lambda plugin_data, session_id, *args, **kwargs: _provisional_path(
        plugin_data, session_id
    )
)
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
        if (
            not isinstance(metadata, dict)
            or metadata.get("codex.completed") is not True
        ):
            continue
        turn_id = metadata.get("codex.turn_id")
        if isinstance(turn_id, str) and turn_id in uploaded:
            continue
        pending.append(trace)
    return {**document, "traces": pending}


@_locked(lambda rollout, *args, **kwargs: sidecar_path(rollout))
def mark_exported_turns(rollout: Path, exported: dict[str, Any]) -> None:
    state = _load_state(rollout)
    uploaded = set(state["uploaded_turn_ids"])
    traces = exported.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    uploaded.update(_exported_turn_ids(traces))
    if not uploaded:
        return
    state["uploaded_turn_ids"] = sorted(uploaded)
    _write_state(rollout, state)


def _exported_turn_ids(traces: list[Any]) -> set[str]:
    identifiers: set[str] = set()
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        if (
            not isinstance(metadata, dict)
            or metadata.get("codex.completed") is not True
        ):
            continue
        turn_id = metadata.get("codex.turn_id")
        if isinstance(turn_id, str) and turn_id:
            identifiers.add(turn_id)
    return identifiers
