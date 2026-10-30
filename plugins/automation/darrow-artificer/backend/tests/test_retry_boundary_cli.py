"""Retry incidents reset at native turn completion, never incidental tool reads."""

import json
import shutil
from pathlib import Path

import pytest

from darrow_artificer.installation import Installation
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_successful_tool_read_does_not_renew_interruption_budget(
    host: str,
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (services / "interruptions.json").write_text(
        json.dumps({"failures": 3, "starts": [], "progress_on": 2})
    )
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    starts = json.loads((services / "interruptions.json").read_text())["starts"]
    assert claim.total_recovery_attempts == 2
    assert claim.recovery_attempts == 2
    assert claim.status == "needs-attention"
    assert "two attempts exhausted" in claim.detail
    assert len(starts) == 3
    assert len({item["identity"] for item in starts}) == 1
    assert [item["resuming"] for item in starts] == [False, True, True]


@pytest.mark.parametrize(("host", "launches"), [("codex", 4), ("claude", 5)])
def test_completed_native_turn_starts_a_new_interruption_budget(
    host: str,
    launches: int,
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    scripts = services / "python"
    shutil.copyfile(
        Path(__file__).with_name("service_stub.py"), scripts / "service_stub.py"
    )
    shutil.copyfile(Path(__file__).with_name("retry_boundary_host.py"), scripts / host)
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    starts = json.loads((services / "retry-turns.json").read_text())
    assert claim.total_recovery_attempts == 3
    assert claim.recovery_attempts == 0
    assert "Specification needed" in claim.detail
    assert len(starts) == launches
    assert len({item["identity"] for item in starts}) == 1
    assert [item["resuming"] for item in starts] == [False] + [True] * (launches - 1)


def test_malformed_completed_turn_cannot_renew_interruption_budget(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_MALFORMED_RETRY_TURN", "1")
    scripts = services / "python"
    shutil.copyfile(
        Path(__file__).with_name("service_stub.py"), scripts / "service_stub.py"
    )
    shutil.copyfile(
        Path(__file__).with_name("retry_boundary_host.py"), scripts / "codex"
    )
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    starts = json.loads((services / "retry-turns.json").read_text())
    assert claim.total_recovery_attempts == 2
    assert claim.recovery_attempts == 2
    assert "two attempts exhausted" in claim.detail
    assert len(starts) == 3
