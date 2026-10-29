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
        (
            f"/darrow-ticket-to-pr:{grant.recipe} "
            if grant.host == "claude"
            else f"${grant.recipe} "
        )
        + "Authorized unattended Artificer entry, based on a saved human recurring grant.\n"
        "This is not a claim that a human invoked the recipe in this CLI thread.\n"
        f"Grant receipt: {json.dumps(receipt)}\n"
        f"Deliver https://github.com/{grant.repository}/issues/{claim.issue} "
        "through its documented unattended entry. Establish readiness before implementation. Require Adaptive Goal, verification and independent review. Other plugins are optional: use applicable installed capabilities; otherwise use native abilities while preserving the required outcomes and all refusals. "
        "Caller option: if a standalone readiness provider is absent, omit the default "
        "standalone readiness gate while retaining read-only preflight and stopping for "
        "missing material intent. Never waive a present provider's refusal. "
        f"Use the reserved worktree {claim.worktree} and branch {claim.branch}. "
        "Load and follow the recipe and its Adaptive Goal handoff in this original main thread. "
        "This thread retains the native goal and coordinates bounded implementation and capabilities. "
        "Adaptive Goal owns their routing and workflow. Do not launch an overall owner child. "
        "The grant permits intended commits, non-force push and one verified PR, and excludes "
        "merge, auto-merge, deploy, release, unrelated changes, credit purchases, billing changes or authentication changes. "
        "Do not post issue comments yourself: the local adapter publishes your blocker report. "
        "If product intent or specification is missing, stop and return needs-attention with the complete blocker, "
        "detail, and null pr. Do not run discovery, write specifications or wait for an issue reply. "
        "For completion return pr-open with the PR number, detail and null question, "
        "only after the native goal is complete and the recipe's evidence is satisfied. "
        "For failed readiness or unavailable native ownership return needs-attention. "
        "Headless Claude native activation interface: only after complete read-only preflight "
        "and ready evidence, if model-side native goal activation is unavailable and no goal "
        "is already active, return status goal-required, detail, null question/pr and goal "
        "equal to your complete prepared objective (1-4000 characters). Yield without "
        "engineering. The client enters native /goal with that exact objective in this "
        "same session; continue only after its native kickoff. Never request a replacement goal. "
        "At each terminal boundary return one JSON object with exactly status, detail, "
        "question, pr and goal (null except an activation request), including after automatic "
        "native continuation. Report observed facts only."
    )


def recovery(claim: Claim) -> str:
    return (
        f"The execution transport for Artificer delivery {claim.id} recovered. "
        "Resume the existing task in this original native session using its retained history, "
        "goal, authority and evidence. Do not reinvoke the recipe or create a new owner or goal. "
        "Reconcile existing effects before continuing. Missing product intent remains a blocker. "
        "Return the original status/detail/question/pr JSON result at the terminal boundary."
    )
