"""Native protocol refusals remain blockers rather than new owners or retry loops."""

import json
import shutil
from pathlib import Path

import pytest

from test_management_cli import initialize
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


@pytest.mark.parametrize(
    ("mode", "expected"),
    [
        ("identity", "different native session"),
        ("missing-init", "lacks original native"),
        ("error-result", "execution interrupted"),
        ("invalid-result", "validation error"),
        ("empty", "session initialization unavailable"),
        ("user-text", "Specification needed"),
    ],
)
def test_native_protocol_refusals(
    repository: Path,
    services: Path,
    tmp_path: Path,
    mode: str,
    expected: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_CLAUDE_RESULT", mode)
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.status == "needs-attention"
    assert expected in claim.detail
    assert claim.total_recovery_attempts == 0


@pytest.mark.parametrize(
    ("mode", "expected"),
    [
        ("missing", "missing its prepared objective"),
        ("repeat", "activation was not established"),
    ],
)
def test_invalid_goal_activation_is_not_retried(
    repository: Path,
    services: Path,
    tmp_path: Path,
    mode: str,
    expected: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    monkeypatch.setenv("ARTIFICER_GOAL_MODE", mode)
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert expected in claim.detail
    assert claim.total_recovery_attempts == 0


def test_recovery_cannot_replace_the_original_goal(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.native is not None
    original = claim.goal_objective
    monkeypatch.setenv("ARTIFICER_GOAL_MODE", "always")
    invoke(
        monkeypatch, capsys, state, "recover", claim.id, "--thread", claim.native.thread
    )
    current = wait_stopped(site)
    assert "replace an existing goal" in current.detail
    assert current.goal_objective == original
    assert len(json.loads((services / "goal-handshake.json").read_text())) == 3


@pytest.mark.parametrize(
    ("mode", "expected"),
    [("missing", "no correlated PR"), ("closed", "requires an open reviewable PR")],
)
def test_incomplete_pr_result_cannot_establish_completion(
    repository: Path,
    services: Path,
    tmp_path: Path,
    mode: str,
    expected: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_PR_RESULT", mode)
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    assert expected in wait_stopped(site).detail


@pytest.mark.parametrize("mutation", ["identifier", "grant"])
def test_corrupt_delivery_identity_cannot_be_recovered(
    repository: Path,
    services: Path,
    tmp_path: Path,
    mutation: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    path = site.claim_path(claim.id)
    value = json.loads(path.read_text())
    value["id" if mutation == "identifier" else "grant"] = (
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
    path.write_text(json.dumps(value))
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch, capsys, state, "recover", claim.id, "--thread", "replacement"
        )
    assert "correlation" in capsys.readouterr().err


def test_recovery_never_recreates_missing_worktree(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.native is not None
    shutil.rmtree(claim.worktree)
    invoke(
        monkeypatch, capsys, state, "recover", claim.id, "--thread", claim.native.thread
    )
    current = wait_stopped(site)
    assert "Original worktree unavailable" in current.detail
    assert current.native == claim.native
    assert not Path(claim.worktree).exists()


def test_progress_before_an_interruption_does_not_add_retries(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (services / "interruptions.json").write_text(
        json.dumps({"failures": 3, "starts": [], "progress_on": 1})
    )
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    assert wait_stopped(site).total_recovery_attempts == 2
