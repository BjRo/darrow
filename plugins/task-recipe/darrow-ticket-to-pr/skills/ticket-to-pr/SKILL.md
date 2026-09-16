---
name: ticket-to-pr
description: Start only for explicit invocation of the ticket-to-pr recipe. Never select for ordinary ticket reading, implementation, branch work, feedback, or pull-request requests, even when they describe the same delivery outcome. This shortcut delegates one ticket-to-PR delivery request to adaptive-delivery.
disable-model-invocation: true
---

# Ticket to PR

Turn the explicit shortcut into one bounded adaptive-delivery request. Own the
delivery authority envelope, not the delivery workflow.

## 1. Require one explicit ticket

Proceed only when the user explicitly invoked this recipe in the current host
thread. Invocation by an unrelated helper, ordinary ticket or engineering
intent, and a later answer to another workflow do not count.

Require exactly one ticket ID or supplied ticket URL. Treat it as opaque input:
do not read or validate the ticket, derive a provider token, inspect the
repository, choose a branch name, run readiness, or mutate anything. If the
reference is missing or ambiguous, ask only for the one exact ID or URL and
stop.

Preserve any explicit request for a named base, linked worktree, draft pull
request, or finite repair/review limit. Do not invent one or supply a recipe
repair default; adaptive-delivery owns that policy.

## 2. Delegate the shortcut once

Invoke exactly one available capability whose advertised intent is
adaptive-delivery orchestration. This explicit recipe invocation authorizes that
delegation without a second user invocation. If no single unambiguous such
capability is available, return `Status: launch_required`, name the missing or
ambiguous adaptive-delivery boundary, and make no mutation.

Native goal controls such as `create_goal` only record or start a current-thread
goal; they do not supply adaptive-delivery's preflight and separate-owner
orchestration. Do not call them as a substitute. If only such controls are
available, treat the adaptive-delivery capability as unavailable. A differently
named capability is valid when it advertises the matching orchestration
contract; do not require a fixed plugin name or path.

Pass one concise request that preserves the exact ticket reference and says:

> Read and implement `<ticket>` in the current repository on a new
> ticket-linked branch. Establish or reuse readiness before mutation, preserve
> existing user work, verify the result, create the intended Conventional
> Commit or commits, push without rewriting history, and create or reuse exactly
> one verified pull request when ready. Use a linked worktree, named base, or
> draft pull request only when the user explicitly requested it.
>
> Completion must include owner-sourced evidence that the remote branch and
> exactly one open PR both have the intended verified commit as their head,
> with the requested repository, base and draft state. An existing URL alone
> does not satisfy publication of additional local commits.
>
> When the ticket or verification contract requires reviewer-facing evidence,
> bind one compatible host-advertised evidence-publication capability and make
> at most one operation against only that exact current-repository PR and
> intended verified commit. This grants no generic comment authority. A
> partial, ambiguous, refused, or changed-head result stops completion and
> recovery.

Include this authority boundary in the same request:

- authorized: read the one ticket, prepare or reuse its new branch, implement
  and verify its scope, create intended commits, non-force push, and create or
  reuse one pull request, plus one same-PR candidate-bound evidence operation
  only when the ticket or verification contract requires reviewer-facing evidence;
- not authorized: merge or auto-merge, deploy, release, mutate the ticket,
  assign reviewers, add labels or milestones, rewrite history, discard or stash
  user work, make unrelated changes, post generic comments, publish evidence
  to another PR, recover an uncertain evidence attempt, or perform another
  external effect.

Preserve the originating request and explicit recipe authority. Do not add a
workflow, risk, model, effort, route, readiness result, branch name, capability
name, owner protocol, or verification command. `adaptive-delivery` selects and binds
those from current context.

Do not invoke ticket, readiness, Git, review, or forge capabilities in this
recipe. Do not perform preflight, launch an engineering subagent, implement,
verify, commit, push, or publish here. `adaptive-delivery` owns all of that after the
single delegation.

## 3. Stay at the main-thread boundary

Relay the adaptive-delivery response without repository or forge reinspection. A
ready result, non-ready result, owner question, blocker, or completion remains
its result; do not add a recipe retry, waiver, recovery, or status protocol.

When its separate owner asks a material question, surface that question from
this main thread. A later user answer continues the same adaptive-delivery owner in
this thread. Do not invoke Ticket-to-PR again, answer or rewrite the question,
launch a replacement owner, or perform the owner's work in the main thread.

Completion is the owner-sourced URL and intended/published commit evidence for
exactly one verified pull request. Preserve that complete URL and commit
evidence when relaying or summarizing completion; a PR number alone is
insufficient. Required reviewer evidence also needs its outcome, identity,
comment URL, attachment/rendering observations and any partial effects. A
partial, ambiguous or refused outcome remains a blocker. If the owner omitted required evidence, relay that gap instead
of claiming completion or inspecting the forge yourself. Otherwise relay the
exact current question or blocker and its smallest next action.
