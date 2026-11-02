"""Counterexamples for the independently observable composition fixture."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from assurance_control import REPLY, accept, ci, publish
from assurance_control import git as fixture_git
from assurance_fixture import installation
from darrow_artificer.storage import read_object, write_object


def candidate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    site = installation(tmp_path, Path(sys.executable))
    repo = Path(site.grant.checkout)
    fixture_git(repo, "switch", "-c", "feat/291-fixture")
    write_object(
        tmp_path / "target.json", {"worktree": str(repo), "branch": "feat/291-fixture"}
    )
    monkeypatch.setattr("assurance_control.root", lambda: tmp_path)
    return repo


def test_operator_release_requires_actual_answer_and_successful_checks(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = candidate(tmp_path, monkeypatch)
    with pytest.raises(AssertionError, match="complete operator answer"):
        accept("inferred approval")
    with pytest.raises(subprocess.CalledProcessError):
        accept(REPLY)
    assert not (tmp_path / "release.txt").exists()
    (repo / "config.json").write_text('{"timeoutMs":2500,"retries":3}\n')
    accept(REPLY)
    assert (tmp_path / "release.txt").read_text() == REPLY
    assert not (tmp_path / "proposal.json").exists()


def test_publication_requires_clean_committed_accepted_content_and_correlated_ci(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = candidate(tmp_path, monkeypatch)
    (repo / "config.json").write_text('{"timeoutMs":2500,"retries":3}\n')
    accept(REPLY)
    old = fixture_git(repo, "rev-parse", "HEAD")
    with pytest.raises(AssertionError):
        publish(old)
    fixture_git(repo, "add", "config.json")
    fixture_git(repo, "commit", "-m", "fix: configure timeout")
    commit = fixture_git(repo, "rev-parse", "HEAD")
    with pytest.raises(AssertionError):
        publish(old)
    publish(commit)
    with pytest.raises(AssertionError):
        ci(old)
    ci(commit)
    assert read_object(tmp_path / "ci.json") == {"commit": commit, "status": "success"}
    assert json.loads(fixture_git(repo, "show", f"{commit}:config.json")) == {
        "timeoutMs": 2500,
        "retries": 3,
    }
