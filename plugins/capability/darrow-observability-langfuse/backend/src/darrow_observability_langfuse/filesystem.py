"""Portable durability helpers for plugin-owned state."""

from __future__ import annotations

import os
from pathlib import Path


def sync_directory(path: Path) -> None:
    if os.name == "nt":  # pragma: no cover - Windows cannot open directories this way.
        return
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
