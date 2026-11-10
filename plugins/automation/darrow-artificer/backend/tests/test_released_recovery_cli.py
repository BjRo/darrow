"""Released capacity does not discard an unfinished native delivery."""

import json
import os
import shutil
import time
from pathlib import Path

import pytest

from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


def initialize_worker(
    repository: Path,
    state: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    host: str = "codex",
) -> Installation:
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
    return Installation(state)


def stopped_delivery(
    repository: Path,
    state: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> Installation:
    site = initialize_worker(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    wait_stopped(site)
    invoke(monkeypatch, capsys, state, "tick")
    assert site.claims()[0].status == "released"
    return site


def test_released_delivery_can_resume_original_session_after_blocker_resolution(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_ACTIVE_RESUME", "1")
    invoke(
        monkeypatch,
        capsys,
        state,
        "recover",
        original.id,
        "--thread",
        original.native.thread,
    )
    recovered = wait_stopped(site)
    assert recovered.status == "pr-open"
    assert recovered.native == original.native
    assert recovered.worktree == original.worktree
    assert recovered.total_recovery_attempts == 1
    forge = json.loads((services / "forge.json").read_text())
    assert forge["claimed"] == [1]
    assert recovered.pr == 9


@pytest.mark.parametrize("limit", [0, 1])
def test_released_recovery_must_reacquire_shared_capacity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    limit: int,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    if limit:
        forge = json.loads((services / "forge.json").read_text())
        forge["ready"] = [2]
        (services / "forge.json").write_text(json.dumps(forge))
        other = tmp_path / "other"
        other_site = initialize_worker(repository, other, monkeypatch, capsys)
        invoke(monkeypatch, capsys, other, "tick")
        wait_stopped(other_site)
    invoke(
        monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", str(limit)
    )
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "capacity" in capsys.readouterr().err
    assert site.claim(original.id).status == "released"
    assert site.claim(original.id).total_recovery_attempts == 0


@pytest.mark.parametrize("change", ["writer", "scope"])
def test_released_recovery_rechecks_current_authority(
    repository: Path,
    services: Path,
    tmp_path: Path,
    change: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    if change == "writer":
        monkeypatch.setattr(GitHub, "writable", lambda *args: False)
    else:
        grant = site.grant
        grant.issue_scope = [2]
        site.save_grant(grant)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert change in capsys.readouterr().err
    assert site.claim(original.id).status == "released"
    assert site.claim(original.id).total_recovery_attempts == 0


@pytest.mark.parametrize("ownership", ["label", "delivery", "nomination"])
def test_released_recovery_refuses_conflicting_issue_ownership(
    repository: Path,
    services: Path,
    tmp_path: Path,
    ownership: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    forge = json.loads((services / "forge.json").read_text())
    forge["claimed" if ownership == "label" else "ready"] = [1]
    (services / "forge.json").write_text(json.dumps(forge))
    if ownership == "delivery":
        other = tmp_path / "other"
        other_site = initialize_worker(repository, other, monkeypatch, capsys)
        invoke(monkeypatch, capsys, other, "tick")
        wait_stopped(other_site)
    invoke(monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", "3")
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "ownership" in capsys.readouterr().err
    assert site.claim(original.id).status == "released"
    assert site.claim(original.id).total_recovery_attempts == 0


def test_released_recovery_requires_original_worktree_before_reserving_capacity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    shutil.rmtree(original.worktree)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "Original worktree unavailable" in capsys.readouterr().err
    assert site.claim(original.id).status == "released"
    assert site.claim(original.id).total_recovery_attempts == 0
    assert json.loads((services / "forge.json").read_text())["claimed"] == []


@pytest.mark.parametrize("publication", ["unavailable", "closed"])
def test_released_recovery_reconciles_publication_before_resuming(
    repository: Path,
    services: Path,
    tmp_path: Path,
    publication: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    if publication == "unavailable":
        monkeypatch.setenv("ARTIFICER_PUBLICATION_UNAVAILABLE", "1")
    else:
        forge = json.loads((services / "forge.json").read_text())
        forge["pr"] = {
            "number": 9,
            "state": "closed",
            "head": {"ref": original.branch, "repo": {"full_name": "o/r"}},
            "base": {"ref": "main"},
        }
        (services / "forge.json").write_text(json.dumps(forge))
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "publication" in capsys.readouterr().err
    assert site.claim(original.id).status == "released"
    assert site.claim(original.id).total_recovery_attempts == 0
    assert json.loads((services / "forge.json").read_text())["claimed"] == []


@pytest.mark.parametrize("disposition", ["cancelled", "completed", "unknown"])
def test_terminal_or_unknown_deliveries_cannot_resume_after_release(
    repository: Path,
    services: Path,
    tmp_path: Path,
    disposition: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize_worker(repository, state, monkeypatch, capsys)
    if disposition == "completed":
        monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    invoke(monkeypatch, capsys, state, "tick")
    original = wait_stopped(site)
    assert original.native is not None
    if disposition == "cancelled":
        invoke(monkeypatch, capsys, state, "cancel", original.id)
    elif disposition == "completed":
        forge = json.loads((services / "forge.json").read_text())
        forge["pr"]["state"] = "closed"
        (services / "forge.json").write_text(json.dumps(forge))
    invoke(monkeypatch, capsys, state, "tick")
    assert site.claim(original.id).status == "released"
    if disposition == "unknown":
        path = site.claim_path(original.id)
        value = json.loads(path.read_text())
        del value["resume_allowed"]
        path.write_text(json.dumps(value))
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "terminal or its recovery eligibility is unknown" in capsys.readouterr().err
    assert site.claim(original.id).total_recovery_attempts == 0


def test_uncertain_previous_launch_cannot_be_recovered_again(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    original.status = "reserved"
    original.execution_ended = False
    original.process = None
    site.save(original)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "Execution identity unavailable" in capsys.readouterr().err
    assert site.claim(original.id).total_recovery_attempts == 0


def test_resolved_preflight_blocker_can_activate_first_goal_in_original_session(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
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
        "claude",
        "--authorize-recurring-delivery",
    )
    site = Installation(state)
    invoke(monkeypatch, capsys, state, "tick")
    original = wait_stopped(site)
    assert original.native is not None
    assert original.goal_objective is None
    invoke(monkeypatch, capsys, state, "tick")
    assert site.claim(original.id).status == "released"
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    monkeypatch.setenv("ARTIFICER_GOAL_MODE", "prepared-on-resume")
    invoke(
        monkeypatch,
        capsys,
        state,
        "recover",
        original.id,
        "--thread",
        original.native.thread,
    )
    recovered = wait_stopped(site)
    assert recovered.native == original.native
    assert recovered.goal_objective == (
        "Deliver the prepared ready ticket under the original grant"
    )
    handshake = json.loads((services / "goal-handshake.json").read_text())
    assert len(handshake) == 2
    assert all(item["resuming"] for item in handshake)
    assert len({item["identity"] for item in handshake}) == 1
    assert handshake[-1]["prompt"] == "/goal " + recovered.goal_objective


def test_cancel_can_end_released_but_resumable_work_without_reclaiming_capacity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = stopped_delivery(repository, state, monkeypatch, capsys)
    original = site.claims()[0]
    assert original.native is not None
    before = (services / "forge.json").read_text()
    result = invoke(monkeypatch, capsys, state, "cancel", original.id)
    assert result["status"] == "released"
    assert result["resume_allowed"] is False
    assert (services / "forge.json").read_text() == before
    assert Path(original.worktree).is_dir()
    assert site.claim(original.id).native == original.native
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "terminal or its recovery eligibility is unknown" in capsys.readouterr().err
    assert site.claim(original.id).total_recovery_attempts == 0


def test_failed_signal_does_not_erase_cancellation_when_native_worker_finishes(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize_worker(repository, state, monkeypatch, capsys, host="claude")
    monkeypatch.setenv("ARTIFICER_HOLD", "1")
    invoke(monkeypatch, capsys, state, "tick")
    deadline = time.monotonic() + 10
    while not (services / "session.txt").exists():
        assert time.monotonic() < deadline, "Original native worker did not start"
        time.sleep(0.02)
    original = site.claims()[0]
    assert original.native is not None

    def denied(group: int, signal: int) -> None:
        raise PermissionError("Operating system denied cancellation signal")

    monkeypatch.setattr(os, "killpg", denied)
    try:
        result = invoke(monkeypatch, capsys, state, "cancel", original.id)
        assert result["status"] == "needs-attention"
        assert result["resume_allowed"] is False
        assert "Cancellation was not confirmed" in str(result["detail"])
    finally:
        (services / "release-native").touch()
        finished = wait_stopped(site)
    assert finished.resume_allowed is False
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            original.id,
            "--thread",
            original.native.thread,
        )
    assert "terminal or its recovery eligibility is unknown" in capsys.readouterr().err
    assert site.claim(original.id).total_recovery_attempts == 0
