"""Explicit local management; engineering and native history remain with the host."""

from pathlib import Path
from uuid import uuid4

from . import admission, processes, reconciliation
from .github import GitHub
from .installation import Installation
from .models import Claim
from .storage import locked


def tick(site: Installation) -> list[str]:
    with locked(site.lock):
        site.verify_binding()
        grant = site.grant
        if not grant.enabled:
            return []
        forge = GitHub(grant.gh, grant.repository)
        if not forge.writable(grant.grantor):
            raise ValueError("Recurring grantor no longer has repository write access")
        reconciliation.reconcile(site, forge)
        return admission.admit(site, forge, str(uuid4()), processes.launch)


def cancel(site: Installation, delivery: str) -> Claim:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        if claim.status == "released":
            return cancel_released(site, claim)
        claim.resume_allowed = False
        claim.status = "cancelled"
        claim.detail = (
            "Cancellation requested; reconcile execution and published effects."
        )
        site.save(claim)
        try:
            processes.cancel_process(claim.process)
        except Exception as error:
            # Cancellation boundary: failure cannot prove termination or free capacity.
            claim.needs_attention(f"Cancellation was not confirmed: {error}")
        reconciliation.report_stopped(
            site, GitHub(site.grant.gh, site.grant.repository), claim
        )
        return claim


def cancel_released(site: Installation, claim: Claim) -> Claim:
    if claim.resume_allowed is not True:
        raise ValueError("Delivery is already terminal or its eligibility is unknown")
    claim.resume_allowed = False
    claim.detail = "Cancelled after capacity release; native recovery is disabled."
    claim.next_action = (
        "Inspect preserved worktree and published effects; delivery is terminal."
    )
    site.save(claim)
    return claim


def revoke(site: Installation) -> None:
    with locked(site.lock):
        site.verify_binding()
        grant = site.grant
        grant.enabled = False
        site.save_grant(grant)


def require_recoverable(site: Installation, claim: Claim) -> None:
    if processes.alive(claim.process):
        raise ValueError("Cannot recover a running delivery")
    if claim.resume_allowed is not True:
        raise ValueError(
            "Delivery is terminal or its recovery eligibility is unknown; inspect the original native session"
        )
    if admission.worker_occupied(site, claim.id):
        raise ValueError("Worker already has another active or uncertain delivery")
    if claim.recovery_attempts >= 2:
        raise ValueError(
            "Two recovery attempts exhausted; inspect the original native session"
        )
    require_ended_execution(claim)


def require_ended_execution(claim: Claim) -> None:
    if claim.process is None and not claim.execution_ended:
        raise ValueError(
            "Execution identity unavailable; reconcile original launch before recovery"
        )


def recover(site: Installation, delivery: str, thread: str) -> Claim:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        require_recoverable(site, claim)
        require_original_state(claim, thread)
        forge = recovery_authority(site, claim)
        require_recovery_publication(claim, forge)
        admission.require_recovery_ownership(site, forge, claim)
        admission.require_recovery_capacity(site, forge, claim)
        released = claim.status == "released"
        claim.recovery_attempts += 1
        claim.total_recovery_attempts += 1
        claim.execution_ended = False
        claim.process = None
        claim.status = "reserved"
        claim.report_state = "none"
        site.save(claim)
        if released:
            reclaim(site, claim)
        processes.launch(site, claim)
        return claim


def require_original_state(claim: Claim, thread: str) -> None:
    if claim.native is None or claim.native.thread != thread:
        raise ValueError(
            "Recovery requires the exact original native session; reconcile existing effects"
        )
    if not Path(claim.worktree).is_dir():
        raise ValueError(
            "Original worktree unavailable; native recovery cannot create replacement work"
        )


def recovery_authority(site: Installation, claim: Claim) -> GitHub:
    grant = site.grant
    if not grant.enabled:
        raise ValueError("Worker authority is revoked")
    if grant.issue_scope and claim.issue not in grant.issue_scope:
        raise ValueError("Delivery is outside the current issue scope")
    forge = GitHub(grant.gh, grant.repository)
    if not forge.writable(grant.grantor):
        raise ValueError("Recovery grantor no longer has repository writer access")
    return forge


def require_recovery_publication(claim: Claim, forge: GitHub) -> None:
    try:
        pr = reconciliation.observe_publication(claim, forge)
    except Exception as error:
        # External protocol boundary: unknown publication never permits continuation.
        raise ValueError("Recovery publication requires reconciliation") from error
    if pr is not None and pr.get("state") != "open":
        raise ValueError(
            "Delivery publication is terminal or unknown; inspect the original PR"
        )


def reclaim(site: Installation, claim: Claim) -> None:
    try:
        GitHub(site.grant.gh, site.grant.repository).mark_owned(claim.issue)
    except Exception as error:
        # Ownership effect may have happened; retain the reservation for reconciliation.
        claim.needs_attention(f"Recovery ownership requires reconciliation: {error}")
        site.save(claim)
        raise
