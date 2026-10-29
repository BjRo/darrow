"""Regression examples from the independent review, through public commands."""

import json
import time
from pathlib import Path

import pytest

from darrow_artificer import processes
from darrow_artificer.github import array_value
from darrow_artificer.installation import Installation
from test_management_cli import initialize
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


@pytest.mark.parametrize("marked", [True, False])
def test_labeled_pr_without_local_claim_controls_wip(
    repository: Path,
    services: Path,
    tmp_path: Path,
    marked: bool,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    path = services / "forge.json"
    forge = json.loads(path.read_text())
    forge["pr"] = {
        "number": 9,
        "state": "open",
        "labels": ["artificer:claimed"] if marked else [],
        "head": {"ref": "existing-delivery", "repo": {"full_name": "o/r"}},
        "base": {"ref": "main"},
    }
    path.write_text(json.dumps(forge))
    observed = invoke(monkeypatch, capsys, state, "tick")
    if observed["admitted"]:
        wait_stopped(site)
    assert bool(observed["admitted"]) is not marked


def test_new_pr_receives_ownership_marker(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    assert wait_stopped(site).status == "pr-open"
    assert "artificer:claimed" in json.loads((services / "forge.json").read_text())[
        "pr"
    ].get("labels", [])


def wait_all(site: Installation) -> None:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if all(not processes.alive(claim.process) for claim in site.claims()):
            return
        time.sleep(0.02)
    raise AssertionError("Worker processes did not finish")


def test_reservation_and_labeled_pr_consume_one_slot(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", "2")
    invoke(monkeypatch, capsys, state, "tick")
    assert wait_stopped(site).pr == 9
    monkeypatch.delenv("ARTIFICER_COMPLETE")
    path = services / "forge.json"
    forge = json.loads(path.read_text())
    forge["ready"] = [2]
    path.write_text(json.dumps(forge))
    observed = invoke(monkeypatch, capsys, state, "tick")
    wait_all(site)
    assert len(array_value(observed["admitted"])) == 1


def test_recovery_refuses_another_active_ticket_in_same_worker(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", "2")
    invoke(monkeypatch, capsys, state, "tick")
    first = wait_stopped(site)
    assert first.native is not None
    path = services / "forge.json"
    forge = json.loads(path.read_text())
    forge["ready"] = [2]
    path.write_text(json.dumps(forge))
    monkeypatch.delenv("ARTIFICER_COMPLETE")
    monkeypatch.setenv("ARTIFICER_HOLD", "1")
    invoke(monkeypatch, capsys, state, "tick")
    second = next(claim for claim in site.claims() if claim.id != first.id)
    try:
        with pytest.raises(SystemExit):
            invoke(
                monkeypatch,
                capsys,
                state,
                "recover",
                first.id,
                "--thread",
                first.native.thread,
            )
        assert "another active" in capsys.readouterr().err
        assert site.claim(first.id).process == first.process
        assert site.claim(second.id).process == second.process
    finally:
        (services / "release-native").touch()
        wait_all(site)


def test_explicit_recovery_cannot_renew_exhausted_incident(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    interruptions = services / "interruptions.json"
    interruptions.write_text(json.dumps({"starts": [], "failures": 20}))
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.native is not None
    assert claim.recovery_attempts == 2
    try:
        with pytest.raises(SystemExit):
            invoke(
                monkeypatch,
                capsys,
                state,
                "recover",
                claim.id,
                "--thread",
                claim.native.thread,
            )
        assert "exhausted" in capsys.readouterr().err
        assert site.claim(claim.id).recovery_attempts == 2
        assert len(json.loads(interruptions.read_text())["starts"]) == 3
    finally:
        wait_all(site)


@pytest.mark.parametrize("ambiguous", [False, True])
def test_stopped_report_includes_pr_published_before_native_failure(
    repository: Path,
    services: Path,
    tmp_path: Path,
    ambiguous: bool,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_PR_RESULT", "missing")
    if ambiguous:
        monkeypatch.setenv("ARTIFICER_AMBIGUOUS_REPORT", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    path = services / "forge.json"
    assert (
        "https://github.com/o/r/pull/9" in json.loads(path.read_text())["comments"][-1]
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert len(json.loads(path.read_text())["comments"]) == 2
    assert site.claim(claim.id).pr == 9


def test_unknown_publication_defers_report_until_reconciliation(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_PR_RESULT", "missing")
    monkeypatch.setenv("ARTIFICER_PUBLICATION_UNAVAILABLE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    path = services / "forge.json"
    assert len(json.loads(path.read_text())["comments"]) == 1
    assert claim.report_state == "none"
    assert "Publication must be reconciled" in claim.report_error
    assert "reconcile publication" in claim.next_action
    monkeypatch.delenv("ARTIFICER_PUBLICATION_UNAVAILABLE")
    invoke(monkeypatch, capsys, state, "tick")
    assert site.claim(claim.id).report_state == "posted"
    assert (
        "https://github.com/o/r/pull/9" in json.loads(path.read_text())["comments"][-1]
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert len(json.loads(path.read_text())["comments"]) == 2
