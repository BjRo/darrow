# ADR-0017: Limit automation to authorized admission

Status: Accepted
Date: 2026-11-21
Summary: Limit recurring automation to admitting nominated work under an explicit grant. The original native session owns engineering execution and recovery.

Darrow ships no automation plugin. The Artificer retirement is recorded in the
[retirement commit](https://github.com/BjRo/darrow/commit/796d29d151433fd21722a947ee71d41d97c8db90).
For recovery of an existing installation, follow the
[automation README](../../plugins/automation/README.md).

## Context

Recurring delivery needs explicit authority, duplicate prevention and capacity
limits. Reimplementing engineering continuation in the scheduler would create a
second workflow owner and make recovery or uncertain publication harder to reconcile.

## Decision

Automation owns scheduling, eligibility, claims and shared capacity under an
explicit recurring grant. Installing Artificer started no schedule. The delivery
recipe preserves that grant, and the original native session owns the goal,
implementation, acceptance and completion.

The original native session must provide completion evidence. A PR alone is
insufficient evidence that the original native session completed.

Resume the same session for authorized technical recovery. Missing product intent
requires attention rather than autonomous discovery or an issue-comment answer
loop. Uncertain execution or publication keeps its reservation until reconciled.
Cancellation and revocation do not undo published effects.

The former Artificer implementation had a local macOS boundary. In that
implementation, Claude could produce a PR while still returning
`needs-attention` when native completion evidence was unavailable.

## Authority and provenance

Repository fact: this records the shipped admission and native-continuation
boundary in [the pre-cleanup implementation](https://github.com/BjRo/darrow/commit/2258e604793a8b405dd290ea275e9e1a23e7d716).
The maintainer requested retaining useful choices as ADRs on 2026-11-21.

## Consequences

Automation supplies no broader engineering, merge, release or deployment
authority.
