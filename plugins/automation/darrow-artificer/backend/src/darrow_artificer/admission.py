"""Reserve a fixed admission set before handing each delivery to native Codex."""

import time
from collections.abc import Callable
from pathlib import Path
from uuid import uuid4

from .github import GitHub, number_value
from .installation import Installation
from .models import Claim, Grant
from .policy import Limits, allowance

Launch = Callable[[Installation, Claim], None]


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


def admit(
    site: Installation, forge: GitHub, activation: str, launch: Launch
) -> list[str]:
    """Caller holds the repository lock for observations, reservations and launches."""
    grant = site.grant
    limits = Limits.from_mapping(grant.model_dump())
    occupied = {claim.issue for claim in site.claims() if claim.status != "released"}
    occupied.update(
        number_value(issue["number"])
        for issue in forge.issues("artificer:claimed", "all")
    )
    available = allowance(limits, len(occupied), limits.starts)
    if not available:
        return []
    selected = eligible(forge, grant, occupied)[:available]
    claims = [reserve(site, issue, activation) for issue in selected]
    for claim in claims:
        handoff(site, forge, claim, launch)
    return [claim.id for claim in claims]
