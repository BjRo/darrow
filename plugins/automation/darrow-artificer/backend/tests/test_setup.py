import shutil
import subprocess
from pathlib import Path

import pytest

from darrow_artificer import setup
from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation


def test_primary_checkout_and_initialization(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    subprocess.run(["git", "init", "-q", str(repository)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "remote",
            "add",
            "origin",
            "https://github.com/o/r.git",
        ],
        check=True,
    )
    git = setup.executable("git")
    assert setup.primary_checkout(git, repository) == repository.resolve()
    monkeypatch.setattr(GitHub, "login", lambda self: "writer")
    monkeypatch.setattr(GitHub, "writable", lambda *args: True)
    monkeypatch.setattr(setup, "executable", lambda name: git)
    site = Installation(tmp_path / "installation")
    grant = setup.initialize(
        site, repository, "o/r", [], tmp_path, "gpt-5.6-terra", "medium", [157]
    )
    assert grant.issue_scope == [157]
    site.verify_binding()
    assert (site.root / "archive.key").stat().st_mode & 0o777 == 0o600
    with pytest.raises(ValueError, match="already exists"):
        setup.bind(site, grant)
    with pytest.raises(ValueError, match="Origin"):
        setup.initialize(
            Installation(tmp_path / "other"),
            repository,
            "other/r",
            [],
            tmp_path,
            "m",
            "medium",
            [],
        )
    monkeypatch.setattr(GitHub, "writable", lambda *args: False)
    with pytest.raises(ValueError, match="write access"):
        setup.initialize(site, repository, "o/r", [], tmp_path, "m", "medium", [])


def test_missing_executable_and_bad_git_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(ValueError, match="executable"):
        setup.executable("codex")
    monkeypatch.setattr(setup, "git_output", lambda *args: "invalid")
    with pytest.raises(ValueError, match="primary"):
        setup.primary_checkout("git", tmp_path)


def test_labels_only_create_missing(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        GitHub, "collection", lambda *args: [{"name": "artificer:ready"}]
    )
    calls: list[object] = []
    monkeypatch.setattr(GitHub, "request", lambda *args: calls.append(args))
    setup.labels(installation)
    assert len(calls) == 1 and "artificer:claimed" in str(calls)
