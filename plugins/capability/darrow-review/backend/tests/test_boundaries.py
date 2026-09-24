from __future__ import annotations

import os
import signal
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import pytest

from darrow_review import check, cli, common, scope
from darrow_review.common import ReviewError
from darrow_review.records import Records


def test_check_capture_and_refusals(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(repo)
    command = 'Write-Output "checked"' if os.name == "nt" else 'printf "checked\\n"'
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    manifest = Records(scope.prepare(scope.ScopeOptions(str(repo), "HEAD", "WORKTREE")))
    path = Path(manifest.value("manifest")).parent / "check.tsv"
    output = cli.check_command(["run", "--output", str(path), "--command", command])
    assert str(path) in output
    assert "applicable\tpass\texited 0: checked" in path.read_text(encoding="utf-8")
    with pytest.raises(ReviewError, match="already exists"):
        check.capture(str(path), command)
    for output_path, value in (
        (str(tmp_path / "outside"), command),
        ("relative", command),
        (str(path), "bad\ncommand"),
    ):
        with pytest.raises(ReviewError):
            check.capture(output_path, value)
    assert check.execute("exit 9")[0] == 9
    assert check.execute("exit 0") == (0, "no output")
    assert check.execute("darrow-missing-command-182")[0] != 0


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX shell stream and signal contract; PowerShell exercised natively in CI",
)
def test_ordered_check_output_and_signal_status() -> None:
    assert check.execute('printf "first\\tline\\r\\n" >&2; printf "second\\n"') == (
        0,
        "first line",
    )
    assert check.execute("kill -TERM $$")[0] == 143


def test_missing_shell(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BASH", raising=False)
    monkeypatch.setattr("shutil.which", lambda _name: None)
    assert check.execute("check")[0] == 127


def test_route_help() -> None:
    assert "usage: review-route" in cli.route_command(["--help"])


@pytest.mark.parametrize(
    "entry",
    [
        cli.review_scope,
        cli.review_result,
        cli.review_report,
        cli.review_check,
        cli.review_route,
        cli.review_claude_verify,
        cli.claude_provider,
    ],
)
def test_entrypoint_usage(
    entry: Callable[[], None],
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(sys, "argv", ["command"])
    with pytest.raises(SystemExit) as error:
        entry()
    assert error.value.code == 2
    assert capsys.readouterr().err


def test_boundary_success_and_errors(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["claude-provider", "observe-direct"])
    cli.claude_provider()
    assert "anthropic" in capsys.readouterr().out
    cli.boundary("binary", lambda _args: b"bytes\n")
    assert capsys.readouterr().out == "bytes\n"

    def missing(_args: list[str]) -> str:
        raise FileNotFoundError("unavailable")

    with pytest.raises(SystemExit) as error:
        cli.boundary("test", missing)
    assert error.value.code == 2
    assert "unavailable" in capsys.readouterr().err

    def interrupt(_args: list[str]) -> str:
        raise KeyboardInterrupt

    with pytest.raises(SystemExit) as error:
        cli.boundary("test", interrupt)
    assert error.value.code == 130
    with pytest.raises(SystemExit) as error:
        cli.terminate(signal.SIGTERM, None)
    assert error.value.code == 143


def test_process_cancellation_reaps_child(monkeypatch: pytest.MonkeyPatch) -> None:
    original = subprocess.Popen.communicate
    observed: list[subprocess.Popen[bytes]] = []

    def cancelled(
        process: subprocess.Popen[bytes], *args: object, **kwargs: object
    ) -> tuple[bytes, bytes]:
        observed.append(process)
        raise KeyboardInterrupt

    monkeypatch.setattr(subprocess.Popen, "communicate", cancelled)
    stop = common.stop_process

    def terminate(process: subprocess.Popen[bytes]) -> None:
        monkeypatch.setattr(subprocess.Popen, "communicate", original)
        stop(process)

    monkeypatch.setattr(common, "stop_process", terminate)
    with pytest.raises(KeyboardInterrupt):
        common.run([sys.executable, "-c", "import time; time.sleep(60)"])
    assert observed[0].poll() is not None
    stop(observed[0])


def test_artifact_cleanup_after_failure(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("changed", encoding="utf-8")

    def fail(*_args: object) -> str:
        raise OSError("disk failure")

    monkeypatch.setattr(scope, "write_scope", fail)
    with pytest.raises(OSError):
        scope.prepare(scope.ScopeOptions(str(repo), "HEAD", "WORKTREE"))
    state = Path(os.environ["DARROW_REVIEW_STATE_DIR"])
    assert not list(state.glob("*/darrow-review.*"))
