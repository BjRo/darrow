"""Real worktree identity, conflict, and failure-state contracts."""

from pathlib import Path

import pytest

from darrow_git import branch, names, worktree
from darrow_git.branch_options import BranchOptions
from darrow_git.process import RefusalError, git
from darrow_git.repository import parse_worktree


def test_inspection_context(
    repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    branch.run(["inspect"])
    assert "## current branch: main" in capsys.readouterr().out
    branch.run(["inspect"], task=True)
    assert "## local branches" in capsys.readouterr().out
    (repository / ".git" / "MERGE_HEAD").touch()
    branch.run(["inspect"])
    assert "mode: conflict" in capsys.readouterr().out
    with pytest.raises(RefusalError) as error:
        branch.run(["create", "feat/no-conflict"])
    assert error.value.code == 8
    (repository / ".git" / "MERGE_HEAD").unlink()
    git("checkout", "--detach", "HEAD")
    branch.run(["inspect"])
    assert "detached @" in capsys.readouterr().out


def test_existing_worktree_and_deliberate_base(
    repository: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    git("branch", "fix/181-existing")
    path = tmp_path / "other checkout"
    args = [
        "prepare",
        "fix/181-existing",
        "--ticket-token",
        "181",
        "--worktree",
        "--at",
        str(path),
    ]
    branch.run(args, task=True)
    assert "worktree-reused" in capsys.readouterr().out
    branch.run(["inspect"])
    assert str(path) in capsys.readouterr().out
    branch.run(args, task=True)
    assert "worktree-current" in capsys.readouterr().out
    with pytest.raises(RefusalError, match="another worktree"):
        branch.run([*args[:-1], str(tmp_path / "different")], task=True)
    branch.run(["create", "feat/from-main", "--from", "main"])
    assert "from main" in capsys.readouterr().out


def test_absent_exclude_and_case_collision(repository: Path) -> None:
    exclude = repository / ".git" / "info" / "exclude"
    exclude.unlink()
    branch.run(
        ["prepare", "fix/181-new", "--ticket-token", "181", "--worktree"], task=True
    )
    assert exclude.read_text() == "/.worktrees/\n"
    git("branch", "fix/DAR-2-work")
    with pytest.raises(RefusalError, match="only by case"):
        branch.run(["prepare", "fix/dar-2-work", "--ticket-token", "dar-2"], task=True)


def test_failed_task_worktree_cleans_only_empty_parents(
    repository: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = git

    def fail_add(*args: str) -> str:
        if args[:2] == ("worktree", "add"):
            raise RefusalError("simulated add failure")
        return original(*args)

    monkeypatch.setattr(worktree, "git", fail_add)
    with pytest.raises(RefusalError, match="simulated"):
        branch.run(
            ["prepare", "fix/181-new", "--ticket-token", "181", "--worktree"], task=True
        )
    assert not (repository / ".worktrees").exists()
    assert git("symbolic-ref", "--short", "HEAD") == "main"
    allocation = worktree.Allocation(repository / "file", created_parents=[repository])
    worktree.cleanup_parents(allocation)
    assert repository.exists()


def test_filesystem_preflight_refuses(
    repository: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repository / ".worktrees").write_text("not a directory")
    with pytest.raises(RefusalError, match="parent dir"):
        worktree.prepare_allocation(
            BranchOptions(name="fix/181-work", worktree=True), True
        )
    (repository / ".worktrees").unlink()
    monkeypatch.setattr("os.access", lambda path, mode: False)
    with pytest.raises(RefusalError, match="unreadable"):
        worktree.prepare_allocation(
            BranchOptions(name="fix/181-work", worktree=True), True
        )
    assert not (repository / ".worktrees").exists()


def test_discovery_failure_is_not_zero(
    repository: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def failure(*args: str) -> str:
        raise RefusalError("enumeration failed")

    monkeypatch.setattr(names, "git", failure)
    with pytest.raises(RefusalError, match="cannot enumerate") as error:
        names.discover("181")
    assert error.value.code == 3


def test_worktree_porcelain_preserves_special_modes() -> None:
    assert parse_worktree("worktree /somewhere\ndetached").branch == "(detached)"
    assert parse_worktree("worktree /somewhere\nbare").branch == "(bare)"


def test_byte_valued_exclude_preserved(repository: Path) -> None:
    exclude = repository / ".git" / "info" / "exclude"
    original = b"# Latin-1 comment: f\xfc r\nlocal-only\n"
    exclude.write_bytes(original)
    branch.run(
        ["prepare", "fix/181-bytes", "--ticket-token", "181", "--worktree"], task=True
    )
    assert exclude.read_bytes() == original + b"/.worktrees/\n"
