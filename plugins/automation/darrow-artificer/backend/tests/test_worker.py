import json
import signal
import subprocess
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from darrow_artificer import account, native, prompts, worker
from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim, Outcome
from test_admission import existing
from test_native import rollout


def native_claim(site: Installation) -> tuple[Claim, Path, Path, Path]:
    claim = existing(site, 1)
    home = site.delivery_dir(claim.id) / "native"
    rollout(home, "parent")
    rollout(home, "child", "parent", "/root/owner")
    claim.native = native.correlate(home, "parent", "/root/owner", site.grant)
    claim.worktree = str(site.root)
    claim.status = "running"
    site.save(claim)
    (site.root / "archive.key").write_bytes(Fernet.generate_key())
    events = site.delivery_dir(claim.id) / "events.jsonl"
    events.write_text('{"type":"thread.started","thread_id":"parent"}\n')
    output = site.delivery_dir(claim.id) / "result.json"
    output.write_text(
        Outcome(
            status="question",
            detail="decision needed",
            question="Choose a scope?",
            pr=None,
            owner="/root/owner",
        ).model_dump_json()
    )
    return claim, home, events, output


def test_question_archive_and_same_owner(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim, home, events, output = native_claim(installation)
    comments: list[str] = []

    def comment(self: GitHub, issue: int, body: str) -> int:
        comments.append(body)
        assert installation.claim(claim.id).question is not None
        return 44

    monkeypatch.setattr(GitHub, "comment", comment)
    worker.finish(installation, claim.id, home, (events, output), None)
    saved = installation.claim(claim.id)
    assert saved.status == "question" and saved.question_comment == 44
    assert saved.native == claim.native and saved.saved_at is not None
    assert len(comments) == 1 and "Choose a scope?" in comments[0]
    assert (home.parent / "session.enc").is_file()
    assert worker.home_for(installation, saved) == home


def test_pr_outcome_and_changed_owner(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim, home, events, output = native_claim(installation)
    monkeypatch.setattr(worker, "verified_pr", lambda *args: {"state": "open"})
    output.write_text(
        Outcome(
            status="pr-open",
            detail="verified",
            question=None,
            pr=9,
            owner="/root/owner",
        ).model_dump_json()
    )
    worker.finish(installation, claim.id, home, (events, output), None)
    assert installation.claim(claim.id).status == "pr-open"
    assert claim.native is not None
    claim.native.owner_model = "changed"
    installation.save(claim)
    with pytest.raises(ValueError, match="changed"):
        worker.apply_outcome(installation, claim, home, events, output)
    with pytest.raises(ValueError, match="matches"):
        worker.home_for(installation, claim)


def test_failed_readiness_retains_original_parent(installation: Installation) -> None:
    claim = existing(installation, 1)
    home = installation.delivery_dir(claim.id) / "native"
    rollout(home, "parent")
    events, output = home.parent / "events", home.parent / "result"
    events.write_text('{"type":"thread.started","thread_id":"parent"}\n')
    output.write_text(
        Outcome(
            status="needs-attention",
            detail="Readiness rejected: missing acceptance",
            question=None,
            pr=None,
            owner=None,
        ).model_dump_json()
    )
    worker.apply_outcome(installation, claim, home, events, output)
    assert claim.status == "needs-attention" and claim.native is not None
    assert claim.native.parent == "parent" and claim.native.owner == ""
    claim.pending_answer = "The missing acceptance is now supplied."
    assert "retained readiness/preflight" in prompts.continuation(claim)


def test_ambiguous_question_never_reposts(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim, home, events, output = native_claim(installation)

    def fail(*args: object) -> int:
        raise OSError("comment response lost")

    monkeypatch.setattr(GitHub, "comment", fail)
    worker.finish_safely(installation, claim.id, home, (events, output), None)
    saved = installation.claim(claim.id)
    assert saved.status == "needs-attention" and saved.native == claim.native
    assert saved.question is not None and saved.question_comment is None


def test_cancelled_finish_preserves_status(installation: Installation) -> None:
    claim, home, events, output = native_claim(installation)
    claim.status = "cancelled"
    installation.save(claim)
    worker.finish(installation, claim.id, home, (events, output), None)
    assert installation.claim(claim.id).status == "cancelled"
    (installation.root / "archive.key").unlink()
    worker.finish_safely(installation, claim.id, home, None, "interrupted")
    assert installation.claim(claim.id).status == "cancelled"


def test_home_refuses_ambiguous_or_lost_state(installation: Installation) -> None:
    claim, home, _, _ = native_claim(installation)
    claim.native = None
    with pytest.raises(ValueError, match="Ambiguous"):
        worker.home_for(installation, claim)
    claim = installation.claim(claim.id)
    claim.id = "22222222-2222-4222-8222-222222222222"
    with pytest.raises(ValueError, match="unavailable"):
        worker.home_for(installation, claim)
    assert home.exists()


def test_empty_question_refused(installation: Installation) -> None:
    claim = existing(installation, 1)
    outcome = Outcome(status="question", detail="", question="", pr=None, owner=None)
    with pytest.raises(ValueError, match="empty question"):
        worker.question(installation, claim, outcome)


def test_parent_cannot_claim_pr_without_engineering_owner(
    installation: Installation,
) -> None:
    claim, home, events, output = native_claim(installation)
    output.write_text(
        Outcome(
            status="pr-open", detail="unsupported", question=None, pr=9, owner=None
        ).model_dump_json()
    )
    worker.finish(installation, claim.id, home, (events, output), None)
    saved = installation.claim(claim.id)
    assert saved.status == "needs-attention" and saved.pr is None
    assert "engineering owner" in saved.detail


@pytest.mark.parametrize("code", [0, 1])
def test_execute_uses_retained_parent_and_preserves_payload(
    installation: Installation, monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    claim, home, _, _ = native_claim(installation)
    claim.pending_answer = "  complete\nanswer\n"
    observed: list[list[str]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[bytes]:
        observed.append(command)
        content = kwargs["input"]
        assert isinstance(content, bytes)
        assert json.dumps(claim.pending_answer) in content.decode()
        return subprocess.CompletedProcess(command, code, b"", b"diagnostic")

    monkeypatch.setattr(subprocess, "run", run)
    if code:
        with pytest.raises(RuntimeError, match="exited 1"):
            worker.execute(installation, claim, home)
    else:
        worker.execute(installation, claim, home)
    assert observed[0][1:4] == ["exec", "resume", "parent"]


def test_initial_prompt_and_worktree(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim = existing(installation, 1)
    initial = prompts.initial(installation, claim)
    assert installation.grant.id in initial and "$ticket-to-pr" in initial
    assert "readiness before implementation" in initial
    with pytest.raises(ValueError):
        prompts.continuation(claim)
    calls: list[list[str]] = []
    monkeypatch.setattr(
        subprocess, "run", lambda command, **kwargs: calls.append(command)
    )
    worker.worktree(installation, claim)
    assert "worktree" in calls[0] and claim.branch in calls[0]
    claim, _, _, _ = native_claim(installation)
    worker.worktree(installation, claim)
    claim.worktree = str(installation.root / "missing")
    with pytest.raises(ValueError, match="worktree"):
        worker.worktree(installation, claim)


@pytest.mark.parametrize("variant", ["success", "login", "disabled", "not-running"])
def test_worker_lifecycle(
    installation: Installation, monkeypatch: pytest.MonkeyPatch, variant: str
) -> None:
    claim, home, events, output = native_claim(installation)
    if variant == "disabled":
        grant = installation.grant
        grant.enabled = False
        installation.save_grant(grant)
    if variant == "not-running":
        claim.status = "cancelled"
        installation.save(claim)

    def login(*args: object) -> None:
        if variant == "login":
            raise ValueError("Login needs attention")

    monkeypatch.setattr(native, "check_login", login)
    monkeypatch.setattr(account, "check", lambda *args: None)
    monkeypatch.setattr(worker, "worktree", lambda *args: None)
    monkeypatch.setattr(worker, "execute", lambda *args: (events, output))
    monkeypatch.setattr(GitHub, "comment", lambda *args: 44)
    worker.run(installation, claim.id)
    expected = {
        "success": "question",
        "login": "needs-attention",
        "disabled": "needs-attention",
        "not-running": "cancelled",
    }
    assert installation.claim(claim.id).status == expected[variant]
    assert home.exists()


def test_worker_signal_and_entry(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    with pytest.raises(InterruptedError):
        worker.terminated(signal.SIGTERM, None)
    calls: list[str] = []
    monkeypatch.setattr(signal, "signal", lambda *args: None)
    monkeypatch.setattr(worker, "run", lambda site, delivery: calls.append(delivery))
    monkeypatch.setattr(sys, "argv", ["worker", str(installation.root), "delivery"])
    worker.main()
    assert calls == ["delivery"]
