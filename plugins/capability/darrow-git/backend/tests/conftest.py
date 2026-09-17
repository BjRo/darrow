"""Native Git fixtures and a deterministic, in-process GitHub boundary."""

import importlib
import os
from pathlib import Path

import pytest

from darrow_git import process
from darrow_git.process import git
from forge import Forge


@pytest.fixture
def repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "repository with spaces"
    path.mkdir()
    monkeypatch.chdir(path)
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    git("init", "-q", "-b", "main")
    git("config", "user.name", "Fixture")
    git("config", "user.email", "fixture@example.test")
    git("config", "commit.gpgsign", "false")
    (path / "tracked.txt").write_text("base\n", encoding="utf-8")
    git("add", "tracked.txt")
    git("commit", "-q", "-m", "chore: initialize")
    return path


@pytest.fixture
def remote(repository: Path, tmp_path: Path) -> Path:
    path = tmp_path / "origin.git"
    git("init", "-q", "--bare", str(path))
    git("--git-dir", str(path), "symbolic-ref", "HEAD", "refs/heads/main")
    git("remote", "add", "origin", str(path))
    git("push", "-qu", "origin", "main")
    git("remote", "set-head", "origin", "main")
    git("switch", "-qc", "fix/181-python-git")
    (repository / "tracked.txt").write_text("feature\n", encoding="utf-8")
    git("commit", "-qam", "fix: change feature")
    return path


@pytest.fixture
def forge(monkeypatch: pytest.MonkeyPatch) -> Forge:
    fixture = Forge()
    source = Path(process.__file__).parent
    for path in source.glob("*.py"):
        module = importlib.import_module(f"darrow_git.{path.stem}")
        if hasattr(module, "invoke"):
            monkeypatch.setattr(module, "invoke", fixture.invoke)
    monkeypatch.setattr("shutil.which", lambda name: f"/fixture/{name}")
    monkeypatch.setattr("darrow_git.publication.time.sleep", lambda seconds: None)
    return fixture
