---
name: ticket-to-pr
description: Deliver one authoritative ticket in the current repository as exactly one verified pull request. Use only when the user explicitly invokes ticket-to-pr; do not select it for ordinary ticket discussion, implementation, or pull-request requests.
disable-model-invocation: true
---

# Ticket to pull request

Deliver one authoritative ticket as exactly one verified, review-ready pull
request. Start only through explicit `/ticket-to-pr` or `$ticket-to-pr`
invocation.

## Sequence

Follow this order. Do not replace a command result with an assumption or a
manually reconstructed result.

1. Require exactly one ticket identifier or one explicitly authoritative
   supplied ticket specification.
2. Read the ticket before starting any other workflow action.
3. Stop if the ticket cannot be read or its authority is missing, ambiguous,
   or contradictory.
4. Inspect the current repository and preserve all existing user work.
5. Reconstruct any existing branch, commits, remote branch, or pull request for
   the ticket.
6. Confirm that continuing is safe and within the invocation's authority.
7. If authoritative supplied evidence establishes a prior terminal result or
   completed adaptive-goal boundary, take the read-only historical return path
   below and do not launch or mutate. Otherwise invoke and await the available
   `adaptive-goal` skill with the complete ticket, repository context, and
   original authority before any implementation or publication mutation.
8. Respect its `decision-gated` stop; otherwise let its native goal own the
   authorized delivery and invoke the matching Git and review capabilities.
9. Capture the returned v4 launch record before doing anything else, then
   verify the resulting repository and pull-request state directly without
   changing branches or checkouts.
10. Return one concise terminal result.

Two boundaries in that sequence are non-optional:

- Except for the historical return and prelaunch stop cases named here, an
  authoritative safe request always invokes and awaits `adaptive-goal`. The
  recipe parent never performs readiness judgment or delivery in its place.
- When authoritative input says the adaptive native goal already completed
  the exact current content, take the historical return before loading or
  invoking `adaptive-goal`. Do not emit a launch record for that read-only
  path.

## 1. Read the ticket

Use authoritative ticket content supplied for this invocation. Otherwise,
invoke an available capability whose public intent is to retrieve one
authoritative ticket's content by stable identifier without mutation. A
list-only capability does not satisfy this intent. A ticket identifier alone
is not ticket content. When repository instructions declare an exact matching
read contract, execute it and use its result. Never infer ticket content from
the identifier, prompt wording, or repository instructions.

Establish one identifier, desired outcome, description, observable acceptance
criteria, and canonical link when available. Do not combine contradictory
sources or choose among multiple tickets without authoritative selection
criteria.

If no ticket was supplied, begin the response with:
`Missing input: exactly one ticket reference or one authoritative supplied specification is required.`
For this and every ambiguous or contradictory intake stop, immediately state
`Outcome: stopped`, name the smallest required clarification, and do not mutate
the repository. Refusal prose without the literal `stopped` outcome is not a
complete terminal result.

## 2. Check repository safety

After reading the ticket, resolve the current repository. Never search for or
clone another repository. Read applicable `AGENTS.md` and `CLAUDE.md`
instructions. Record the base, HEAD, remotes, staged, unstaged, and untracked
paths. Preserve existing work; stop before mutation when its ownership is
unrelated or unclear.

Resolve this ownership gate before invoking adaptive-goal. Unrelated or
unclear dirty work is a terminal `stopped` result for this recipe invocation:
do not launch a goal, create or switch branches, edit files, stage, commit,
push, or publish. Name the ambiguous paths and leave every repository byte and
ref unchanged. Ticket-owned dirty work may continue only when authoritative
ticket or repository evidence makes that ownership unambiguous.

An explicitly requested linked worktree is the narrow exception described by
the specification: after recording the original dirty checkout, invoke only
the exact compatible worktree contract declared by repository instructions.
Leave every original path byte-identical, perform subsequent delivery only in
the created worktree, and then invoke adaptive-goal there. The explicit request
and declared destination make this environment preparation unambiguous; they
do not authorize absorbing, stashing, or otherwise modifying the original
checkout's work.

Reconstruct ticket-correlated branches, commits, remote branches, pull
requests, and current verification evidence. Reuse an unambiguous match. Do
not create a duplicate or private workflow ledger.

When the invocation explicitly supplies authoritative historical terminal
classification or says the adaptive native goal already completed the exact
current content, reconstruct that durable boundary read-only. Do not reopen
completed implementation, launch another adaptive goal, or rewrite the event
classification. Verify current repository, forge, and review evidence and
return the supplied historical outcome, or `blocked` when its remaining gate
cannot complete. This exception does not apply to merely stale or partial work
whose supplied outcome still requires implementation or publication recovery.

This historical check is an early return before adaptive invocation. In
particular, do not finish interrupted work or recast historical `pr_created` as
`pr_existing` because the proposal exists now. Conversely, existing branch or
commit evidence with an unfinished implementation or publication gate is not
a terminal result: invoke adaptive-goal and let its goal owner perform that
recovery. The recipe parent never implements or publishes such remaining work.

## 3. Invoke adaptive-goal

When the ticket is authoritative and the repository is safe, invoke and await
exactly one available skill named `adaptive-goal`. Its public intent must be to
compile one bounded engineering request and activate it as a host-native goal
with a proportionate workflow, risk gate, model, and effort. Do not merely
describe that handoff or replace its preflight with direct implementation or a
generic goal tool.

Invoke `adaptive-goal` in the recipe parent and follow its complete preflight
and helper-selected launch sequence there. Do not spawn generic agents before
or alongside that invocation, ask them to imitate the capability, or use them
as substitute implementation or verification owners. Preserve the capability's
v4 launch record verbatim; never author one from expected values. Its reported
child count and selected/effective route must reconcile with the host-observed
native launch boundary. If they do not, report `blocked` without parent-owned
delivery mutation.

Executing adaptive-goal instructions inline in the recipe parent is not a
separate goal boundary. Never accept `same_thread` / `current-thread` merely
because those instructions are visible. That boundary is valid only when
concrete host-reported route metadata proves that this current thread already
runs the exact selected model and effort; otherwise adaptive-goal must use a
supported routed owner or return `launch_required` before mutation.

Retain the capability parent's prelaunch v4 record across the native goal
call. For a `native_subagent` boundary that record declares exactly one Darrow
child invocation. Do not replace it with a runner's inner-session count or
recompute it from the runner's descendants after return.

The explicit ticket-to-PR invocation is the orchestration entrypoint delegating
this one bounded request. Preserve the originating request and permissions;
delegation adds no authority. Give the capability:

- the authoritative ticket and acceptance criteria;
- the exact repository, deliberate base, and reconstructed ticket state;
- all preserved local work and known adjacent scope exclusions;
- authority for one ticket branch, intended commits, one non-force push, and
  exactly one review-ready pull request; and
- applicable repository checks, publication requirements, and prohibited
  effects.

When intake used a ticket-read capability, pass its complete returned content
and the fact that retrieval already succeeded—not only the identifier or URL.
The adaptive preflight treats that supplied content as authoritative intake
evidence and must not invoke the ticket-read capability again.

Adaptive-goal owns the implementation decision. Its read-only preflight stops
as `decision-gated` when required behavior, authority, or another product
decision is missing. Report that as `stopped` with its smallest missing
decision. If `adaptive-goal` is unavailable or does not match that intent, or
the invoked skill cannot complete its required preflight or launch, report
`blocked`. When repository instructions or the authoritative request already
establish that no compatible goal boundary exists, report `blocked` before
invoking it or performing any delivery mutation. Do not relabel unavailable
capability or route evidence as `stopped`.

When preflight proceeds, the native goal owns branching, implementation,
recovery, verification, review selection and execution, committing, pushing,
and pull-request creation or reuse. Do not repeat those mutations in the recipe
parent. When the goal returns, treat its report as a claim and verify the
durable state yourself. That post-goal verification is strictly read-only:
never replay branch, commit, push, or pull-request mutations there, including
when forge inspection is incomplete. Report an unverified or ambiguous durable
result as `blocked` instead of attempting another publication call. Remain on
the checkout and branch returned by the native goal: do not switch, restore,
reset, detach, or create a checkout as part of verification. A successful goal
must leave the delivered task branch checked out in the original repository;
work visible only in an Agent worktree or another checkout is not delivered.

Put these public capability intents in the delegated contract:

- reuse the reconstructed ticket branch, or create one new conventional Git
  branch for the ticket;
- create exactly one new commit for each intended coherent commit that remains
  necessary;
- when adaptive-goal selects review, independently review the exact current
  code change against the ticket and repository standards; and
- publish the committed work by pushing the current feature branch and opening
  exactly one review-ready pull request with an imperative Conventional Commit
  title describing the ticket work, or report the existing correlated one.

The goal works in the resolved repository on a distinct task branch descended
from the deliberate base. Include linked-worktree creation intent only when the
user explicitly requested a worktree. When repository instructions declare an
exact compatible contract for one of these intents, use that contract as the
capability implementation.

The deliberate base is immutable delivery input. Never rename, delete, reset,
or force-move it, including through `branch -m` / `branch -M`, `switch -C`,
`checkout -B`, or direct ref updates. Create the task branch only through the
declared compatible branch contract. If that contract fails, report `blocked`
before implementation instead of substituting another branch operation.

## 4. Verify the delivery

Before reporting success, verify directly that:

- the base still exists;
- the task branch is distinct from, descended from, and ahead of the base;
- the committed diff contains only the intended ticket work;
- the ticket acceptance check and required repository checks pass;
- any review selected by the adaptive goal completed without blocking
  findings;
- the remote branch contains the verified commit; and
- exactly one correlated pull request has the intended base, head, title,
  ticket reference, body, and ready-versus-draft state.

Reuse an existing matching pull request. Only the native goal owner may retry a
failed creation call, and only after read-only forge inspection proves that it
created no correlated pull request. The recipe parent never retries it. Stop on
an ambiguous result rather than risking a duplicate.

When that absence is proven, the failed call is recoverable rather than a
terminal result: the same native goal owner repeats the already validated
production creation call and continues until it succeeds or a genuine blocker
is established. Do not stop after the first transient failure, and do not use
a fixed retry count as the completion rule.

Before the first creation call, determine and validate the production base,
head, title, and body. A recovery retry repeats those production arguments only
after the required absence inspection. Never issue a placeholder, test, probe,
or syntax-discovery creation call; it still counts as a creation attempt.

A rejected pull-request title does not authorize rewriting an already valid
commit: choose a compliant lowercase Conventional Commit scope or omit the
scope, then retry only the proposal call under the rule above. Never amend the
commit, force-push, or rewrite history as publication recovery.

## 5. Return the result

Report the outcome in a short, human-readable form. Always identify the ticket
and one of these outcomes: `pr_created`, `pr_existing`, `stopped`, `blocked`, or
`interrupted`.

Use the outcome tokens literally and map them consistently:

- missing or ambiguous authoritative intake and `decision-gated` preflight are
  `stopped`;
- unavailable capabilities, routes, permissions, repository conditions,
  reviews, pushes, or proposal creation are `blocked`;
- a user, budget, or host interruption is `interrupted`.

A successful result uses the literal labels `Verification:` and `Review:`.
A non-success result names the exact blocker and the preserved durable branch,
commit, remote branch, or proposal state when any exists. For an unavailable,
blocking, inconclusive, or stale review, explicitly say `blocked`, `review`,
and the applicable condition. For dirty-work stops, explicitly name whether
the work is unrelated/ambiguous or ticket-owned and whether it was preserved.

Use one explicit terminal evidence line before any v4 record. Preserve these
facts and labels even when the surrounding prose is shorter:

- existing proposal: `Outcome: pr_existing. Verification: current checks
  passed. Review: <result>. Pull request: <URL>.`
- newly created proposal: `Outcome: pr_created. Verification: current checks
  passed. Review: <result>. Pull request: <URL>.`
- failed proposal creation after a durable push: `Outcome: blocked. Remote
  branch: pushed and preserved. Pull request: not created because creation
  failed.`
- unavailable required review: `Outcome: blocked. Review: required but no
  compatible reviewer is available.`
- routine review omission: `Review: omitted; not required for routine risk.`
- dirty-work capability block: `Outcome: blocked. Adaptive goal: unavailable.
  Existing ticket-owned work: preserved.`

Always include the authoritative ticket or specification identifier in that
terminal evidence. These labels report verified facts; they are not permission
to claim success that direct verification did not establish.

For `pr_created` or `pr_existing`, include the verified pull-request URL,
verification result, and review result. For `stopped`, `blocked`, or
`interrupted`, state the reason and the smallest useful next action. Preserve
any durable branch, commit, remote, or pull-request state that already exists.
When preservation of existing local work was part of the request, explicitly
report that the named work is `preserved`, `unchanged`, or `byte-identical`;
`remains` by itself is not preservation evidence.
Preserve adaptive-goal's complete v4 launch record verbatim when it returns
one, including every row from `format` through
`evaluation_human_interruptions`. Emit that exact record as a contiguous block
in this recipe's terminal response; a summary, paraphrase, or prose route claim
does not satisfy the handoff. Never report `pr_created` or `pr_existing` if the
record is missing or its child count and selected/effective route do not
reconcile with host evidence. Do not invent unavailable details or list empty
fields.

When the recipe returns before invoking adaptive-goal—such as missing intake,
authoritative unavailability, dirty-work ambiguity, or historical
reconstruction—no adaptive launch record exists. Omit the v4 record entirely;
do not synthesize a `launch_required` record for an invocation that never ran.

Before returning any v4 record, reconcile its boundary rows. A verified
`native_subagent` record has `route_applied_by` `native-subagent`,
`launch_boundary` `native_subagent`, and exactly one child invocation. A
`launch_required` stop has `effective_route` and `route_applied_by` set to
`none`, `route_verified` false, and zero child invocations. Never combine a
launched child with a launch-required record.

## Boundaries

- Do not invent ticket information or capability results.
- Do not discard, reset, stash, or absorb unrelated user work.
- Do not create duplicate branches or pull requests.
- Do not bypass hooks, force-push, or rewrite history.
- Do not merge, enable auto-merge, deploy, release, modify the ticket, assign
  reviewers, or apply labels or milestones.
- Do not create a worktree unless the user explicitly requested one.
- Do not substitute a similarly named tool, generic subagent, or direct command
  for an available intent-matched capability. When repository instructions
  declare its exact compatible contract, invoke that contract.
- Preserve durable branch, commit, remote, and pull-request state whenever the
  workflow stops or is interrupted.

Complete when exactly one verified pull request exists, or one honest terminal
result preserves the durable state and the reason delivery stopped.
