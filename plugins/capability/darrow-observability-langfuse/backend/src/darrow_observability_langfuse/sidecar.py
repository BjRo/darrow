from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def sidecar_path(rollout: Path) -> Path:
    return Path(f"{rollout}.darrow-langfuse")


def _load_uploaded(rollout: Path) -> set[str]:
    path = sidecar_path(rollout)
    if not path.exists():
        return set()
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("Langfuse sidecar is unreadable or invalid") from error
    identifiers = value.get("uploaded_turn_ids") if isinstance(value, dict) else None
    if not isinstance(identifiers, list) or any(not isinstance(item, str) for item in identifiers):
        raise ValueError("Langfuse sidecar has an invalid uploaded_turn_ids value")
    return set(identifiers)


def pending_document(document: dict[str, Any], rollout: Path) -> dict[str, Any]:
    uploaded = _load_uploaded(rollout)
    traces = document.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    pending = []
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        turn_id = metadata.get("codex.turn_id") if isinstance(metadata, dict) else None
        if isinstance(turn_id, str) and turn_id in uploaded:
            continue
        pending.append(trace)
    return {**document, "traces": pending}


def mark_exported_turns(rollout: Path, exported: dict[str, Any]) -> None:
    uploaded = _load_uploaded(rollout)
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

    path = sidecar_path(rollout)
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
            json.dump({"uploaded_turn_ids": sorted(uploaded)}, handle, separators=(",", ":"))
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
