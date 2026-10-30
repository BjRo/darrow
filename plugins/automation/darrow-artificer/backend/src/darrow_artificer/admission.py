"""Reserve a fixed admission set before handing each delivery to native Codex."""

import time
from collections.abc import Callable
from pathlib import Path
from uuid import uuid4

from .github import GitHub, number_value, object_value
from .installation import Installation
from .models import Claim, Grant
from .policy import Limits, allowance
from .processes import alive

Launch = Callable[[Installation, Claim], None]


def unreserved_pr_count(forge: GitHub, claims: list[Claim]) -> int:
    branches = {(claim.branch, forge.repository) for claim in claims}
    unmatched = 0
    for pr in forge.owned_prs():
        head = object_value(pr["head"])
        identity = (head.get("ref"), object_value(head["repo"]).get("full_name"))
        unmatched += identity not in branches
    return unmatched


def eligible(forge: GitHub, grant: Grant, occupied: set[int]) -> list[int]:
    issues = [
        number_value(issue["number"])
        for issue in forge.issues("artificer:ready", "open")
    ]
    scoped = [
        issue
        for issue in issues
        if issue not in occupied
        and (not grant.issue_scope or issue in grant.issue_scope)
    ]
    return [
        issue for issue in scoped if forge.nominated(issue) and forge.unblocked(issue)
    ]


def reserve(site: Installation, issue: int, activation: str) -> Claim:
    delivery = str(uuid4())
    branch = f"feat/{issue}-artificer-{delivery[:8]}"
    claim = Claim(
        id=delivery,
        issue=issue,
        activation=activation,
        grant=site.grant.id,
        worktree=str(Path(site.grant.checkout) / ".worktrees" / branch),
        branch=branch,
        created_at=time.time(),
    )
    site.save(claim)
    return claim


def handoff(site: Installation, forge: GitHub, claim: Claim, launch: Launch) -> None:
    try:
        forge.reserve(
            claim.issue,
            f"Artificer reservation `{claim.id}`\n\n"
            f"Grant: `{claim.grant}`; activation: `{claim.activation}`.\n"
            "This claim retains capacity until its PR is terminal and execution has ended.\n"
            "A failed launch requires human recovery; removing labels does not cancel it.",
        )
        launch(site, claim)
    except Exception as error:
        # External-effect boundary: outcome may be ambiguous. Never refund or retry.
        claim.needs_attention(f"Reservation/launch requires reconciliation: {error}")
        site.save(claim)


def worker_occupied(site: Installation, ignored_delivery: str = "") -> bool:
    return any(
        claim.status in {"reserved", "running", "needs-attention", "cancelled"}
        or alive(claim.process)
        for claim in site.claims()
        if claim.status != "released" and claim.id != ignored_delivery
    )


def require_recovery_capacity(site: Installation, forge: GitHub, claim: Claim) -> None:
    claims = [
        item
        for item in site.repository_claims()
        if item.status != "released" and item.id != claim.id
    ]
    occupied = {item.issue for item in claims}
    occupied.update(
        number_value(issue["number"])
        for issue in forge.issues("artificer:claimed", "all")
    )
    occupied.discard(claim.issue)
    used = len(occupied) + unreserved_pr_count(forge, [claim, *claims])
    if not allowance(Limits.from_mapping(site.grant.model_dump()), used, 1):
        raise ValueError("Recovery requires available shared capacity")


def require_recovery_ownership(site: Installation, forge: GitHub, claim: Claim) -> None:
    others = [
        item
        for item in site.repository_claims()
        if item.status != "released" and item.id != claim.id
    ]
    if claim.issue in {item.issue for item in others}:
        raise ValueError("Another delivery holds source-issue ownership")
    if claim.status == "released":
        require_unclaimed_issue(forge, claim)


def require_unclaimed_issue(forge: GitHub, claim: Claim) -> None:
    claimed = {
        number_value(issue["number"])
        for issue in forge.issues("artificer:claimed", "all")
    }
    ready = {
        number_value(issue["number"])
        for issue in forge.issues("artificer:ready", "open")
    }
    if claim.issue in claimed | ready:
        raise ValueError(
            "Source-issue ownership or a new nomination conflicts with recovery"
        )


def admit(
    site: Installation, forge: GitHub, activation: str, launch: Launch
) -> list[str]:
    """Caller holds the repository lock for observations, reservations and launches."""
    grant = site.grant
    if worker_occupied(site):
        return []
    limits = Limits.from_mapping(grant.model_dump())
    claims = [claim for claim in site.repository_claims() if claim.status != "released"]
    occupied = {claim.issue for claim in claims}
    occupied.update(
        number_value(issue["number"])
        for issue in forge.issues("artificer:claimed", "all")
    )
    available = allowance(limits, len(occupied) + unreserved_pr_count(forge, claims), 1)
    if not available:
        return []
    selected = eligible(forge, grant, occupied)[:available]
    claims = [reserve(site, issue, activation) for issue in selected]
    for claim in claims:
        handoff(site, forge, claim, launch)
    return [claim.id for claim in claims]
