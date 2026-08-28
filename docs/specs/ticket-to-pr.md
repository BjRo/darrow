# Task Recipe: Ticket to Pull Request

Darrow should provide one explicitly invoked task recipe that turns one ready,
authoritative ticket in the current repository into exactly one verified pull
request. The recipe owns ticket-specific intake, authority, and publication
semantics while one adaptive host-native goal owns execution and continuation.

Plugin: `darrow-ticket-to-pr`  
Skill: `ticket-to-pr`

## Why

Ticket delivery needs a reusable outcome contract: resolve one authoritative
request, establish readiness, preserve local work, authorize bounded Git
effects, and finish with one verified pull request. Users should not need to
restate those boundaries for every ticket.

The recipe remains a thin composition layer. Installed capabilities own ticket
access, readiness, adaptive execution, review, and Git mechanics. The host owns
conversation and session continuation. The recipe does not reproduce either
owner as a controller, lifecycle protocol, or recovery runtime.

## Intent and authority

The recipe is selected only by explicit invocation for one ticket, for example:

```text
$ticket-to-pr <ticket>
```

Invocation authorizes the recipe to create or reuse one task branch, create
intended commits, push that branch without rewriting remote history, and open
exactly one pull request. It does not authorize merging, deployment, release,
ticket mutation, or unrelated external effects.

Ordinary ticket discussion, implementation intent, or task complexity MUST NOT
activate the recipe implicitly.

## Successful outcome

Success means exactly one open pull request exists whose current committed
content fulfills the ready ticket and its quality bar. The pull request may be
newly created or an existing unambiguously correlated proposal reused by the
recipe.

The recipe uses the current repository. It does not search for or clone another
repository. A linked worktree is created only when the user explicitly requests
one through an available matching capability.

Codex and Claude Code expose the same public recipe semantics. Host-specific
launch, feedback, and continuation mechanisms may differ underneath that
contract.

## Authoritative input and readiness

The recipe accepts either:

- one stable ticket reference resolvable through an available environment
  capability; or
- authoritative ticket content supplied directly in the conversation or an
  identified specification.

Useful input consists of a stable identifier when one exists, the desired
outcome, description, observable acceptance criteria, and canonical link when
available. Before Git mutation, the active ticket provider must also supply its
exact opaque canonical token. Tracker-management metadata is not required.

Before adaptive delegation, the recipe:

1. resolves exactly one non-contradictory authoritative request;
2. confirms the invocation's exact authority; and
3. requests an available compatible Git capability to create or reuse and
   switch to the ticket-linked task branch, or to prepare it in a linked
   worktree only when the user explicitly requested one; and
4. invokes an available implementation-readiness capability through a composed,
   human-readable contract.

Task-branch preparation is the sole repository effect permitted before the
readiness verdict. It is intake already authorized by explicit recipe
invocation, occurs immediately after the ticket and canonical token are known,
and exists so branch-inferred observability attributes readiness and later
delivery turns to the authoritative ticket. The branch operation remains
additive: it never resets, stashes, discards, or commits work. If safe branch
preparation is unavailable, conflicting, or ambiguous, the recipe stops before
readiness rather than guessing. For an explicit worktree request, the recipe
leaves the caller's checkout untouched and performs readiness and all later
delegation from the attributed worktree path returned by the Git capability.

Only `ready` permits implementation, commit, publication, or adaptive delegation
that can cause further product, repository, or external mutation. A
`needs-decision` result causes the parent conversation to ask the smallest
concrete question and rerun readiness after the user's answer. This is a pause,
not a terminal recipe outcome. A `needs-discovery` result may offer a separate
discovery capability but MUST NOT invoke it without matching authority. Missing,
ambiguous, contradictory, blocked, or declined input stops before delivery
mutation beyond the already prepared task branch and reports the smallest next
action. The recipe preserves that additive branch state instead of rolling it
back.

## Adaptive execution and human feedback

For a ready ticket, the recipe compiles and activates exactly one adaptive
host-native goal through a compatible environment capability. Delegation is a
continuation of the explicitly invoked recipe and does not require a second
user invocation or grant additional authority.

The delegated request carries:

- the authoritative ticket and readiness quality bar;
- the requirement that adaptive-goal inspect and preserve pre-existing work;
- acceptance criteria, scope, and explicit non-goals;
- the authorized branch, commit, push, and one-pull-request effects; and
- the requirement to return one verified pull request.

The adaptive-goal contract owns workflow, risk, routing, implementation,
verification cadence, independent-review selection, human-feedback relay,
recovery, and completion. When a material decision emerges after activation,
the goal owner pauses mutation, sends the smallest concrete question to its
parent, and continues under the same ownership after the user's explicit answer.
The answer supplies only the decision or authority it states.

The recipe and goal MUST NOT add a phase graph, planner/executor controller,
private retry loop, durable phase state, or background supervisor.

## Local work and Git safety

Pre-existing work belongs to the user and is never discarded, reset, stashed,
or absorbed merely to make delivery proceed. The compatible Git capability
owns the safety of the early additive branch operation and preserves any
uncommitted work. Adaptive-goal later observes the actual checkout and judges
whether overlap is ticket-owned, unrelated, or ambiguous; the recipe does not
duplicate that repository preflight. Ticket-owned overlap may proceed as
preserved work, while unrelated or ambiguous work stops further mutation. An
explicitly requested worktree leaves the original checkout untouched.

Branch, commit, push, and pull-request mechanics follow the available canonical
Git capabilities. At the recipe boundary:

- existing branches are not reset, force-moved, or silently replaced;
- remote history is not rewritten;
- unrelated or uncommitted work is not silently published;
- conflicts stop rather than being guessed through; and
- no effect beyond the explicitly authorized branch, commits, push, and one
  pull request is performed.

## Minimal resumability and publication idempotency

The host owns session continuity. A resumed session continues the same adaptive
goal and revalidates the current repository revision and forge state before
publication. A fresh explicit invocation may reuse an unambiguously correlated
branch or open pull request; it does not restore workflow stages.

When that owner has settled as blocked, an unambiguous answer or `continue`
resumes the same goal, objective, owner, and Ticket-to-PR delivery only when it
resolves or authorizes the recorded blocker. An unqualified `retry` authorizes
one additional attempt at the exact failed operation. Ambiguous push or pull-
request creation is observed before retry, and an observed matching effect is
reused instead of duplicated. Deterministic unchanged failure or review
evidence is not rerun merely to seek a different result.

`ignore this and continue` may waive only a discretionary Darrow-selected gate
and records that waiver. Repository policy, safety and authorization
boundaries, and truthful verified-PR completion remain non-waivable. Skipping
an essential ticket acceptance condition requires an explicitly revised
authoritative outcome rather than a false completion claim.

An existing pull request counts as success only after its exact current content
satisfies the ticket's verification and selected-review gates. Evidence made
stale by changed or unknown content is rerun.

Before retrying an ambiguous push or pull-request creation result, the goal
queries current remote and forge state. It reuses an observed matching proposal
and never creates a duplicate. Ambiguous correlation stops honestly.

The recipe does not persist a phase store, attempt ledger, status file, retry
counter, or recovery handoff. The adaptive owner may retain its private
protocol evidence and file-backed objective while blocked, but the recipe owns
neither. Repository and forge facts remain the durable publication evidence.

## Verification and pull-request contract

The readiness quality bar supplies the observable product oracle. The adaptive
goal applies its canonical workflow, proportional risk gate, final-tree checks,
and independent-review policy. When review is selected, publication remains
blocked until the exact content to be published has clear review evidence.
Changed content invalidates affected checks and review.

Publication produces exactly one proposal for the ticket:

- an existing open correlated pull request is never duplicated;
- the head branch contains committed work ahead of a deliberate base;
- the title follows the repository's Conventional Commit rules;
- the body explains the purpose and committed change, references the ticket
  when known, and follows an applicable pull-request template;
- the branch is pushed without history rewriting;
- the pull request is ready for review by default; and
- draft state is used only when explicitly requested.

The recipe does not merge, enable auto-merge, assign reviewers, apply labels or
milestones, or update or close the ticket.

## Completion and blockage

On success, the recipe reports the ticket, repository, pull-request URL,
whether the proposal was created or reused, and the current-content verification
and selected-review evidence.

A request for user input is nonterminal while the host can relay feedback to
the same goal owner. When the recipe cannot continue, it reports the exact
unresolved blocker and any observed branch or pull request without inventing
missing values. Host interruption is host session state, not a separate recipe
outcome; a supported resume continues the work.

The presence of a branch, commit, or pull-request URL alone is never proof that
the ticket is fulfilled.

## Invariants

1. **TPR-C1 — Explicit activation.** Only explicit ticket-to-PR invocation
   activates the recipe and its publication authority.
2. **TPR-C2 — Ready authoritative request.** Pre-readiness mutation is limited
   to safely preparing the resolved ticket's additive task branch; every other
   delivery mutation uses exactly one resolved, non-contradictory request with
   a `ready` verdict.
3. **TPR-C3 — Human decisions remain human.** A missing decision is asked as
   the smallest concrete question, never inferred; feedback grants only what it
   explicitly states.
4. **TPR-C4 — One native goal owner.** One adaptive host-native goal owns
   implementation, feedback continuation, verification, and completion without
   a Darrow workflow runtime.
5. **TPR-C5 — Bounded authority and preserved work.** Immediately after ticket
   resolution, the recipe safely prepares the task branch so automatic
   branch-inferred observability sees the authoritative ticket before readiness.
   It preserves pre-existing work and performs only the authorized task branch,
   intended commits, non-force push, and one pull request. When the active
   ticket provider supplies an opaque canonical token, a derived task branch
   preserves it exactly once after its Conventional Commit type
   (`<type>/<token>-…`); missing tokens require the smallest question before Git
   mutation.
6. **TPR-C6 — Idempotent publication.** Correlated branches and pull requests
   are reused, and ambiguous external results are inspected before retrying.
7. **TPR-C7 — Current-content evidence.** Success requires the ticket quality
   bar, applicable final checks, and selected review to cover the exact pull-
   request content.
8. **TPR-C8 — Honest completion.** Success returns one verified pull request;
   inability to continue returns the exact blocker without a private lifecycle
   or recovery record.
9. **TPR-C9 — Cross-host semantics.** Claude Code and Codex expose the same
   inputs, effects, human gates, publication guarantees, and completion meaning.
10. **TPR-C10 — Thin delegation.** The recipe owns no workflow/risk/route
    selection, native-goal contract, protocol ledger, runner, Git/forge
    implementation, or post-goal inspection.
11. **TPR-C11 — Same-delivery blocked continuation.** A resolving answer,
    qualifying `continue`, authorized one-attempt retry, or valid discretionary
    waiver resumes the same adaptive owner and enclosing delivery in the same
    host thread. It never invokes the recipe again, replaces the owner, weakens
    ticket acceptance or publication gates, or creates a second pull request.
    The owner and objective remain available until completion, explicit
    abandonment or supersession, or host-thread destruction.

## Packaging and portability

1. **TPR-P1 — Independent plugin.** `darrow-ticket-to-pr` is independently
   installable and does not reference sibling-plugin files or assume a named
   provider is installed.
2. **TPR-P2 — Intent composition.** Ticket access, readiness, adaptive native-
   goal execution, review, and Git are requested through host-visible compatible
   intent or public contracts. Missing required capability stops honestly.
3. **TPR-P3 — Dual-host packaging.** Claude Code and Codex manifests expose the
   same skill semantics, and the Codex manifest points at `./skills/`.
4. **TPR-P4 — Portable mechanics.** Any plugin-shipped executable mechanics use
   portable Bash, baseline Unix utilities, and wrapped host CLIs, supporting
   Bash 5 and macOS `/bin/bash` 3.2.
5. **TPR-P5 — Contextual judgment.** Authority, dirty-work ownership, scope,
   readiness evidence, and branch or pull-request correlation remain contextual
   model judgments; deterministic scripts own only repeatable mechanics.

## Evaluation requirements

Core judgment cases run matched trials on Claude Code and Codex with the same
fixtures, prompts, hidden checks, model, and effort. Any comparative claim uses
at least three trials per condition and reports trial count, outcome
correctness, escaped defects, human interventions, duplicate or unintended
mutations, tokens, cost, wall time, and limitations.

The shared evaluator persists an active-run record before an equivalent case
can be rerun, checkpoints every completed trial, and atomically finalizes that
record only after process exit. A terminal run writes either its complete
result artifact or a diagnostic artifact. Recipe or goal orchestration must not
declare that artifact missing, rerun the same case, settle, or clean up while
the active-run record remains active.

Required cases are:

1. **TPR-E1 — Ready delivery.** A ready ticket produces exactly one verified,
   review-ready pull request with the intended committed scope.
2. **TPR-E2 — Intake and readiness.** Resolved input safely prepares or reuses
   its ticket branch before readiness so branch-inferred observability records
   the authoritative ticket. Ready input proceeds; missing, ambiguous,
   contradictory, blocked, or declined input causes no mutation beyond the
   preserved additive task branch.
3. **TPR-E3 — Human feedback.** `needs-decision` and an implementation-time
   material question reach the user through the parent, then the same delivery
   continues only from the explicit answer.
4. **TPR-E4 — Local-work safety.** Ticket-owned dirty work can proceed;
   unrelated or ambiguous work stops; an explicitly requested worktree leaves
   original changes untouched.
5. **TPR-E5 — Resume and idempotency.** A resumed session continues safely, and
   a fresh invocation or ambiguous publication result reuses observed correlated
   state without a duplicate proposal or stale-evidence success.
6. **TPR-E6 — Scope and review.** Necessary callers, tests, documentation, and
   compatibility work are included; adjacent expansion asks the user; selected
   review blocks stale, unavailable, inconclusive, or blocking publication.
7. **TPR-E7 — Pull-request shape.** Base, title, body, template, ticket
   reference, draft state, push safety, and duplicate handling satisfy the
   publication contract.
8. **TPR-E8 — Cross-host behavior.** Fresh Claude Code and Codex contexts
   satisfy the same public assertions despite host-specific feedback and resume
   mechanisms.
9. **TPR-E9 — Blocked continuation controls.** Same-thread answer, `continue`,
   one-attempt retry, ambiguous-publication observation, discretionary waiver,
   non-waivable refusal, unchanged failure, objective retention and cleanup,
   fresh-conversation invocation, and Ticket-to-PR continuation preserve one
   owner and exactly one pull request on both native host harnesses.

Every required case permits zero unintended or duplicate external mutations.
Relevant deterministic script tests pass under both `bash` and `/bin/bash`.

## Non-goals

- Scheduled activation, Artificer, capacity management, claims, or cross-ticket
  admission.
- Repository discovery, automatic cloning, or implicit worktree creation.
- Product discovery or implementation planning inside a non-ready delivery run.
- A Darrow daemon, queue, phase controller, retry ledger, dashboard, status
  protocol, or hidden workflow state.
- Recipe-owned session persistence, crash recovery, or workflow reconstruction.
- A recipe-owned telemetry lifecycle, SDK, exporter, collector, backend, or
  visualization; environment observation remains outside this contract.
- `.darrow` evidence storage, artifact retention, or cross-ticket learning.
- Merge, auto-merge, deployment, release, tracker mutation, reviewer assignment,
  labels, or milestones.
- A performance, cost, or quality-superiority claim based only on the required
  functional cases.
