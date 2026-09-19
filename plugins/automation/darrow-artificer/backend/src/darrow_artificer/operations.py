"""Public local operations preserve claims independently of native execution."""

import time
from pathlib import Path
from uuid import uuid4

from . import admission, archive, native, processes, reconciliation
from .github import GitHub
from .installation import Installation
from .models import Claim
from .storage import locked


def expire(site: Installation, claim: Claim) -> None:
    if claim.saved_at is None or processes.alive(claim.process):
        return
    if time.time() - claim.saved_at < site.grant.SESSION_RETENTION_DAYS * 86400:
        return
    (site.delivery_dir(claim.id) / "session.enc").unlink(missing_ok=True)
    if claim.status not in ("released", "cancelled", "pr-open"):
        claim.status = "needs-attention"
    claim.detail = "Encrypted archive expired; claim retained for human recovery."
    site.save(claim)


def tick(site: Installation) -> list[str]:
    with locked(site.lock):
        site.verify_binding()
        grant = site.grant
        if not grant.enabled:
            return []
        forge = GitHub(grant.gh, grant.repository)
        if not forge.writable(grant.grantor):
            raise ValueError("Recurring grantor no longer has repository write access")
        for claim in site.claims():
            expire(site, claim)
        reconciliation.reconcile(site, forge, processes.launch)
        return admission.admit(site, forge, str(uuid4()), processes.launch)


def cancel(site: Installation, delivery: str) -> Claim:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        if claim.status == "released":
            raise ValueError("Delivery is already released")
        claim.status = "cancelled"
        claim.detail = (
            "Cancellation requested; claim retained and published effects unchanged."
        )
        site.save(claim)
        try:
            processes.cancel_process(claim.process)
        except Exception as error:
            claim.needs_attention(f"Cancellation was not confirmed: {error}")
            site.save(claim)
            raise
        return claim


def revoke(site: Installation) -> None:
    with locked(site.lock):
        site.verify_binding()
        grant = site.grant
        grant.enabled = False
        site.save_grant(grant)


def recover(site: Installation, delivery: str, parent: str, owner: str) -> Claim:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        if processes.alive(claim.process) or claim.status == "released":
            raise ValueError("Cannot recover a running or released delivery")
        home = site.delivery_dir(delivery) / "native"
        restore_missing_home(site, claim, home)
        observed = native.correlate(home, parent, owner, site.grant)
        if claim.native is not None and observed != claim.native:
            raise ValueError(
                "Recovery must preserve the original native owner and route"
            )
        claim.native = observed
        claim.needs_attention(
            "Original native owner verified; explicit GitHub resume still required."
        )
        if claim.question_comment is not None:
            claim.status = "question"
        archive.save(
            home,
            site.delivery_dir(delivery) / "session.enc",
            (site.root / "archive.key").read_bytes(),
        )
        claim.saved_at = time.time()
        site.save(claim)
        return claim


def restore_missing_home(site: Installation, claim: Claim, home: Path) -> None:
    if home.exists():
        return
    if (
        claim.saved_at is None
        or time.time() - claim.saved_at >= site.grant.SESSION_RETENTION_DAYS * 86400
    ):
        raise ValueError("Native archive is missing or expired; preserve the claim")
    archive.restore(
        site.delivery_dir(claim.id) / "session.enc",
        home,
        (site.root / "archive.key").read_bytes(),
    )
    (home / "auth.json").symlink_to(Path(site.grant.credential_home) / "auth.json")
