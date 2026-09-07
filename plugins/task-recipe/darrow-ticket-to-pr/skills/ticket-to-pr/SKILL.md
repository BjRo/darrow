---
name: ticket-to-pr
description: Turn one exact ticket into a new-branch implementation and one verified pull request through adaptive-goal. Use only when the user explicitly invokes ticket-to-pr with one ticket ID or URL; do not select for ordinary ticket reading, implementation, feedback, or pull-request work.
disable-model-invocation: true
---

# Ticket to PR

Turn the explicit shortcut into one bounded adaptive-goal request. Own the
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

Preserve any explicit request for a named base, linked worktree, or draft pull
request. Do not invent one.

## 2. Delegate the shortcut once

Invoke exactly one available capability whose advertised intent is
adaptive-goal orchestration. This explicit recipe invocation authorizes that
delegation without a second user invocation. If no single unambiguous such
capability is available, return `Status: launch_required`, name the missing or
ambiguous adaptive-goal boundary, and make no mutation.

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

Include this authority boundary in the same request:

- authorized: read the one ticket, prepare or reuse its new branch, implement
  and verify its scope, create intended commits, non-force push, and create or
  reuse one pull request;
- not authorized: merge or auto-merge, deploy, release, mutate the ticket,
  assign reviewers, add labels or milestones, rewrite history, discard or stash
  user work, make unrelated changes, or perform another external effect.

Preserve the originating request and explicit recipe authority. Do not add a
workflow, risk, model, effort, route, readiness result, branch name, capability
name, owner protocol, or verification command. Adaptive-goal selects and binds
those from current context.

Do not invoke ticket, readiness, Git, review, or forge capabilities in this
recipe. Do not perform preflight, launch an engineering subagent, implement,
verify, commit, push, or publish here. Adaptive-goal owns all of that after the
single delegation.

## 3. Stay at the main-thread boundary

Relay the adaptive-goal response without repository or forge reinspection. A
ready result, non-ready result, owner question, blocker, or completion remains
its result; do not add a recipe retry, waiver, recovery, or status protocol.

When its separate owner asks a material question, surface that question from
this main thread. A later user answer continues the same adaptive-goal owner in
this thread. Do not invoke Ticket-to-PR again, answer or rewrite the question,
launch a replacement owner, or perform the owner's work in the main thread.

Completion is the owner-sourced URL and intended/published commit evidence for
exactly one verified pull request. Preserve that complete URL and commit
evidence when relaying or summarizing completion; a PR number alone is
insufficient. If the owner omitted required evidence, relay that gap instead
of claiming completion or inspecting the forge yourself. Otherwise relay the
exact current question or blocker and its smallest next action.
