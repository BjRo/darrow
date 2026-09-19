"""Exercise the installed public command against real Git repositories."""

import subprocess
from pathlib import Path

import pytest

from darrow_git.branch import run
from darrow_git.process import RefusalError


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


@pytest.fixture
def repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.chdir(tmp_path)
    git("init", "-q", "-b", "main")
    git("config", "user.name", "Fixture")
    git("config", "user.email", "fixture@example.test")
    git("commit", "-q", "--allow-empty", "-m", "chore: initialize")
    return tmp_path


def test_create_preserves_work(
    repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repository / "outside.txt").write_text("local work", encoding="utf-8")
    run(["create", "refactor/181-python-git", "--ticket-token", "181"])
    assert capsys.readouterr().out == "refactor/181-python-git (from main)\n"
    assert git("symbolic-ref", "--short", "HEAD") == "refactor/181-python-git"
    assert (repository / "outside.txt").read_text() == "local work"
    assert git("stash", "list") == ""


def test_collision_preserves_tip(repository: Path) -> None:
    git("branch", "feat/existing-work")
    before = git("rev-parse", "refs/heads/feat/existing-work")
    with pytest.raises(RefusalError) as error:
        run(["create", "feat/existing-work"])
    assert error.value.code == 9
    assert git("rev-parse", "refs/heads/feat/existing-work") == before
    assert git("symbolic-ref", "--short", "HEAD") == "main"
