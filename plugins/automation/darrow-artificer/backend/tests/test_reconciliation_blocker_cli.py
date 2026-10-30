"""Operational reconciliation failures retain the original delivery blocker."""

import json
from pathlib import Path

import pytest

from darrow_artificer.github import GitHub, array_value, object_value
from test_management_cli import initialize
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services

REQUEST = GitHub.request


def publication_unavailable(
    forge: GitHub,
    route: str,
    method: str = "GET",
    body: dict[str, object] | None = None,
    pages: bool = False,
) -> object:
    if "/pulls" in route:
        raise OSError("Publication service temporarily unavailable")
    return REQUEST(forge, route, method, body, pages)


def test_native_completion_gap_survives_publication_outage_and_reconciliation(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_PUBLICATION_UNAVAILABLE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    gap = "independently observed native goal completion"
    assert gap in claim.detail
    assert claim.pr is None
    assert claim.report_state == "none"
    assert claim.goal_objective is not None
    forge_path = services / "forge.json"
    assert len(json.loads(forge_path.read_text())["comments"]) == 1
    for _ in range(2):
        assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
        status = invoke(monkeypatch, capsys, state, "status")
        delivery = object_value(array_value(status["deliveries"])[0])
        assert delivery["status"] == "needs-attention"
        assert gap in str(delivery["detail"])
        assert "Reconciliation needs attention" in str(delivery["reconciliation_error"])
        assert len(json.loads(forge_path.read_text())["comments"]) == 1
    monkeypatch.delenv("ARTIFICER_PUBLICATION_UNAVAILABLE")
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    recovered = site.claim(claim.id)
    assert recovered.status == "needs-attention"
    assert gap in recovered.detail
    assert recovered.reconciliation_error == ""
    assert recovered.native == claim.native
    assert recovered.pr == 9
    forge = json.loads(forge_path.read_text())
    assert forge["claimed"] == [1]
    assert forge["pr"]["labels"] == ["artificer:claimed"]
    assert len(forge["comments"]) == 2
    assert gap in forge["comments"][-1]
    assert "https://github.com/o/r/pull/9" in forge["comments"][-1]
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    assert len(json.loads(forge_path.read_text())["comments"]) == 2

    # The stopped reservation and its owned PR together occupy one of two slots.
    invoke(monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", "2")
    forge["ready"] = [2]
    forge_path.write_text(json.dumps(forge))
    other_state = tmp_path / "other"
    other_site = initialize(repository, other_state, monkeypatch, capsys)
    monkeypatch.setenv("ARTIFICER_HOLD", "1")
    try:
        admitted = invoke(monkeypatch, capsys, other_state, "tick")["admitted"]
        assert len(array_value(admitted)) == 1
    finally:
        (services / "release-native").touch()
        wait_stopped(other_site)


@pytest.mark.parametrize(
    ("terminal", "expected"), [("completed", "pr-open"), ("cancelled", "released")]
)
def test_transient_publication_failure_preserves_terminal_delivery_disposition(
    repository: Path,
    services: Path,
    tmp_path: Path,
    terminal: str,
    expected: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys, host="codex")
    if terminal == "completed":
        monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    invoke(monkeypatch, capsys, state, "tick")
    original = wait_stopped(site)
    if terminal == "cancelled":
        invoke(monkeypatch, capsys, state, "cancel", original.id)
        original = site.claim(original.id)
    assert original.resume_allowed is False
    with monkeypatch.context() as outage:
        outage.setattr(GitHub, "request", publication_unavailable)
        try:
            invoke(monkeypatch, capsys, state, "tick")
        except SystemExit:
            capsys.readouterr()
    interrupted = site.claim(original.id)
    assert interrupted.status == original.status
    assert interrupted.detail == original.detail
    assert interrupted.resume_allowed is False
    assert (
        "Publication service temporarily unavailable"
        in interrupted.reconciliation_error
    )
    invoke(monkeypatch, capsys, state, "tick")
    reconciled = site.claim(original.id)
    assert reconciled.status == expected
    assert reconciled.detail == original.detail
    assert reconciled.resume_allowed is False
    assert reconciled.reconciliation_error == ""
