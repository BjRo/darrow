# ADR-0017: Limit automation to authorized admission

Status: Accepted
Date: 2026-11-21
Summary: Let Artificer admit nominated work under a saved recurring grant while the original native session owns engineering execution and recovery.

## Context

Recurring delivery needs explicit authority, duplicate prevention and capacity
limits. Reimplementing engineering continuation in the scheduler would create a
second workflow owner and make recovery or uncertain publication harder to reconcile.

## Decision

Artificer owns local scheduling, eligibility, claims and shared capacity under a
saved human recurring grant. Installing it starts no schedule. The delivery
recipe preserves that grant, and the original native session retains the goal,
implementation, acceptance and completion.

Resume the same session for authorized technical recovery. Missing product intent
requires attention rather than autonomous discovery or an issue-comment answer
loop. Uncertain execution or publication keeps its reservation until reconciled.
Cancellation and revocation do not undo published effects.

Keep the current local macOS boundary explicit. Claude may produce a PR while
still returning `needs-attention` when native completion evidence is unavailable.
A PR alone is not proof of completed native work.

## Authority and provenance

Repository fact: this records the shipped admission and native-continuation
boundary in [the pre-cleanup implementation](https://github.com/BjRo/darrow/commit/2258e604793a8b405dd290ea275e9e1a23e7d716).
The maintainer requested retaining useful choices as ADRs on 2026-11-21.

## Consequences

Automation supplies no broader engineering, merge, release or deployment
authority. Current setup, recovery commands and capacity rules live with Artificer.
