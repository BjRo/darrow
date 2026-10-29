"""Explicit local management; engineering and native history remain with the host."""

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
            raise ValueError("Delivery is already released")
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


def revoke(site: Installation) -> None:
    with locked(site.lock):
        site.verify_binding()
        grant = site.grant
        grant.enabled = False
        site.save_grant(grant)


def require_recoverable(site: Installation, claim: Claim) -> None:
    if processes.alive(claim.process) or claim.status == "released":
        raise ValueError("Cannot recover a running or released delivery")
    if admission.worker_occupied(site, claim.id):
        raise ValueError("Worker already has another active or uncertain delivery")
    if claim.recovery_attempts >= 2:
        raise ValueError(
            "Two recovery attempts exhausted; inspect the original native session"
        )


def recover(site: Installation, delivery: str, thread: str) -> Claim:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        require_recoverable(site, claim)
        if claim.native is None or claim.native.thread != thread:
            raise ValueError(
                "Recovery requires the exact original native session; reconcile existing effects"
            )
        if not site.grant.enabled:
            raise ValueError("Worker authority is revoked")
        claim.recovery_attempts += 1
        claim.total_recovery_attempts += 1
        claim.execution_ended = False
        claim.process = None
        claim.status = "reserved"
        claim.report_state = "none"
        site.save(claim)
        processes.launch(site, claim)
        return claim
