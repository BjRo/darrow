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
7. Invoke and await the available `adaptive-goal` skill with the complete
   ticket, repository context, and original authority.
8. Respect its `decision-gated` stop; otherwise let its native goal own the
   authorized delivery and invoke the matching Git and review capabilities.
9. Verify the resulting repository and pull-request state directly.
10. Return one concise terminal result.

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
Do not mutate the repository.

## 2. Check repository safety

After reading the ticket, resolve the current repository. Never search for or
clone another repository. Read applicable `AGENTS.md` and `CLAUDE.md`
instructions. Record the base, HEAD, remotes, staged, unstaged, and untracked
paths. Preserve existing work; stop before mutation when its ownership is
unrelated or unclear.

Reconstruct ticket-correlated branches, commits, remote branches, pull
requests, and current verification evidence. Reuse an unambiguous match. Do
not create a duplicate or private workflow ledger.

## 3. Invoke adaptive-goal

When the ticket is authoritative and the repository is safe, invoke and await
exactly one available skill named `adaptive-goal`. Its public intent must be to
compile one bounded engineering request and activate it as a host-native goal
with a proportionate workflow, risk gate, model, and effort. Do not merely
describe that handoff or replace its preflight with direct implementation or a
generic goal tool.

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

Adaptive-goal owns the implementation decision. Its read-only preflight stops
as `decision-gated` when required behavior, authority, or another product
decision is missing. Report that as `stopped` with its smallest missing
decision. If `adaptive-goal` is unavailable or does not match that intent, or
the invoked skill cannot complete its required preflight or launch, report
`blocked`.

When preflight proceeds, the native goal owns branching, implementation,
recovery, verification, review selection and execution, committing, pushing,
and pull-request creation or reuse. Do not repeat those mutations in the recipe
parent. When the goal returns, treat its report as a claim and verify the
durable state yourself.

Put these public capability intents in the delegated contract:

- reuse the reconstructed ticket branch, or create one new conventional Git
  branch for the ticket;
- create exactly one new commit for each intended coherent commit that remains
  necessary;
- when adaptive-goal selects review, independently review the exact current
  code change against the ticket and repository standards; and
- publish the committed work by pushing the current feature branch and opening
  exactly one review-ready pull request, or report the existing correlated one.

The goal works in the resolved repository on a distinct task branch descended
from the deliberate base. Include linked-worktree creation intent only when the
user explicitly requested a worktree. When repository instructions declare an
exact compatible contract for one of these intents, use that contract as the
capability implementation.

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

Reuse an existing matching pull request. Retry a failed creation call only
after read-only forge inspection proves that it created no correlated pull
request. Stop on an ambiguous result rather than risking a duplicate.

## 5. Return the result

Report the outcome in a short, human-readable form. Always identify the ticket
and one of these outcomes: `pr_created`, `pr_existing`, `stopped`, `blocked`, or
`interrupted`.

For `pr_created` or `pr_existing`, include the verified pull-request URL,
verification result, and review result. For `stopped`, `blocked`, or
`interrupted`, state the reason and the smallest useful next action. Preserve
any durable branch, commit, remote, or pull-request state that already exists.
Do not invent unavailable details or list empty fields.

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
