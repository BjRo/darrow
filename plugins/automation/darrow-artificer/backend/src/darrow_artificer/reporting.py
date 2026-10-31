"""One source-issue blocker report, persisted before its potentially ambiguous effect."""

from .github import GitHub
from .installation import Installation
from .models import Claim


def stopped(site: Installation, claim: Claim) -> None:
    if claim.report_state != "none":
        return
    claim.next_action = "Resolve the blocker outside Artificer; inspect the original native session and any published effects before recovery or a new nomination."
    claim.report_state = "pending"
    site.save(claim)
    pr = (
        f"\nPR: https://github.com/{site.grant.repository}/pull/{claim.pr}"
        if claim.pr
        else ""
    )
    try:
        claim.report_comment = GitHub(site.grant.gh, site.grant.repository).comment(
            claim.issue,
            f"Artificer delivery `{claim.id}` stopped.\n\n{claim.detail}{pr}\n\nNext action: {claim.next_action}",
        )
        claim.report_state = "posted"
    except Exception as error:
        # Publication boundary: the comment may exist despite a failed response.
        claim.report_state = "uncertain"
        claim.report_error = str(error)
    site.save(claim)
