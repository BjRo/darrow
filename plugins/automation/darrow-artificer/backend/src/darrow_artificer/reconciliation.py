"""Model-free observations decide whether an explicit continuation is admissible."""

import time
from datetime import datetime

from .admission import Launch
from .github import GitHub, number_value, object_value, text_value
from .installation import Installation
from .models import Claim
from .policy import reply_payload
from .processes import alive


def answer(claim: Claim, body: str) -> str | None:
    if claim.status == "question" and claim.question_comment is not None:
        return reply_payload(body, claim.id, claim.question or "")
    if claim.status == "needs-attention" and body == f"/artificer resume {claim.id}":
        return resume_payload(claim)
    return None


def resume_payload(claim: Claim) -> str | None:
    if claim.pending_answer is not None:
        return claim.pending_answer
    if claim.question is not None:
        return None
    return "Explicit human resume: reconcile existing effects and continue the original task."


def authorized_answers(claim: Claim, forge: GitHub) -> list[tuple[int, str]]:
    candidates = []
    for comment in forge.comments(claim.issue):
        identifier = number_value(comment["id"])
        payload = answer(claim, text_value(comment["body"]))
        if (
            identifier in claim.consumed_comments
            or payload is None
            or not current_resume(claim, comment)
        ):
            continue
        if forge.human_writer(object_value(comment["user"])):
            candidates.append((identifier, payload))
    return candidates


def current_resume(claim: Claim, comment: dict[str, object]) -> bool:
    if claim.status != "needs-attention":
        return True
    if claim.attention_since is None:
        return False
    created = datetime.fromisoformat(
        text_value(comment.get("created_at")).replace("Z", "+00:00")
    )
    return created.timestamp() >= claim.attention_since


def resumable(site: Installation, claim: Claim) -> bool:
    if claim.native is None:
        return False
    if (
        claim.saved_at is None
        or time.time() - claim.saved_at >= site.grant.SESSION_RETENTION_DAYS * 86400
    ):
        return False
    return (site.delivery_dir(claim.id) / "session.enc").is_file()


def continue_delivery(
    site: Installation, forge: GitHub, claim: Claim, launch: Launch
) -> None:
    if not resumable(site, claim):
        return
    candidates = authorized_answers(claim, forge)
    if len(candidates) != 1:
        return
    identifier, payload = candidates[0]
    claim.consumed_comments.append(identifier)
    claim.pending_answer = payload
    claim.needs_attention(
        "Authorized continuation reserved; ambiguous launch must not be retried."
    )
    site.save(claim)
    try:
        launch(site, claim)
    except Exception as error:
        # Process boundary: the original owner may already have received this answer.
        claim.detail = f"Continuation needs reconciliation: {error}"
        site.save(claim)


def verified_pr(claim: Claim, forge: GitHub) -> dict[str, object]:
    if claim.pr is None:
        raise ValueError("Delivery has no correlated PR")
    pr = forge.pr(claim.pr)
    head = object_value(pr["head"])
    repository = object_value(head["repo"])
    if (
        head.get("ref") != claim.branch
        or repository.get("full_name") != forge.repository
    ):
        raise ValueError(
            "PR identity does not match the reserved repository and branch"
        )
    return pr


def complete(site: Installation, forge: GitHub, claim: Claim) -> None:
    if verified_pr(claim, forge).get("state") != "closed":
        return
    # Called only for a successful PR result and an observably ended process.
    forge.release(claim.issue)
    claim.status = "released"
    claim.detail = "Delivery PR is terminal and execution has ended."
    site.save(claim)


def reconcile_one(
    site: Installation, forge: GitHub, claim: Claim, launch: Launch
) -> None:
    if alive(claim.process):
        return
    if claim.status == "running":
        claim.needs_attention(
            "Execution ended without a reconciled result; explicit recovery required."
        )
        site.save(claim)
        return
    if claim.status == "pr-open":
        complete(site, forge, claim)
    elif claim.status in ("question", "needs-attention"):
        continue_delivery(site, forge, claim, launch)


def reconcile(site: Installation, forge: GitHub, launch: Launch) -> None:
    for claim in site.claims():
        try:
            reconcile_one(site, forge, claim, launch)
        except Exception as error:
            # One delivery's unavailable observations never authorize guessed effects.
            claim.detail = f"Reconciliation needs attention: {error}"
            site.save(claim)
