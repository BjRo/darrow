"""Published output cannot substitute for observed native goal completion."""

import json
from pathlib import Path

import pytest

from test_management_cli import initialize
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


def test_claude_cannot_complete_without_native_goal_handoff(
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
    claim = wait_stopped(site)
    assert claim.status == "needs-attention"
    assert "prepared /goal handoff" in claim.detail
    assert claim.goal_objective is None
    assert claim.pr == 9
    assert claim.native is not None
    forge = json.loads((services / "forge.json").read_text())
    assert forge["pr"]["labels"] == ["artificer:claimed"]
    assert any("prepared /goal handoff" in item for item in forge["comments"])
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    assert site.claim(claim.id).status == "needs-attention"
    assert site.claim(claim.id).native == claim.native


def test_claude_goal_handoff_does_not_prove_goal_completion(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.status == "needs-attention"
    assert "independently observed native goal completion" in claim.detail
    assert claim.goal_objective == (
        "Deliver the prepared ready ticket under the original grant"
    )
    assert claim.pr == 9
    assert claim.native is not None
    trace = json.loads((services / "goal-handshake.json").read_text())
    assert [item["resuming"] for item in trace] == [False, True]
    assert trace[1]["prompt"] == "/goal " + claim.goal_objective
    assert all(item["identity"] == claim.native.thread for item in trace)
    forge = json.loads((services / "forge.json").read_text())
    assert forge["pr"]["labels"] == ["artificer:claimed"]
    assert any(
        "independently observed native goal completion" in item
        and "https://github.com/o/r/pull/9" in item
        for item in forge["comments"]
    )
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    assert site.claim(claim.id).status == "needs-attention"
