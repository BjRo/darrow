"""Cache location contract for the bundled ticket launcher."""

from __future__ import annotations

import importlib.util
from collections.abc import Callable, Mapping
from pathlib import Path
from types import ModuleType
from typing import cast


def load_launcher() -> ModuleType:
    path = Path(__file__).resolve().parents[1] / "scripts" / "run_locked.py"
    spec = importlib.util.spec_from_file_location("darrow_tickets_launcher", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_default_cache_root_and_override() -> None:
    module = load_launcher()
    cache_root = cast(
        Callable[[Mapping[str, str], str], str], module.resolve_cache_root
    )

    assert cache_root(
        {"HOME": "/home/user", "XDG_CACHE_HOME": "/tmp/xdg"}, "posix"
    ) == ("/home/user/.darrow/cache")
    assert cache_root({"LOCALAPPDATA": r"C:\Users\User\AppData\Local"}, "nt") == (
        r"C:\Users\User\AppData\Local\Darrow\Cache"
    )
    assert cache_root({"DARROW_CACHE_DIR": "/tmp/darrow"}, "posix") == "/tmp/darrow"
