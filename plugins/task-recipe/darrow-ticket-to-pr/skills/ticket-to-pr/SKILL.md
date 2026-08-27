---
name: ticket-to-pr
description: Deliver one ready authoritative ticket as exactly one verified pull request when the user explicitly invokes ticket-to-pr. Use for explicit `$ticket-to-pr <ticket>` delivery requests; do not use for ordinary ticket discussion, implementation, planning, or pull-request requests without explicit recipe authority.
---

# Ticket to PR

This explicitly invoked task recipe owns only ticket-specific authority,
readiness interaction, and pull-request outcome semantics. It delegates exactly
one bounded delivery request to an available adaptive native-goal capability.
It has no runtime, ledger, phase graph, retry loop, durable state, Git/forge
implementation, or post-goal inspection.

## 1. Confirm authority

Continue only when the user explicitly invoked `ticket-to-pr`. Ordinary ticket
intent, a request to implement, a named ticket, or a parent that is not an
explicitly invoked task recipe is insufficient. Before helper calls or mutation,
return exactly:

```text
format: darrow-ticket-to-pr-authority-stop-v1
status: invocation_required
reason: explicit-ticket-to-pr-invocation-required
```

## 2. Resolve one authoritative request

Accept exactly one stable ticket reference through an available capability whose
public intent is to read one ticket, or one authoritative ticket request supplied
directly in the conversation. Do not name or assume a provider, command, sibling
plugin, serialization, or agent type. Missing, ambiguous, contradictory,
blocked, or declined authority stops before mutation with the smallest useful
next action.

Preserve the exact ticket, canonical link when available, desired outcome, and
acceptance criteria. The recipe does not inspect repository state: adaptive-goal
owns preparation and decides whether pre-existing work is ticket-owned,
unrelated, or ambiguous.

## 3. Compose readiness before delegation

Request an available implementation-readiness capability using the resolved
ticket and this composed contract. Request a human-readable result. Do not
write a native-goal contract, select workflow/risk/model/effort/route/reviewer,
or assess readiness again inside the goal.

- `ready`: preserve its concrete quality bar as same-scope evidence and continue.
- `needs-decision`: ask the smallest question verbatim, relay the explicit answer,
  then rerun readiness before any delivery mutation.
- `needs-discovery`: offer discovery but do not invoke it without matching
  authority.
- `blocked`, unavailable, or declined: stop with zero delivery mutation.

## 4. Delegate once with bounded authority

Delegate exactly once to an available adaptive native-goal capability. Preserve
the explicit recipe invocation, originating request, ticket authority, ready
quality bar, and this envelope. The delegated request must include:

- authoritative ticket and canonical link when available; outcome, acceptance
  criteria, scope, non-goals, and concrete readiness quality bar;
- the exact opaque canonical token supplied by the active ticket provider. A
  derived branch must use a Conventional Commit type and lead with that token
  once (`<type>/<token>-…`); do not map it to another provider's format. If it
  is absent, ask one smallest question before Git mutation;
- pre-existing work is user-owned: ticket-owned overlap may proceed as
  preserved work; unrelated or ambiguous overlap stops;
- authority to create or reuse one task branch, create intended Conventional
  Commits, non-force push, and create or reuse exactly one pull request; and
- prohibition of merge, auto-merge, deployment, release, ticket mutation,
  reviewer assignment, labels, milestones, force operations, and unrelated
  effects.

Require a deliberate base, committed work ahead of it, current-content
verification, applicable selected-review clearance, a Conventional Commit title,
purpose/change body, ticket reference when known, applicable PR template, and
ready-for-review state unless draft was explicitly requested. Observe ambiguous
publication before retrying; ambiguous correlation stops, and an existing
correlated PR is never duplicated.

Do not include a workflow, risk, model, effort, route, reviewer, native-goal
contract, ledger path, or runner choice. Do not invent metadata fields such as
`caller_kind` or require special child invocation syntax.

## 5. Relay and report

Relay an adaptive-goal human-feedback question and the user's explicit answer
verbatim to the same active owner. After it returns, preserve its ticket,
repository, PR URL, created-versus-reused state, current-content verification,
and selected-review evidence without repository/forge reinspection, repair,
reverification, replacement goal, or publication retry.

Completion is one verified pull request or the exact blocker. Never infer a
missing decision, create duplicate remote state, or claim a branch, commit, or
URL alone proves ticket fulfillment. On completion, explicitly identify the
one pull request in the user-visible result.
