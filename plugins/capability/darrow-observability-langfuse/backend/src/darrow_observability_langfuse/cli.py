from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from .config import Config, load_config
from .export import export_document
from .rollout import trace_document
from .sidecar import mark_exported_turns, pending_document


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
        document = trace_document(Path(transcript_path), config, cwd)
        if config.dry_run:
            json.dump(document, sys.stdout, separators=(",", ":"), sort_keys=True)
            sys.stdout.write("\n")
            return 0
        if not config.public_key or not config.secret_key:
            raise ValueError("Langfuse credentials are missing")
        rollout = Path(transcript_path)
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
