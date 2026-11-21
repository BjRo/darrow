# ADR-0016: Keep independent review separate from acceptance

Status: Accepted
Date: 2026-11-21
Summary: Review standards and requested behavior independently, verify repairs against the original findings, and leave overall acceptance with the goal owner.

## Context

A change can meet the request while violating repository standards, or look
well-written while implementing the wrong behavior. Repeated comprehensive
reviews after each repair can also change the target and reset apparent progress.

## Decision

Use fresh read-only readers for repository standards and request conformance.
Bind their findings to the exact reviewed candidate and distinguish blocking
findings from advisory guidance. Review neither implements repairs nor grants
publication authority.

Verify repairs against the comprehensive review's closed finding set and retained
candidate history. Add only regressions directly caused by an attempted repair.
Content changes invalidate stale clearance. The owning workflow retains its
finite repair budget; another reader or provider does not create another budget.

The original goal owner accounts for every acceptance criterion using current
checks and evidence or an explicit gap. Review clearance alone is insufficient
for completion. Keep reviewer routing and evidence mechanics within the review
capability rather than copying them into its callers.

## Authority and provenance

Repository fact: the independent-review and repair contracts are preserved in
[the assurance change](https://github.com/BjRo/darrow/commit/1671d06586368cdf38101af4fef4ec34d7f29629)
and [the acceptance-accounting integration](https://github.com/BjRo/darrow/commit/2258e604793a8b405dd290ea275e9e1a23e7d716).
The maintainer requested retaining useful choices as ADRs on 2026-11-21.

## Consequences

Review remains independently usable. Required unavailable or inconclusive review
leaves a gap rather than permitting author self-review as a substitute. Public
skill instructions and schemas own the current protocol and report format.
