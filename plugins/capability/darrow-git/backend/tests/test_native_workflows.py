"""Observable native-platform acceptance at each public workflow seam."""

from pathlib import Path

import pytest

from darrow_git import branch, commit, evidence, pr
from darrow_git.process import RefusalError, git
from forge import Forge


def test_task_discovery_and_exact_reuse(
    repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    branch.run(["prepare", "fix/181-first", "--ticket-token", "181"], task=True)
    tip = git("rev-parse", "HEAD")
    git("switch", "main")
    branch.run(["discover", "--ticket-token", "181"], task=True)
    assert f"fix/181-first (at {tip})" in capsys.readouterr().out
    with pytest.raises(RefusalError, match="correlated local branches"):
        branch.run(["prepare", "fix/181-second", "--ticket-token", "181"], task=True)
    branch.run(["prepare", "fix/181-first", "--ticket-token", "181"], task=True)
    assert git("rev-parse", "HEAD") == tip
    branch.run(["prepare", "fix/181-first", "--ticket-token", "181"], task=True)
    assert "## mode: current" in capsys.readouterr().out


@pytest.mark.parametrize("task", [False, True])
def test_worktree_keeps_caller_work(
    repository: Path, capsys: pytest.CaptureFixture[str], task: bool
) -> None:
    (repository / "tracked.txt").write_text("dirty\n")
    operation = "prepare" if task else "create"
    branch.run(
        [operation, "fix/181-tree", "--ticket-token", "181", "--worktree"], task=task
    )
    tree = repository / ".worktrees" / "fix" / "181-tree"
    assert tree.is_dir()
    assert git("symbolic-ref", "--short", "HEAD") == "main"
    assert (repository / "tracked.txt").read_text() == "dirty\n"
    assert git("check-ignore", str(tree))
    if task:
        branch.run(
            [operation, "fix/181-tree", "--ticket-token", "181", "--worktree"],
            task=task,
        )
        assert "worktree-current" in capsys.readouterr().out


def test_commit_scope_and_retry(
    repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repository / "one.txt").write_text("staged")
    (repository / "two.txt").write_text("outside")
    git("add", "one.txt")
    commit.run(["inspect"])
    assert "mode: staged" in capsys.readouterr().out
    before = git("write-tree")
    with pytest.raises(RefusalError, match="a staged set exists"):
        commit.run(["commit", "-m", "feat: scope", "two.txt"])
    assert git("write-tree") == before
    (repository / "one.txt").write_text("corrected")
    commit.run(
        [
            "retry",
            "--after-hook-failure",
            "--refresh-staged",
            "one.txt",
            "-m",
            "feat: scope",
        ]
    )
    assert git("show", "HEAD:one.txt") == "corrected"
    assert git("status", "--short", "two.txt") == "?? two.txt"


def test_pr_creation_and_verification(
    remote: Path, forge: Forge, capsys: pytest.CaptureFixture[str]
) -> None:
    pr.run(["inspect"])
    assert "mode: ready" in capsys.readouterr().out
    pr.run(["create", "--title", "fix: publish scoped work", "-b", "Why\n\nWhat"])
    output = capsys.readouterr().out
    expected = git("rev-parse", "HEAD")
    assert "publication: verified" in output
    assert f"pr-commit: {expected}" in output
    assert forge.body == "Why\n\nWhat"
    assert (
        git("--git-dir", str(remote), "rev-parse", "refs/heads/fix/181-python-git")
        == expected
    )
    pr.run(["verify", "--expected-head", expected])
    assert "push: none" in capsys.readouterr().out
    with pytest.raises(RefusalError, match="already exists"):
        pr.run(["create", "--title", "fix: duplicate", "-b", "Why"])
    assert sum(call[:2] == ["pr", "create"] for call in forge.calls) == 1


@pytest.mark.parametrize("mode", ["propagating", "uncertain"])
def test_creation_observes_uncertainty(
    remote: Path, forge: Forge, capsys: pytest.CaptureFixture[str], mode: str
) -> None:
    forge.mode = mode
    pr.run(["create", "--title", "fix: reconcile publication", "-b", "Why"])
    assert "publication: verified" in capsys.readouterr().out
    assert sum(call[:2] == ["pr", "create"] for call in forge.calls) == 1


def test_evidence_identity_and_single_publication(
    remote: Path, forge: Forge, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    forge.created = True
    body = tmp_path / "body.md"
    body.write_text("Verified behavior.\n")
    image = tmp_path / "image.svg"
    image.write_text('<svg xmlns="http://www.w3.org/2000/svg"><text>Pass</text></svg>')
    args = [
        "publish",
        "--expected-head",
        git("rev-parse", "HEAD"),
        "--body-file",
        str(body),
        "--image",
        str(image),
        "--alt",
        "Verified result",
    ]
    with pytest.raises(SystemExit) as first:
        evidence.run(args)
    assert first.value.code == 0
    assert "outcome: published" in capsys.readouterr().out
    with pytest.raises(SystemExit) as second:
        evidence.run(args)
    assert second.value.code == 0
    assert "outcome: existing" in capsys.readouterr().out
    assert (
        sum(
            call[:2] == ["pr", "comment"] and "--help" not in call
            for call in forge.calls
        )
        == 1
    )
    assert image.is_file()
    assert git("status", "--porcelain") == ""
