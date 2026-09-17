from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from .capture import capture, load_capture_snapshots
from .config import Config, load_config
from .context import delivery_context
from .delivery import await_capture, drain
from .export import export_document
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
    if (
        (config and (config.debug or config.strict))
        or _environment_true("DARROW_LANGFUSE_DEBUG")
        or _environment_true("DARROW_LANGFUSE_STRICT")
    ):
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
    result: set[str] = set()
    traces = document.get("traces")
    if not isinstance(traces, list):
        return result
    for trace in traces:
        metadata = trace.get("metadata") if isinstance(trace, dict) else None
        turn_id = metadata.get("codex.turn_id") if isinstance(metadata, dict) else None
        if (
            metadata
            and metadata.get("codex.completed") is True
            and isinstance(turn_id, str)
        ):
            result.add(turn_id)
    return result


def run(*, background: bool = False) -> int:
    config: Config | None = None
    try:
        hook_input = _read_hook_input()
        cwd_value = (
            hook_input.get("cwd")
            if isinstance(hook_input.get("cwd"), str)
            else os.getcwd()
        )
        cwd = str(cwd_value)
        config = load_config(cwd)
        if not config.enabled:
            _diagnose("tracing is disabled", config=config)
            return 0
        return _HookRunner(config, hook_input, cwd, _plugin_data()).execute(background)
    except Exception as error:  # The hook is fail-open unless strict mode is explicit.
        _diagnose(str(error), config=config)
        strict = (
            config.strict
            if config is not None
            else _environment_true("DARROW_LANGFUSE_STRICT")
        )
        return 1 if strict else 0


class _HookRunner:
    def __init__(
        self,
        config: Config,
        hook_input: dict[str, Any],
        cwd: str,
        plugin_data: Path | None,
    ) -> None:
        self.config = config
        self.hook_input = hook_input
        self.cwd = cwd
        self.plugin_data = plugin_data
        event = hook_input.get("hook_event_name")
        self.event = event if isinstance(event, str) else ""
        self.session_id = _required_identifier(
            hook_input.get("session_id"), "session_id"
        )

    def execute(self, background: bool) -> int:
        if background:
            return self._background()
        handlers = {
            "Interrupt": self._terminal,
            "SessionEnd": self._terminal,
            "UserPromptSubmit": self._prompt,
            "Stop": self._stop,
        }
        handler = handlers.get(self.event)
        if handler is None:
            raise ValueError("hook input has an unsupported hook_event_name")
        return handler()

    def _background(self) -> int:
        if self.config.dry_run:
            return 0
        self._require_credentials()
        handlers = {
            "Stop": self._background_stop,
            "SessionStart": self._background_recover,
            "UserPromptSubmit": self._background_recover,
        }
        handler = handlers.get(self.event)
        if handler is None:
            raise ValueError("hook input has an unsupported background event")
        handler()
        return 0

    def _background_stop(self) -> None:
        rollout = self._absolute_rollout()
        turn_id = _required_identifier(self.hook_input.get("turn_id"), "turn_id")
        if not await_capture(rollout, turn_id):
            raise ValueError("foreground capture has not completed")
        self._drain(rollout)

    def _background_recover(self) -> None:
        targets = list(
            registered_rollouts(
                self.plugin_data, delivery_context(self.config, self.cwd)
            )
        )
        transcript = self.hook_input.get("transcript_path")
        if isinstance(transcript, str) and Path(transcript).is_absolute():
            targets.append((Path(transcript).resolve(), self.session_id))
        failure: Exception | None = None
        for path, identifier in dict.fromkeys(targets):
            try:
                capture(
                    path,
                    self.config,
                    self.cwd,
                    identifier,
                    None,
                    self.plugin_data,
                )
                self._drain(path)
            except Exception as error:
                failure = error
        if failure is not None:
            raise failure

    def _drain(self, rollout: Path) -> None:
        drain(
            rollout,
            self.config,
            cwd=self.cwd,
            exporter=export_document,
            plugin_data=self.plugin_data,
        )

    def _terminal(self) -> int:
        if self.config.dry_run:
            return 0
        terminal_turn = (
            _required_identifier(self.hook_input.get("turn_id"), "turn_id")
            if self.event == "Interrupt"
            else None
        )
        record_terminal(
            self._absolute_rollout(),
            self.session_id,
            str(self.event),
            terminal_turn,
            self.config,
            self.plugin_data,
            cwd=self.cwd,
        )
        return 0

    def _prompt(self) -> int:
        if self.config.dry_run:
            return 0
        if self.plugin_data is None:
            raise ValueError("PLUGIN_DATA is unavailable for provisional attribution")
        turn_id = _required_identifier(self.hook_input.get("turn_id"), "turn_id")
        record_provisional_attribution_snapshot(
            self.plugin_data,
            self.session_id,
            turn_id,
            attribution_snapshot(self.config, self.cwd),
        )
        return 0

    def _stop(self) -> int:
        rollout = self._absolute_rollout()
        turn_id = _required_identifier(self.hook_input.get("turn_id"), "turn_id")
        if not self.config.dry_run:
            self._require_credentials()
            capture(
                rollout,
                self.config,
                self.cwd,
                self.session_id,
                turn_id,
                self.plugin_data,
            )
            return 0
        self._print_dry_run(rollout, turn_id)
        return 0

    def _print_dry_run(self, rollout: Path, turn_id: str) -> None:
        snapshots = {
            **load_attribution_snapshots(rollout),
            **load_capture_snapshots(rollout),
        }
        provisional = (
            load_provisional_attribution_snapshots(self.plugin_data, self.session_id)
            if self.plugin_data is not None
            else {}
        )
        current = snapshots.get(turn_id) or attribution_snapshot(self.config, self.cwd)
        effective = {**provisional, **snapshots, turn_id: current}
        document = trace_document(
            rollout, self.config, self.cwd, attribution_snapshots=effective
        )
        _complete_stop_turn(document, turn_id)
        json.dump(document, sys.stdout, separators=(",", ":"), sort_keys=True)
        sys.stdout.write("\n")

    def _absolute_rollout(self) -> Path:
        value = self.hook_input.get("transcript_path")
        if not isinstance(value, str) or not value:
            raise ValueError("hook input is missing transcript_path")
        rollout = Path(value)
        if not rollout.is_absolute():
            raise ValueError("transcript_path must name a readable absolute file")
        return rollout

    def _require_credentials(self) -> None:
        if not self.config.public_key or not self.config.secret_key:
            raise ValueError("Langfuse credentials are missing")


def main() -> None:
    status = run(background="--drain" in sys.argv[1:])
    if "--launcher-status" in sys.argv[1:]:
        # The private launcher receipt distinguishes a resolved result from
        # UV/import/startup failures, which remain fail-open by default.
        index = sys.argv.index("--launcher-status")
        Path(sys.argv[index + 1]).write_text(f"{status}\n", encoding="ascii")
    raise SystemExit(status)


if __name__ == "__main__":
    main()
