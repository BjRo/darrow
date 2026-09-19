"""Nonsecret, immutable authorization boundary for durable delivery work."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .config import Config


def delivery_context(config: Config, cwd: str) -> dict[str, Any]:
    destination = json.dumps(
        [config.base_url.rstrip("/"), config.public_key], separators=(",", ":")
    )
    return {
        "version": 1,
        "project": str(Path(cwd).resolve()),
        "project_config": str(
            (Path(cwd) / ".codex" / "darrow-langfuse.json").resolve()
        ),
        "user_config": str(
            (
                Path(os.environ.get("HOME") or Path.home())
                / ".codex"
                / "darrow-langfuse.json"
            ).resolve()
        ),
        "destination": hashlib.sha256(destination.encode()).hexdigest(),
    }


def require_context(saved: Any, current: dict[str, Any]) -> None:
    if saved != current:
        raise ValueError(
            "Langfuse delivery context is missing or differs; preserve local work for reconciliation"
        )
