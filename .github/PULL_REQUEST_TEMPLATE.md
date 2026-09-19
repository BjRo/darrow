<!--
Thanks for contributing to Darrow.

Before opening this pull request, read CONTRIBUTING.md, including the
contribution licensing terms. Replace the comments below with concise,
reviewer-focused context. Use "Not applicable — <reason>" when a section or
check does not apply.
-->

## Why

<!--
What problem or opportunity does this address? Link a related issue when one
exists (for example, "Closes #123").
-->

## What changed

<!--
Summarize the reviewer-visible behavior and design changes. Name affected
plugins, specifications, or documentation where that helps orient the review.
-->

## Verification

<!--
List the exact checks you ran and their results. For plugin scripts, include
both bash and /bin/bash. For skill behavior, include the relevant evals and any
matched control evidence required by the repository guidance.
-->

## Review notes

<!--
Call out compatibility, migration, security, licensing, or follow-up concerns,
and direct reviewers to the riskiest parts. Write "None" when there are none.
-->

## Checklist

- [ ] I have read and followed `CONTRIBUTING.md`, including the contribution
      licensing terms.
- [ ] I added or updated the applicable invariant before implementation, or
      this change does not affect a capability invariant.
- [ ] I added or updated colocated evals, or this change does not affect skill
      behavior.
- [ ] I confirmed that each changed plugin remains self-contained, or this
      change does not affect plugin content.
- [ ] I ran `bun run check:python`, or this change does not affect registered
      Python packages or their repository quality infrastructure.
