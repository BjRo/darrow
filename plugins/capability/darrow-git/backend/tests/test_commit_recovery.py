"""Hook failures preserve exact index snapshots and bound remediation."""

import os
import shlex
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

from darrow_git import cli, commit, remediation
from darrow_git.process import RefusalError, git, invoke


def stage(repository: Path) -> tuple[str, str]:
    (repository / "tracked.txt").write_text("stale")
    git("add", "tracked.txt")
    (repository / "outside.txt").write_text("outside")
    return git("rev-parse", "HEAD"), git("write-tree")


def correction(tmp_path: Path, source: str) -> str:
    script = tmp_path / "corrector with spaces.py"
    script.write_text(source, encoding="utf-8")
    args = [sys.executable, str(script)]
    return subprocess.list2cmdline(args) if os.name == "nt" else shlex.join(args)


def remediate_args(command: str) -> list[str]:
    return [
        "remediate",
        "--after-hook-failure",
        "--command",
        command,
        "--refresh-staged",
        "tracked.txt",
        "-m",
        "fix: correct staged file",
    ]


@pytest.mark.parametrize(
    "diagnostic", [b"hook failed\n", b"hook failed: Datei f\xfc r\n"]
)
def test_failed_hook_restores_index(
    repository: Path, monkeypatch: pytest.MonkeyPatch, diagnostic: bytes
) -> None:
    before_head, before_tree = stage(repository)

    def failed(
        args: Sequence[str],
        *,
        cwd: Path | None = None,
        input_bytes: bytes | None = None,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[bytes]:
        if list(args[:2]) == ["git", "commit"]:
            git("add", "outside.txt")
            return subprocess.CompletedProcess(args, 1, b"", diagnostic)
        return invoke(args, cwd=cwd, input_bytes=input_bytes, env=env)

    monkeypatch.setattr(commit, "invoke", failed)
    with pytest.raises(RefusalError, match="hook failed") as error:
        cli.run_commit(["commit", "-m", "fix: attempt change"])
    assert error.value.code == 4
    assert git("rev-parse", "HEAD") == before_head
    assert git("write-tree") == before_tree
    assert remediation.read_state() == (
        before_head,
        before_tree,
        diagnostic.decode("utf-8", errors="surrogateescape"),
    )


@pytest.mark.parametrize(
    "effect,code,message",
    [
        ("Path('tracked.txt').write_text('corrected')", 0, ""),
        (
            "subprocess.run(['git', 'add', 'outside.txt'], check=True)",
            7,
            "changed the index",
        ),
        (
            "subprocess.run(['git', 'commit', '-qm', 'fix: concurrent'], check=True)",
            8,
            "changed HEAD",
        ),
        ("sys.stderr.write('correction failed'); sys.exit(1)", 4, "correction failed"),
    ],
)
def test_remediation_effects(
    repository: Path, tmp_path: Path, effect: str, code: int, message: str
) -> None:
    before_head, before_tree = stage(repository)
    command = correction(
        tmp_path, "from pathlib import Path\nimport subprocess, sys\n" + effect
    )
    commit.save_failure("run: " + command, before_head, before_tree)
    if code:
        with pytest.raises(RefusalError, match=message) as error:
            cli.run_commit(remediate_args(command))
        assert error.value.code == code
    else:
        cli.run_commit(remediate_args(command))
        assert git("show", "HEAD:tracked.txt") == "corrected"
    assert (repository / "outside.txt").read_text() == "outside"
    if code == 7:
        assert git("write-tree") == before_tree
        assert git("rev-parse", "HEAD") == before_head


def test_remediation_refusals(repository: Path) -> None:
    before_head, before_tree = stage(repository)
    with pytest.raises(RefusalError, match="no readable"):
        cli.run_commit(remediate_args("unknown"))
    commit.failure_path().write_text("broken")
    with pytest.raises(RefusalError, match="invalid"):
        remediation.read_state()
    commit.save_failure("run: known", "deadbeef", before_tree)
    with pytest.raises(RefusalError, match="invalid"):
        remediation.read_state()
    commit.save_failure("run: known", before_head, "deadbeef")
    with pytest.raises(RefusalError, match="invalid"):
        remediation.read_state()
    commit.save_failure("run: known", before_head, before_tree)
    with pytest.raises(RefusalError, match="not present"):
        cli.run_commit(remediate_args("unknown"))
    git("add", "outside.txt")
    with pytest.raises(RefusalError, match="state changed"):
        cli.run_commit(remediate_args("known"))


def test_unstaged_inspect_and_diff(
    repository: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (repository / "tracked.txt").write_text("different")
    (repository / "new.txt").write_text("new content")
    cli.run_commit(["inspect"])
    assert "mode: unstaged" in capsys.readouterr().out
    cli.run_commit(["diff", "tracked.txt", "new.txt"])
    assert "new content" in capsys.readouterr().out
    cli.run_commit(["commit", "-m", "feat: explicit paths", "new.txt"])
    assert git("show", "HEAD:new.txt") == "new content"
    assert git("diff", "--name-only") == "tracked.txt"
