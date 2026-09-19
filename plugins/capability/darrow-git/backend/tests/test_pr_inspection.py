"""Readiness retains its selected base, degraded context, and refusal modes."""

from pathlib import Path

import pytest

from darrow_git import pr, pr_repository
from darrow_git.process import git
from forge import Forge


def test_readiness_modes(
    remote: Path,
    repository: Path,
    forge: Forge,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    forge.created = True
    pr.run(["inspect"])
    assert "mode: exists" in capsys.readouterr().out
    forge.created = False
    forge.mode = "unavailable"
    pr.run(["inspect"])
    assert "could not check for an existing" in capsys.readouterr().out
    (repository / "PULL_REQUEST_TEMPLATE.md").write_text("## Why\n")
    monkeypatch.setattr("shutil.which", lambda name: None)
    pr.run(["inspect"])
    assert "gh CLI not found" in capsys.readouterr().out
    git("switch", "-c", "feat/empty", "main")
    pr.run(["inspect"])
    assert "mode: no-commits" in capsys.readouterr().out
    git("switch", "main")
    pr.run(["inspect"])
    assert "on the default branch" in capsys.readouterr().out
    git("checkout", "--detach", "HEAD")
    pr.run(["inspect"])
    assert "detached HEAD" in capsys.readouterr().out


def test_conflict_and_empty(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (repository / ".git" / "MERGE_HEAD").touch()
    pr.run(["inspect"])
    assert "mode: conflict" in capsys.readouterr().out
    empty = tmp_path / "empty"
    empty.mkdir()
    monkeypatch.chdir(empty)
    git("init", "-qb", "main")
    pr.run(["inspect"])
    assert "mode: empty" in capsys.readouterr().out


def test_default_resolution(
    remote: Path, forge: Forge, capsys: pytest.CaptureFixture[str]
) -> None:
    git("symbolic-ref", "--delete", "refs/remotes/origin/HEAD")
    assert pr_repository.default_branch() == ("main", "remote")
    git("remote", "set-url", "origin", str(remote.parent / "missing.git"))
    assert pr_repository.default_branch() == ("main", "guess")
    pr.run(["inspect"])
    assert "default branch guessed" in capsys.readouterr().out
    git("branch", "-d", "main")
    assert pr_repository.default_branch() == ("(none)", "guess")
    pr.run(["inspect"])
    assert "mode: ready" in capsys.readouterr().out
