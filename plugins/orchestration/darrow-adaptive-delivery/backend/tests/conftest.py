from __future__ import annotations

import os
from pathlib import Path

import pytest

from darrow_adaptive_delivery.common import git


@pytest.fixture(autouse=True)
def environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    for key in tuple(os.environ):
        if key.startswith(("GIT_", "CLAUDE_CODE_")) or key == "ANTHROPIC_BASE_URL":
            monkeypatch.delenv(key)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    path = tmp_path / "repo with spaces-é"
    path.mkdir()
    git(path, "init", "-qb", "main")
    git(path, "config", "user.name", "Fixture")
    git(path, "config", "user.email", "fixture@example.invalid")
    git(path, "config", "core.autocrlf", "false")
    (path / "value.txt").write_bytes(b"before\n")
    git(path, "add", ".")
    git(path, "commit", "-qm", "fixture")
    (path / ".git/fixture-state").mkdir()
    return path.resolve()
