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
        "Load and follow the recipe and its Adaptive Goal handoff in this original main thread. "
        "This thread retains the native goal and coordinates bounded implementation and capabilities. "
        "Adaptive Goal owns their routing and workflow. Do not launch an overall owner child. "
        "The grant permits intended commits, non-force push and one verified PR, and excludes "
        "merge, auto-merge, deploy, release, unrelated changes, credit purchases, billing changes and API fallback. "
        "Do not post issue comments yourself: the local adapter publishes the question you return. "
        "If a material answer is needed, return status question with the complete question, "
        "detail, and null pr. Preserve the current goal while awaiting the actual answer. "
        "For completion return pr-open with the PR number, detail and null question, "
        "only after the native goal is complete and the recipe's evidence is satisfied. "
        "For failed readiness or unavailable native ownership return needs-attention. "
        "At each question or terminal boundary return one JSON object with exactly status, detail, "
        "question and pr, including after automatic native continuation. Report observed facts only."
    )


def continuation(claim: Claim) -> str:
    if claim.native is None or claim.pending_answer is None:
        raise ValueError(
            "Continuation requires the original native thread and explicit human payload"
        )
    return (
        f"Authorized Artificer continuation of delivery {claim.id} in this original main thread. "
        "Continue the retained readiness/preflight or existing goal with its decisions, "
        "acceptance, bounded assignments and repair history. Do not repeat the recipe, create "
        "a replacement goal or launch an overall owner child. This is the authorized human "
        "answer: preserve the complete decoded JSON string, including whitespace. A pending "
        "question can now use that answer; no additional authority is implied. "
        "Return the original status/detail/question/pr JSON object at the next question or "
        "terminal boundary.\n" + json.dumps(claim.pending_answer, ensure_ascii=False)
    )
