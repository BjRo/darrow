from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from .config import Config, load_config
from .export import export_document
from .rollout import attribution_snapshot, trace_document
from .sidecar import (
    load_attribution_snapshots,
    mark_exported_turns,
    pending_document,
    record_attribution_snapshot,
)


def _environment_true(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _diagnose(message: str, *, config: Config | None = None) -> None:
    if (config and (config.debug or config.strict)) or _environment_true(
        "DARROW_LANGFUSE_DEBUG"
    ) or _environment_true("DARROW_LANGFUSE_STRICT"):
        print(f"darrow-langfuse: {message}", file=sys.stderr)


def _read_hook_input() -> dict[str, Any]:
    try:
        value = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        raise ValueError("hook input is not valid JSON") from error
    if not isinstance(value, dict):
        raise ValueError("hook input must be a JSON object")
    return value


def _complete_stop_turn(document: dict[str, Any], turn_id: Any) -> None:
    if not isinstance(turn_id, str) or not turn_id:
        raise ValueError("hook input is missing turn_id")
    traces = document.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    matches = [
        trace
        for trace in traces
        if isinstance(trace, dict)
        and isinstance(trace.get("metadata"), dict)
        and trace["metadata"].get("codex.turn_id") == turn_id
    ]
    if len(matches) != 1:
        raise ValueError("hook turn_id does not identify exactly one rollout turn")
    matches[0]["metadata"]["codex.completed"] = True


def run() -> int:
    config: Config | None = None
    try:
        hook_input = _read_hook_input()
        cwd = hook_input.get("cwd") if isinstance(hook_input.get("cwd"), str) else os.getcwd()
        config = load_config(cwd)
        if not config.enabled:
            _diagnose("tracing is disabled", config=config)
            return 0
        transcript_path = hook_input.get("transcript_path")
        if not isinstance(transcript_path, str) or not transcript_path:
            raise ValueError("hook input is missing transcript_path")
        rollout = Path(transcript_path)
        turn_id = hook_input.get("turn_id")
        snapshots = load_attribution_snapshots(rollout)
        if isinstance(turn_id, str) and turn_id in snapshots:
            current_snapshot = snapshots[turn_id]
        else:
            current_snapshot = attribution_snapshot(config, cwd)
        effective_snapshots = dict(snapshots)
        if isinstance(turn_id, str):
            effective_snapshots[turn_id] = current_snapshot
        document = trace_document(
            rollout,
            config,
            cwd,
            attribution_snapshots=effective_snapshots,
        )
        _complete_stop_turn(document, turn_id)
        if config.dry_run:
            json.dump(document, sys.stdout, separators=(",", ":"), sort_keys=True)
            sys.stdout.write("\n")
            return 0
        if not config.public_key or not config.secret_key:
            raise ValueError("Langfuse credentials are missing")
        assert isinstance(turn_id, str)
        record_attribution_snapshot(rollout, turn_id, current_snapshot)
        pending = pending_document(document, rollout)
        if not pending["traces"]:
            return 0
        export_document(pending, config)
        mark_exported_turns(rollout, pending)
        return 0
    except Exception as error:  # The hook is fail-open unless strict mode is explicit.
        _diagnose(str(error), config=config)
        strict = config.strict if config is not None else _environment_true("DARROW_LANGFUSE_STRICT")
        return 1 if strict else 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
