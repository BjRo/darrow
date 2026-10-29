"""Publication and configuration counterexamples observed through local operations."""

import json
from pathlib import Path

import pytest

from darrow_artificer.installation import Installation
from test_management_cli import initialize
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


def test_reconciliation_finds_a_pr_after_an_incomplete_owner_result(
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
    forge_path = services / "forge.json"
    forge = json.loads(forge_path.read_text())
    forge["ready"] = [2]
    forge["pr"] = {
        "number": 9,
        "state": "open",
        "head": {"ref": claim.branch, "repo": {"full_name": "o/r"}},
        "base": {"ref": "main"},
    }
    forge_path.write_text(json.dumps(forge))
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    assert site.claim(claim.id).pr == 9
    assert site.claim(claim.id).status == "pr-open"


def test_multiple_possible_delivery_prs_retain_ownership(
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
    forge_path = services / "forge.json"
    forge = json.loads(forge_path.read_text())
    forge["duplicate_prs"] = True
    forge_path.write_text(json.dumps(forge))
    invoke(monkeypatch, capsys, state, "tick")
    assert "Multiple delivery PRs" in site.claim(claim.id).detail
    assert json.loads(forge_path.read_text())["claimed"] == [1]


def test_noncanonical_delivery_id_is_refused(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    initialize(repository, state, monkeypatch, capsys)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            "ABCDEFAB-1234-4234-8234-ABCDEFABCDEF",
            "--thread",
            "replacement",
        )
    assert "canonical UUID" in capsys.readouterr().err


def test_unreadable_core_catalog_stops_before_engineering(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_SKILL_ERROR", "1")
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
    assert "Unreadable native skills" in claim.detail
    assert claim.native is None


def test_ambiguous_blocker_report_is_visible_without_duplicate_posting(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_AMBIGUOUS_REPORT", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.report_state == "uncertain"
    assert claim.report_error
    invoke(monkeypatch, capsys, state, "tick")
    assert len(json.loads((services / "forge.json").read_text())["comments"]) == 2
