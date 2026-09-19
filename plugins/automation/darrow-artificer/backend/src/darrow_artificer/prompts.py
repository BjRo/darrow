"""An explicit unattended recipe envelope and exact-payload native continuation."""

import json

from .installation import Installation
from .models import Claim


def initial(site: Installation, claim: Claim) -> str:
    grant = site.grant
    receipt = {
        "grant": grant.id,
        "grantor": grant.grantor,
        "repository": grant.repository,
        "issue": claim.issue,
        "delivery": claim.id,
        "activation": claim.activation,
        "effects": grant.effects,
        "worktree": claim.worktree,
        "branch": claim.branch,
    }
    return (
        "Authorized unattended Artificer entry, based on a saved human recurring grant.\n"
        "This is not a claim that a human invoked the recipe in this CLI thread.\n"
        f"Grant receipt: {json.dumps(receipt)}\n"
        f"Invoke ${grant.recipe} for https://github.com/{grant.repository}/issues/{claim.issue} "
        "through its documented unattended entry. Establish readiness before implementation. "
        f"Use the reserved worktree {claim.worktree} and branch {claim.branch}. "
        "The recipe delegates once to adaptive delivery; it alone selects one native engineering owner. "
        "Retain that exact owner and its model and effort. Do not create a replacement owner. "
        "The grant permits intended commits, non-force push and one verified PR, and excludes "
        "merge, auto-merge, deploy, release, unrelated changes, credit purchases and API fallback. "
        "Do not post issue comments yourself: the local adapter publishes the question you return. "
        "If a material answer is needed, return status question with the complete question, "
        "the exact canonical engineering owner in owner, detail, and null pr. "
        "For completion return pr-open with the PR number, exact owner, detail and null question. "
        "For failed readiness or unavailable native ownership return needs-attention. "
        "Your final result must match the supplied JSON schema. Relay owner-sourced facts only."
    )


def continuation(claim: Claim) -> str:
    if claim.native is None or claim.pending_answer is None:
        raise ValueError(
            "Continuation requires the original native owner and explicit human payload"
        )
    if not claim.native.owner:
        return (
            f"Authorized continuation of delivery {claim.id} in its original native parent. "
            "No engineering owner has been established yet. Continue the retained readiness/preflight "
            "with the complete decoded human answer below. Do not reinvoke the recipe. "
            "Only the existing adaptive-delivery delegation may establish the first owner after readiness. "
            "Return the original result schema, retaining any accepted native owner.\n"
            + json.dumps(claim.pending_answer, ensure_ascii=False)
        )
    return (
        f"Authorized Artificer continuation of delivery {claim.id}. "
        f"Use followup_task to the retained owner {claim.native.owner}. "
        "Do not spawn, fork, reroute, or repeat the recipe. Pass the decoded JSON string below "
        "as the complete message byte-for-byte, without a prefix or suffix. Wait for the same "
        "owner and relay its question, verified PR, or blocker using the original result schema.\n"
        + json.dumps(claim.pending_answer, ensure_ascii=False)
    )
