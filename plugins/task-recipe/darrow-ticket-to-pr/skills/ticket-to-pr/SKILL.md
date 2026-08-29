---
name: ticket-to-pr
description: Deliver one ready authoritative ticket as exactly one verified pull request or resume its recorded blocker. Use for explicit `$ticket-to-pr <ticket>` delivery requests and unambiguous answer, continue, retry, or ignore responses targeting this thread's existing Ticket-to-PR delivery; do not use for ordinary ticket discussion, implementation, planning, or unrelated pull-request requests.
---

# Ticket to PR

This explicitly invoked task recipe owns only ticket-specific authority,
readiness interaction, and pull-request outcome semantics. It delegates exactly
one bounded delivery request to an available adaptive native-goal capability.
It has no runtime, ledger, phase graph, retry loop, durable state, Git/forge
implementation, or post-goal inspection.

## 1. Confirm authority

Continue only when the user explicitly invoked `ticket-to-pr`, or when this
same host thread already contains exactly one blocked Ticket-to-PR adaptive
owner and the user's unambiguous answer, `continue`, `retry`, or `ignore this
and continue` response targets its recorded blocker. Ordinary ticket intent, a
request to implement, a named ticket, a fresh conversation without explicit
recipe invocation, or a parent that is not an explicitly invoked task recipe
is insufficient. Before helper calls or mutation, return exactly:

```text
format: darrow-ticket-to-pr-authority-stop-v1
status: invocation_required
reason: explicit-ticket-to-pr-invocation-required
```

For a valid same-thread continuation, preserve the original explicit recipe
authority but do not invoke this recipe again, reread the ticket, rerun intake,
prepare another branch, repeat delegation, or create a replacement goal. Go
directly to **Relay and report** with the retained owner and objective.

## 2. Resolve one authoritative request

Accept exactly one stable ticket reference through an available capability whose
public intent is to read one ticket, or one authoritative ticket request supplied
directly in the conversation. Do not name or assume a provider, command, sibling
plugin, serialization, or agent type. Missing, ambiguous, contradictory,
blocked, or declined authority stops before mutation with the smallest useful
next action.

Preserve the exact ticket, canonical link when available, desired outcome,
acceptance criteria, and exact opaque canonical token in the active ticket
provider's `ticket-token: N` field. Consume that provider field directly; do
not normalize, map, derive, or prompt-inject a token. If the provider output
lacks that field, ask one smallest question and perform no Git mutation.

Invoke the exact-ticket reader before branch preparation and retain its returned
`ticket-token:` line as the only token source. A token mentioned in a user
prompt, fixture description, branch convention, or reader instructions is not
provider output and must not be used as a substitute.

## 3. Prepare the attribution branch

Immediately after resolving the ticket and token, before readiness, request an
available compatible Git capability to create or reuse and switch to the exact
ticket-linked task branch. When the user explicitly requested a worktree,
request preparation there instead, leave the caller's checkout untouched, and
use the returned absolute worktree path as the execution context for readiness
and every later capability. This additive branch-only effect is already
authorized by the explicit recipe invocation and makes automatic branch-inferred
observability attribute readiness and later delivery turns to the authoritative
ticket.

The branch must use a Conventional Commit type and lead with the opaque token
exactly once (`<type>/<token>-…`). Reuse only an unambiguously correlated branch;
otherwise create one from a deliberate base through the matching capability. If
the current branch already satisfies that exact correlation, keep it. Preserve
uncommitted work and every existing ref. Refuse conflicts, ambiguous correlation,
an unsafe base, or any operation requiring reset, stash, discard, force, or
commit. If no compatible capability is available, stop with the smallest useful
next action.

The recipe requests the branch outcome by public intent and does not implement
Git mechanics or duplicate adaptive-goal's later ownership judgment. Keep the
prepared branch or worktree active across a non-ready result; never roll it back
or delete it merely because delivery pauses or stops.

## 4. Compose readiness before delegation

Request an available implementation-readiness capability using the resolved
ticket and this composed contract, from the prepared execution context. Request
a human-readable result. Do not
write a native-goal contract, select workflow/risk/model/effort/route/reviewer,
or assess readiness again inside the goal.

- `ready`: preserve its concrete quality bar as same-scope evidence and continue.
- `needs-decision`: ask the smallest question verbatim, relay the explicit answer,
  then rerun readiness before implementation or further delivery mutation.
- `needs-discovery`: offer discovery but do not invoke it without matching
  authority.
- `blocked`, unavailable, or declined: stop with no mutation beyond the
  preserved additive task branch.

## 5. Delegate once with bounded authority

Delegate exactly once to an available adaptive native-goal capability. Preserve
the explicit recipe invocation, originating request, ticket authority, ready
quality bar, and this envelope. The delegated request must include:

- authoritative ticket and canonical link when available; outcome, acceptance
  criteria, scope, non-goals, and concrete readiness quality bar;
- the exact opaque canonical token supplied by the active ticket provider and
  the already active, unambiguously correlated task branch that leads with it,
  plus the returned worktree path when one was explicitly requested;
- pre-existing work is user-owned: ticket-owned overlap may proceed as
  preserved work; unrelated or ambiguous overlap stops;
- authority to use the prepared task branch, create intended Conventional
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

## 6. Relay and report

Relay an adaptive-goal human-feedback question and the user's explicit answer
verbatim to the same active owner. After it returns, preserve its ticket,
repository, PR URL, created-versus-reused state, current-content verification,
and selected-review evidence without repository/forge reinspection, repair,
reverification, replacement goal, or publication retry.

When the same adaptive owner has settled blocked, relay an unambiguous answer
or qualifying `continue` to that owner only when it resolves or authorizes the
recorded blocker. Relay unqualified `retry` as authority for one attempt at the
exact failed operation. For ambiguous push or pull-request creation, require
the owner to observe current remote or forge state first; reuse a matching
effect, retry only when it is observed not completed, and remain blocked on
ambiguous correlation. Do not retry deterministic unchanged failure or review
evidence.

Relay `ignore this and continue` only as a waiver request. The adaptive owner
may record it for a discretionary Darrow-selected gate, but must refuse it for
repository policy, safety, authorization, selected-review requirements owned by
the user or repository, and truthful verified-PR completion. Skipping an
essential ticket condition requires an explicitly revised authoritative
outcome.

Keep the same owner, objective, task branch, ticket authority, gates, and one-PR
envelope through every blocked continuation. Do not close it or release its
objective merely because it is blocked. Cleanup occurs only on completion,
explicit abandonment or supersession, or host-thread destruction. A fresh
conversation requires explicit Ticket-to-PR invocation and may reuse only
unambiguously correlated repository and pull-request facts.

Completion is one verified pull request or the exact blocker. Never infer a
missing decision, create duplicate remote state, or claim a branch, commit, or
URL alone proves ticket fulfillment. On completion, explicitly identify the
one pull request in the user-visible result.
