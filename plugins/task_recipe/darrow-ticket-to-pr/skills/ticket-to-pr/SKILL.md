---
name: ticket-to-pr
description: Deliver one ready, authoritative ticket in the current repository as exactly one verified pull request. Use only when the user explicitly invokes ticket-to-pr for one ticket; ordinary ticket discussion, implementation requests, or requests to open a pull request without naming this recipe must not select it.
disable-model-invocation: true
---

# Ticket to pull request

Turn one ready authoritative ticket into exactly one verified, review-ready
pull request. This task recipe is an explicit orchestration entrypoint. It
composes compatible environment capabilities and delegates continuation to one
adaptive host-native goal; it is not a workflow runtime.

## Invocation and authority

Start only when the user explicitly invokes the installed recipe for one
ticket, using `/ticket-to-pr` on Claude Code or `$ticket-to-pr` on Codex. A
natural-language request that merely names the desired outcome is not an
invocation. Complexity, ordinary implementation intent, ticket discussion, or
a request that merely ends with opening a pull request is not activation.

One valid invocation authorizes only these delivery effects in the current
repository:

- create or reuse one ticket-correlated task branch;
- create the intended commits needed for the ticket;
- push that branch without rewriting remote history; and
- create or reuse exactly one pull request, ready for review unless the user
  explicitly requested a draft.

It does not authorize merge, auto-merge, deployment, release, ticket mutation,
reviewer assignment, labels, milestones, unrelated external effects, repository
discovery or cloning, or an implicit worktree. Do not expand authority during
recovery. Create a linked worktree only when the invocation explicitly requests
one and a compatible environment capability supports it.

Require exactly one ticket input. If it is absent, ask for one stable reference
or one authoritative supplied specification and do nothing else. Stop before
delivery mutation if activation is not explicit, more than one request is in
scope, or required authority is missing.

## 1. Resolve read-only preflight

Do all intake and reconstruction before product, repository, or publication
mutation. OpenTelemetry observation may start here, but it is operational
evidence and grants no delivery authority.

1. Resolve the current repository; never search for or clone another one.
2. Resolve the ticket through an available host-visible ticket-read intent, or
   use authoritative content supplied directly in the conversation or an
   identified specification. Do not assume a provider, command, sibling
   plugin, or file outside this plugin.
3. Establish exactly one non-contradictory authoritative request: stable
   identifier when available, outcome, description, observable acceptance
   criteria, and canonical link when available. Do not invent precedence or
   combine conflicting sources. Missing, ambiguous, or contradictory authority
   ends as `stopped` with the smallest required decision.
4. Inspect repository instructions and record the current checkout, deliberate
   base, HEAD, remotes, and every staged, unstaged, and untracked path. Existing
   work belongs to the user. Continue in a dirty checkout only when every
   existing change is unambiguously part of this same ticket; otherwise stop
   before mutation. Never discard, reset, stash, or silently absorb it.
5. Reconstruct durable ticket-correlated facts: local branch, commits relative
   to the base, remote branch, open pull request, and verification or review
   evidence tied to exact content. Reuse only unambiguous correlations. Do not
   create private state, a ledger, `.darrow` evidence, or a duplicate proposal.
6. Discover compatible host-visible contracts for implementation readiness,
   adaptive native-goal execution, required independent review, bounded Git
   operations, and telemetry. Use intents and public contracts, never named
   provider assumptions. A missing required delivery capability ends as
   `blocked`; missing telemetry is `degraded`, not a delivery failure.
7. Confirm that every contemplated effect fits the invocation authority.

Invoke an available implementation-readiness capability read-only with the
complete authoritative request, repository evidence, and applicable
constraints. Preserve its full ordinary result and quality bar. Only its
`ready` verdict permits delivery mutation. Any other verdict ends as `stopped`
with the verdict and smallest next action; do not turn the run into implicit
discovery, planning, or ticket editing.

**Complete when:** the exact ticket, repository, preserved local work, durable
publication state, capability availability, authority, and a `ready` quality
bar are concrete, or one terminal result has been produced without delivery
mutation.

## 2. Compile one adaptive native goal

For a ready ticket, invoke one available environment capability matching this
public intent: compile the bounded engineering request into one adaptive
host-native goal with a task-appropriate workflow, proportional risk gate,
concrete model route, and independent-review selection. This recipe is the
explicitly invoked orchestration parent, so delegation does not require a
second user invocation and adds no authority.

Give that single goal owner the complete contract:

- originating invocation, authoritative ticket, readiness verdict, and exact
  quality bar;
- current repository, deliberate base, durable correlated state, and every
  preserved or excluded local path;
- observable acceptance criteria, scope, required affected tests/callers/docs,
  compatibility corrections, and explicit non-goals;
- authority for one task branch, intended commits, non-force push, and exactly
  one review-ready PR (or an explicitly requested draft), with all prohibited
  effects repeated;
- applicable repository checks, current-content evidence requirements, and
  plausible counterexamples proportional to risk;
- adaptive workflow, risk, selected and effective route, launch boundary, and
  review selection evidence; and
- required terminal delivery fields plus telemetry lifecycle and privacy
  requirements.

Require one auditable launch record from the compatible capability. Exactly one
native goal owns implementation, adaptation, recovery, verification, selected
review, Git publication, and completion. Do not add a phase graph,
planner/executor controller, private retry loop, durable phase state, background
supervisor, bundled SDK, or second Darrow runner. Stop `blocked` if no compatible
native-goal boundary can own the contract.

The goal may make coherent ticket-required changes to product code, tests,
callers, documentation, and compatibility. It must stop for an authorized
decision before adjacent product behavior or a materially broader effect.

**Complete when:** exactly one goal owner is active on a verified route with the
unchanged request and authority, or capability/route failure has produced a
terminal result.

## 3. Verify exact content and review proportionally

The readiness quality bar is the product oracle. Require focused acceptance or
characterization evidence and applicable repository gates. Elevated risk also
requires affected-caller or compatibility checks and a plausible
counterexample. High risk additionally requires an adversarial boundary or
state-transition check and independent final-tree review.

Independent review is selected separately from implementation discipline:

- routine risk omits it unless the user or repository requires it;
- elevated risk selects it when compatibility, caller impact, or counterexample
  judgment warrants it; and
- high risk selects it by default.

When selected, invoke an available environment capability matching
“independently review the exact current code change.” Supply the exact content
to publish, authoritative ticket, repository standards, and current check
evidence. Do no other repository work while that invocation is pending. Same-
context self-review is insufficient. Unavailable or inconclusive review blocks
publication. Blocking findings require only authorized repairs, rerunning
invalidated checks, and a new independent review of the changed exact content.
Any content edit invalidates prior verification and review evidence.

Never treat a branch, commit, earlier check, or PR URL as proof of completion.

**Complete when:** the exact committed content intended for the pull request
satisfies the ticket quality bar, applicable final checks, and every selected
review gate with no blocking findings.

## 4. Publish once and recover safely

Use compatible host-visible Git intents or public contracts; do not assume a
specific forge provider or sibling plugin. Choose a traceable branch name and a
deliberate base, defaulting to the repository's default branch unless the user
named another. Never reset, force-move, or silently replace an existing branch.
Conflicts stop branching and publication.

Commit only intended ticket-owned changes. Never silently include uncommitted
work. Preserve repository commit rules and hooks. Push without force or history
rewriting. Before creating a pull request, reconstruct open correlated proposals
again. Reuse one match and never create a second.

For a new proposal, use a Conventional Commit-compatible title and the selected
repository template. Explain why the change exists and what the committed
branch does, reference the ticket when known, and default to ready-for-review.
Do not merge or perform any unrequested forge mutation.

For a recoverable hook, push, or PR-creation failure, make the smallest
ticket-authorized correction, rerun invalidated evidence, and continue while
the goal can make meaningful progress. Never bypass hooks, force-push, broaden
scope, or stop because an arbitrary retry count elapsed. Genuine external
blocks, unavailable authority, user interruption, and explicit host budget are
terminal; preserve exact durable branch, commit, remote, and PR state for
re-entry.

An existing correlated PR is `pr_existing` only after its exact current content
passes all current gates. If incomplete, continue the same proposal. A newly
opened verified proposal is `pr_created`.

**Complete when:** exactly one verified proposal exists, or one honest terminal
stop preserves all durable state without unsafe mutation.

## 5. Emit telemetry and return one result

Through an available environment adapter, emit one correlated, versioned
OpenTelemetry lifecycle covering invocation and terminal outcome; ticket and
repository identity; intake and readiness; workflow, risk, selected/effective
route, launch boundary, and goal completion; invoked capability outcomes and
durations; branch/base/commit/remote/PR identity; verification and review;
retries, interruption, blockage, and degraded evidence. Reuse or correlate the
native goal's launch record. Do not reconstruct host turns, descendant agents,
or host-owned timing, and never use telemetry as workflow state.

Telemetry has its own status: `emitted` when a compatible adapter accepted the
lifecycle, `degraded` when none was available, or `failed` when an available
adapter failed. This status never changes a successful direct delivery outcome.

Never emit PII, credentials, authentication tokens, private keys, or other
secrets in attributes, events, errors, logs, prompts, ticket text, or diffs.
Omit unsafe content. Keep permitted non-sensitive content-bearing fields
separately controllable from core identifiers, outcomes, durations, and
correlation evidence. Do not bundle an SDK, exporter, collector, backend, or
dashboard.

Return exactly one serialization-neutral terminal record in this tab-separated
shape, using `unavailable` rather than inference:

```text
format\tdarrow-ticket-to-pr-result-v1
ticket\t<stable identity or supplied specification>
repository\t<absolute current repository>
outcome\t<pr_created|pr_existing|stopped|blocked|interrupted>
reason\t<terminal reason>
readiness\t<verdict and preserved quality bar>
branch\t<name or unavailable>
base\t<name/revision or unavailable>
commits\t<identities or unavailable>
remote_branch\t<identity or unavailable>
pull_request_url\t<URL or unavailable>
verification\t<current-content evidence or unavailable>
independent_review\t<omitted|passed|blocked|unavailable plus evidence>
local_work\t<preserved and excluded paths or unavailable>
adaptive_goal\t<launch record and completion or unavailable>
telemetry_status\t<emitted|degraded|failed>
telemetry_evidence\t<safe correlation evidence or unavailable>
```

Use exactly one delivery outcome: `pr_created`, `pr_existing`, `stopped`,
`blocked`, or `interrupted`. Successful outcomes require exact-current-content
evidence. The terminal record itself must not leak telemetry-forbidden content.
