from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from .config import Config, load_config
from .export import export_document
from .capture import capture, load_capture_snapshots
from .delivery import await_capture, drain
from .lifecycle import record_terminal, registered_rollouts
from .rollout import attribution_snapshot, trace_document
from .sidecar import (
    load_attribution_snapshots,
    load_provisional_attribution_snapshots,
    record_provisional_attribution_snapshot,
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


def _required_identifier(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"hook input is missing {name}")
    return value


def _plugin_data() -> Path | None:
    value = os.environ.get("PLUGIN_DATA")
    return Path(value) if value else None


def _completed_turn_ids(document: dict[str, Any]) -> set[str]:
    result = set()
    traces = document.get("traces")
    if not isinstance(traces, list):
        return result
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        turn_id = metadata.get("codex.turn_id") if isinstance(metadata, dict) else None
        if metadata and metadata.get("codex.completed") is True and isinstance(turn_id, str):
            result.add(turn_id)
    return result


def run(*, background: bool = False) -> int:
    config: Config | None = None
    try:
        hook_input = _read_hook_input()
        cwd = hook_input.get("cwd") if isinstance(hook_input.get("cwd"), str) else os.getcwd()
        config = load_config(cwd)
        if not config.enabled:
            _diagnose("tracing is disabled", config=config)
            return 0
        hook_event_name = hook_input.get("hook_event_name")
        session_id = _required_identifier(hook_input.get("session_id"), "session_id")
        plugin_data = _plugin_data()
        if background:
            if config.dry_run:
                return 0
            transcript_path = hook_input.get("transcript_path")
            if not config.public_key or not config.secret_key:
                raise ValueError("Langfuse credentials are missing")
            valid_path = isinstance(transcript_path, str) and Path(transcript_path).is_absolute()
            if hook_event_name == "Stop":
                if not valid_path:
                    raise ValueError("hook input is missing transcript_path")
                if not await_capture(Path(transcript_path), _required_identifier(hook_input.get("turn_id"), "turn_id")):
                    raise ValueError("foreground capture has not completed")
                drain(Path(transcript_path), config, exporter=export_document, plugin_data=plugin_data)
            elif hook_event_name in {"SessionStart", "UserPromptSubmit"}:
                targets = list(registered_rollouts(plugin_data))
                if valid_path:
                    targets.append((Path(transcript_path).resolve(), session_id))
                failure = None
                for path, identifier in dict.fromkeys(targets):
                    try:
                        capture(path, config, cwd, identifier, None, plugin_data)
                        drain(path, config, exporter=export_document, plugin_data=plugin_data)
                    except Exception as error:
                        failure = error  # One stale session cannot starve another backlog.
                if failure is not None:
                    raise failure
            else:
                raise ValueError("hook input has an unsupported background event")
            return 0
        if hook_event_name in {"Interrupt", "SessionEnd"}:
            if config.dry_run:
                return 0
            transcript_path = hook_input.get("transcript_path")
            if not isinstance(transcript_path, str):
                raise ValueError("hook input is missing transcript_path")
            terminal_turn = _required_identifier(hook_input.get("turn_id"), "turn_id") if hook_event_name == "Interrupt" else None
            record_terminal(Path(transcript_path), session_id, hook_event_name, terminal_turn, config, plugin_data)
            return 0
        turn_id = _required_identifier(hook_input.get("turn_id"), "turn_id")
        if hook_event_name == "UserPromptSubmit":
            if config.dry_run:
                return 0
            if plugin_data is None:
                raise ValueError("PLUGIN_DATA is unavailable for provisional attribution")
            record_provisional_attribution_snapshot(
                plugin_data,
                session_id,
                turn_id,
                attribution_snapshot(config, cwd),
            )
            return 0
        if hook_event_name != "Stop":
            raise ValueError("hook input has an unsupported hook_event_name")
        transcript_path = hook_input.get("transcript_path")
        if not isinstance(transcript_path, str) or not transcript_path:
            raise ValueError("hook input is missing transcript_path")
        rollout = Path(transcript_path)
        if not rollout.is_absolute():
            raise ValueError("transcript_path must name a readable absolute file")
        if not config.dry_run:
            if not config.public_key or not config.secret_key:
                raise ValueError("Langfuse credentials are missing")
            capture(rollout, config, cwd, session_id, turn_id, plugin_data)
            return 0
        snapshots = {**load_attribution_snapshots(rollout), **load_capture_snapshots(rollout)}
        provisional = (
            load_provisional_attribution_snapshots(plugin_data, session_id)
            if plugin_data is not None
            else {}
        )
        if turn_id in snapshots:
            current_snapshot = snapshots[turn_id]
        else:
            current_snapshot = attribution_snapshot(config, cwd)
        effective_snapshots = dict(provisional)
        effective_snapshots.update(snapshots)
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
    except Exception as error:  # The hook is fail-open unless strict mode is explicit.
        _diagnose(str(error), config=config)
        strict = config.strict if config is not None else _environment_true("DARROW_LANGFUSE_STRICT")
        return 1 if strict else 0


def main() -> None:
    raise SystemExit(run(background="--drain" in sys.argv[1:]))


if __name__ == "__main__":
    main()
