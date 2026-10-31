# ADR-0012: Keep native goal ownership in the main thread

Status: Accepted
Date: 2026-10-30
Summary: Keep the native goal, acceptance criteria, user decisions, and completion in the main thread; delegate bounded work without transferring goal ownership.
Supersedes: ADR-0004

## Context

ADR-0004 selected host-native execution instead of a second Darrow execution
controller. Its owner boundary placed the whole goal in one subagent. The
current [Adaptive Goal specification](../specs/adaptive-goal.md) keeps the goal
in the original main thread and delegates bounded assignments. Both sources
remained current, leaving ownership contradictory.

## Decision

The original main thread owns the native goal, acceptance criteria, user
decisions, and completion. It may delegate bounded implementation assignments
and delegates selected verification. Those assignments do not acquire the
delivery goal.

Capabilities retain their assessment protocols, internal delegation, and
reviewer routes. Explicit invocation, readiness, publication authority, and
completion requirements remain governed by the Adaptive Goal specification.

Darrow continues to rely on native execution, recovery, and continuation. It
adds no second controller, goal-owner transport, phase ledger, daemon, or queue.
The ticket pipeline remains a reference and benchmark baseline.

## Authority and provenance

- **User statement, 2026-10-30:** “Treat the current spec’s main-thread ownership
  as intended and reconcile ADR-0004.”
- **Repository fact:** [Adaptive Goal](../specs/adaptive-goal.md#selected-design)
  and the [shipped skill](../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/SKILL.md)
  already describe main-thread ownership and bounded delegation.

## Consequences

- ADR-0004 is historical; its subagent-owner boundary is superseded.
- Architecture explanations and guide answers follow this decision and the
  current specification instead of presenting that boundary as an open conflict.
- This reconciliation changes documentation and eval expectations, not the
  runtime implementation or its authority.
