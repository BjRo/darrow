import os
import time
from datetime import datetime, timezone

import pytest

from darrow_artificer import processes
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim, Native
from darrow_artificer.reconciliation import reconcile
from test_admission import Forge, existing


class Replies(Forge):
    def __init__(self) -> None:
        super().__init__()
        self.discussion: list[dict[str, object]] = []
        self.pr_state = "open"
        self.branch = "old"
        self.released: list[int] = []

    def comments(self, issue: int) -> list[dict[str, object]]:
        return self.discussion

    def writable(self, user: str) -> bool:
        return user == "writer"

    def pr(self, number: int) -> dict[str, object]:
        return {
            "state": self.pr_state,
            "head": {"ref": self.branch, "repo": {"full_name": "owner/repo"}},
        }

    def release(self, issue: int) -> None:
        self.released.append(issue)


def waiting(site: Installation) -> Claim:
    claim = existing(site, 1)
    claim.question = "question-1"
    claim.question_comment = 2
    claim.native = Native(
        parent="parent",
        owner="/root/owner",
        owner_thread="child",
        model="m",
        effort="medium",
        owner_model="m",
        owner_effort="high",
    )
    claim.saved_at = time.time()
    (site.delivery_dir(claim.id) / "session.enc").write_bytes(b"opaque")
    site.save(claim)
    return claim


def comment(identifier: int, body: str, user: str = "writer") -> dict[str, object]:
    return {
        "id": identifier,
        "body": body,
        "user": {"login": user, "type": "User"},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def test_exact_reply_while_paused_and_no_duplicate(installation: Installation) -> None:
    claim = waiting(installation)
    grant = installation.grant
    grant.WORK_IN_PROGRESS_LIMIT = 0
    installation.save_grant(grant)
    forge = Replies()
    payload = "  Use the full answer.\nKeep this newline.\n"
    forge.discussion = [
        comment(3, f"/artificer reply {claim.id} question-1\n" + payload)
    ]
    launches: list[str | None] = []
    reconcile(
        installation,
        forge,
        lambda site, retained: launches.append(retained.pending_answer),
    )
    assert launches == [payload]
    assert installation.claim(claim.id).native == claim.native
    reconcile(
        installation,
        forge,
        lambda site, retained: launches.append(retained.pending_answer),
    )
    assert launches == [payload]


@pytest.mark.parametrize(
    "variant", ["ordinary", "unauthorized", "ambiguous", "wrong-question", "consumed"]
)
def test_no_unintended_continuation(installation: Installation, variant: str) -> None:
    claim = waiting(installation)
    forge = Replies()
    body = f"/artificer reply {claim.id} question-1\nAnswer"
    variants = {
        "ordinary": [comment(3, "I agree")],
        "unauthorized": [comment(3, body, "outsider")],
        "ambiguous": [comment(3, body), comment(4, body + " different")],
        "wrong-question": [comment(3, body.replace("question-1", "question-2"))],
        "consumed": [comment(3, body)],
    }
    if variant == "consumed":
        claim.consumed_comments = [3]
        installation.save(claim)
    forge.discussion = variants[variant]
    launches: list[str] = []
    reconcile(installation, forge, lambda site, retained: launches.append(retained.id))
    assert not launches


def test_stopped_owner_needs_explicit_resume(installation: Installation) -> None:
    claim = waiting(installation)
    claim.question = None
    claim.question_comment = None
    claim.status = "running"
    installation.save(claim)
    forge = Replies()
    launches: list[str] = []
    run = lambda site, retained: launches.append(retained.id)  # noqa: E731
    reconcile(installation, forge, run)
    assert installation.claim(claim.id).status == "needs-attention"
    reconcile(installation, forge, run)
    assert not launches
    forge.discussion = [comment(9, f"/artificer resume {claim.id}")]
    reconcile(installation, forge, run)
    assert launches == [claim.id]
    reconcile(installation, forge, run)
    assert launches == [claim.id]


def test_failed_resume_does_not_retry(installation: Installation) -> None:
    claim = waiting(installation)
    forge = Replies()
    forge.discussion = [comment(3, f"/artificer reply {claim.id} question-1\nAnswer")]
    attempts: list[int] = []

    def launch(site: Installation, retained: Claim) -> None:
        attempts.append(1)
        raise OSError("ambiguous continuation")

    reconcile(installation, forge, launch)
    reconcile(installation, forge, launch)
    assert attempts == [1]
    assert installation.claim(claim.id).status == "needs-attention"


def test_pr_retains_capacity_until_closed(installation: Installation) -> None:
    claim = waiting(installation)
    claim.status, claim.pr = "pr-open", 12
    installation.save(claim)
    forge = Replies()
    reconcile(installation, forge, lambda site, retained: None)
    assert not forge.released
    forge.pr_state = "closed"
    reconcile(installation, forge, lambda site, retained: None)
    assert forge.released == [1]
    assert installation.claim(claim.id).status == "released"
    reconcile(installation, forge, lambda site, retained: None)
    assert forge.released == [1]


def test_wrong_pr_does_not_release(installation: Installation) -> None:
    claim = waiting(installation)
    claim.status, claim.pr = "pr-open", 12
    installation.save(claim)
    forge = Replies()
    forge.pr_state, forge.branch = "closed", "other"
    reconcile(installation, forge, lambda site, retained: None)
    assert not forge.released
    assert "identity" in installation.claim(claim.id).detail


@pytest.mark.parametrize(
    "variant", ["no-native", "expired", "no-date", "no-archive", "alive"]
)
def test_unrestorable_or_running_owner_never_launches(
    installation: Installation, variant: str
) -> None:
    claim = waiting(installation)
    if variant == "no-native":
        claim.native = None
    elif variant == "expired":
        claim.saved_at = 1
    elif variant == "no-date":
        claim.saved_at = None
    elif variant == "no-archive":
        (installation.delivery_dir(claim.id) / "session.enc").unlink()
    else:
        claim.process = processes.identity(os.getpid())
    installation.save(claim)
    forge = Replies()
    forge.discussion = [comment(3, f"/artificer reply {claim.id} question-1\nAnswer")]
    launched: list[str] = []
    reconcile(installation, forge, lambda site, retained: launched.append(retained.id))
    assert not launched


def test_resume_cannot_bypass_question_or_reuse_old_authority(
    installation: Installation,
) -> None:
    claim = waiting(installation)
    claim.needs_attention("uncertain question")
    installation.save(claim)
    forge = Replies()
    forge.discussion = [comment(3, f"/artificer resume {claim.id}")]
    launched: list[str | None] = []
    launch = lambda site, retained: launched.append(retained.pending_answer)  # noqa: E731
    reconcile(installation, forge, launch)
    assert not launched
    claim.pending_answer = "Original full answer\n"
    claim.attention_since = None
    installation.save(claim)
    reconcile(installation, forge, launch)
    assert not launched
    claim.needs_attention("new interruption")
    installation.save(claim)
    reconcile(installation, forge, launch)
    assert not launched
    forge.discussion.append(comment(4, f"/artificer resume {claim.id}"))
    reconcile(installation, forge, launch)
    assert launched == ["Original full answer\n"]
