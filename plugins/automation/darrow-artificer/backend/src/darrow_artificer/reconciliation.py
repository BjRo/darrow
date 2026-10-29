"""Reconcile ended executions against authoritative branch/PR state, without models."""

from urllib.parse import quote

from . import reporting
from .github import GitHub, number_value, object_value
from .installation import Installation
from .models import Claim
from .processes import alive


def verified_pr(claim: Claim, forge: GitHub) -> dict[str, object]:
    if claim.pr is None:
        raise ValueError("Delivery has no correlated PR")
    pr = forge.pr(claim.pr)
    head = object_value(pr["head"])
    if (head.get("ref"), object_value(head["repo"]).get("full_name")) != (
        claim.branch,
        forge.repository,
    ):
        raise ValueError("PR does not match reserved repository and branch")
    if object_value(pr["base"]).get("ref") != claim.base_branch:
        raise ValueError("PR base does not match the reserved main/master branch")
    return pr


def publication(claim: Claim, forge: GitHub) -> dict[str, object] | None:
    if claim.pr is None:
        head = quote(f"{forge.repository.split('/')[0]}:{claim.branch}", safe="")
        candidates = forge.collection(f"pulls?state=all&head={head}&per_page=100")
        if len(candidates) > 1:
            raise ValueError("Multiple delivery PRs require human reconciliation")
        if not candidates:
            return None
        claim.pr = number_value(candidates[0]["number"])
    pr = verified_pr(claim, forge)
    if pr.get("state") == "open":
        forge.mark_owned(number_value(pr["number"]))
    return pr


def report_stopped(site: Installation, forge: GitHub, claim: Claim) -> None:
    site.save(claim)
    try:
        publication(claim, forge)
    except Exception as error:
        # Defer an unknown PR until publication can be observed; never guess no PR.
        claim.report_error = f"Publication must be reconciled before reporting: {error}"
        claim.next_action = "Restore GitHub access, then run tick to reconcile publication and report the stopped delivery."
        site.save(claim)
        if claim.pr is None:
            return
    reporting.stopped(site, claim)


def reconcile_one(site: Installation, forge: GitHub, claim: Claim) -> None:
    if claim.status == "released" or alive(claim.process):
        return
    if claim.process is None and not claim.execution_ended:
        raise ValueError(
            "Execution identity unavailable; reconcile original launch before releasing capacity"
        )
    pr = publication(claim, forge)
    if claim.status in {"needs-attention", "cancelled"}:
        reporting.stopped(site, claim)
    if pr is not None and pr.get("state") == "open":
        claim.status = "pr-open"
    else:
        forge.release(claim.issue)
        claim.status = "released"
    site.save(claim)


def reconcile(site: Installation, forge: GitHub, launch: object = None) -> None:
    for claim in site.repository_claims():
        try:
            reconcile_one(site, forge, claim)
        except Exception as error:
            # Unavailable execution/publication evidence cannot release ownership.
            claim.needs_attention(f"Reconciliation needs attention: {error}")
            site.save(claim)
