"""Readiness retains its selected base, degraded context, and refusal modes."""

from pathlib import Path

import pytest

from darrow_git import pr, pr_repository
from darrow_git.process import RefusalError, git
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


def test_diff_uses_inspected_commits_and_literal_paths(
    remote: Path,
    repository: Path,
    forge: Forge,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    git("push", "origin", "main:refs/heads/release")
    (repository / "literal [1].txt").write_text("committed\n", encoding="utf-8")
    git("add", "literal [1].txt")
    git("commit", "-qm", "feat: add literal path")
    pr.run(["inspect", "--base", "release"])
    context = capsys.readouterr().out
    assert "## base branch (selected): release" in context
    fields = dict(line.split(": ", 1) for line in context.splitlines() if ": " in line)
    comparison = fields["## comparison commit"]
    head = fields["## intended commit"]
    assert comparison == git("rev-parse", "origin/release")
    assert head == git("rev-parse", "HEAD")

    (repository / "literal [1].txt").write_text("later commit\n", encoding="utf-8")
    git("commit", "-qam", "feat: change literal path")
    git("update-ref", "refs/remotes/origin/release", head)
    (repository / "literal [1].txt").write_text("dirty\n", encoding="utf-8")
    child = repository / "child"
    child.mkdir()
    monkeypatch.chdir(child)
    status = git("status", "--porcelain")
    forge.calls.clear()
    pr.run(["diff", comparison, head, "literal [1].txt"])
    patch = capsys.readouterr().out
    assert "+committed" in patch
    assert "tracked.txt" not in patch
    assert "later commit" not in patch
    assert "dirty" not in patch
    assert git("status", "--porcelain") == status
    assert forge.calls == []


def test_diff_bounds_output(
    remote: Path, repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repository / "tracked.txt").write_text(
        "long line\n" * 250 + "last line\n", encoding="utf-8"
    )
    git("commit", "-qam", "feat: grow tracked file")
    pr.run(["diff", git("rev-parse", "origin/main"), git("rev-parse", "HEAD")])
    patch = capsys.readouterr().out
    assert "+long line" in patch
    assert "last line" not in patch
    assert "## note: diff truncated" in patch


def test_diff_rejects_symbolic_arguments(repository: Path) -> None:
    with pytest.raises(RefusalError, match="requires the full"):
        pr.run(["diff", git("rev-parse", "HEAD"), "HEAD"])
