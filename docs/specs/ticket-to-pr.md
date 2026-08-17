# Task Recipe: Ticket to Pull Request

Darrow should provide one explicitly invoked task recipe that turns one
authoritative ticket in the current repository into exactly one verified pull
request. The recipe composes focused environment capabilities and one adaptive
host-native goal without introducing a workflow runtime.

Plugin: `darrow-ticket-to-pr`  
Skill: `ticket-to-pr`

## Why

Ticket delivery requires more than implementation. The complete outcome spans
authoritative ticket intake, local-work safety, adaptive decision-gating and
execution, verification, conditional independent review, Git publication,
recovery, and an inspectable terminal result. Requiring users to restate those
boundaries for every ticket is error-prone, while rebuilding them as a
controller would duplicate the host's execution and recovery machinery.

`ticket-to-pr` provides the reusable outcome contract. It performs specialized
read-only intake, then delegates the implementation decision, execution, and
continuation to adaptive-goal. Installed capabilities continue to own ticket
access, review, and Git operations.

## Intent

The recipe is selected only by explicit invocation for one ticket, for example:

```text
$ticket-to-pr <ticket>
```

Invocation authorizes the recipe to create or reuse one task branch, create
intended commits, push that branch, and open exactly one pull request. It does
not authorize merging, deployment, release, ticket mutation, or unrelated
external effects.

Ordinary ticket discussion, implementation intent, or task complexity MUST NOT
activate the recipe implicitly.

## Outcome

The successful outcome is exactly one open pull request whose current committed
content fulfills the ticket and its acceptance criteria. The pull request may be
newly created or an existing unambiguously correlated proposal reconstructed
during re-entry.

The recipe uses the current repository. It does not search for or clone another
repository. A linked worktree is created only when the user explicitly requests
one through an available matching capability.

Codex and Claude Code expose the same public recipe behavior. Host-specific
launch and capability adapters may differ underneath that contract.

## Authoritative input

The recipe accepts either:

- one stable ticket reference resolvable through an available environment
  capability; or
- authoritative ticket content supplied directly in the conversation or an
  identified specification.

Useful ticket content consists of a stable identifier when one exists, the
desired outcome, description, observable acceptance criteria, and canonical
link when available. Labels, milestones, relations, and tracker-management
metadata are not required delivery inputs.

The recipe MUST identify exactly one unambiguous authoritative request. It
MUST stop before product, repository, or publication mutation when a required
ticket cannot be resolved, authority is ambiguous, or authoritative sources
contradict each other. It never invents tracker precedence or silently merges
conflicting intent.

When the invocation itself presents multiple alternative ticket references and
delegates the choice without authoritative selection criteria, ambiguity is
already established. The recipe MUST classify that boundary as `stopped`, MUST
NOT attempt to resolve each alternative or recast the boundary as a missing
ticket-read capability, and MUST still report a concise terminal result.

A stable reference is not authoritative content by itself. When resolution
depends on a declared compatible read contract, the recipe MUST invoke that
contract successfully and use its returned content before treating the ticket
as resolved or invoking adaptive-goal. A list-only ticket capability does not
satisfy the intent to retrieve one ticket's authoritative content.

## Read-only preflight

Before product, repository, or publication mutation, the recipe:

1. resolves the authoritative ticket input;
2. confirms the current repository and records pre-existing work;
3. reads applicable repository constraints;
4. reconstructs any unambiguously correlated branch, commits, remote branch,
   and open pull request;
5. confirms the invocation's exact authority; and
6. returns directly after read-only verification when authoritative input
   establishes a prior terminal outcome or completed adaptive-goal boundary;
   otherwise invokes adaptive-goal with the authoritative ticket, acceptance
   criteria, repository evidence, constraints, and authorized effects.

This order is a hard gate. The recipe does not mutate delivery state before
authoritative intake, repository safety, durable re-entry reconstruction, and
authority confirmation are complete. It does not make a separate readiness
call or decide implementation readiness itself.

Applicable repository instructions may identify an exact compatible
environment capability and its invocation contract. Such a declaration is
capability-availability evidence: the recipe uses that declared contract for
the matching effect rather than substituting a generic host facility, a
similarly named tool, or a direct Git or shell implementation. If the declared
contract is unreadable, incomplete, or cannot be invoked as specified, the
recipe reports that exact capability or input gap and stops at the applicable
boundary. Cross-host discovery reads present `AGENTS.md` and `CLAUDE.md`
entrypoints rather than relying only on whichever instruction format the
current host loads automatically. A declared command contract is invoked as a
command through the host's shell facility and does not also need to appear in
the host's tool or plugin catalog; running that declared command is capability
invocation, not an unauthorized direct implementation of its effect.

## Adaptive execution

For an authoritative ticket in a safe repository, the recipe invokes and
awaits exactly one available skill named `adaptive-goal`. Its public intent is
to compile one bounded engineering request and activate it as a host-native
goal with a proportionate workflow, risk gate, model, and effort. A description
of a handoff, direct implementation in the recipe parent, a generic goal tool,
or a generic subagent does not satisfy this invocation.
Adaptive-goal owns the implementation decision, adaptation, recovery,
verification, and completion.

The only exception is authoritative historical reconstruction described under
Terminal result: it returns after read-only current-state verification and does
not relaunch completed or interrupted work. A stale or partial branch with an
unfinished implementation or publication gate is not terminal reconstruction;
the recipe still invokes adaptive-goal, and the recipe parent does not perform
the remaining mutation itself.

Adaptive-goal performs its normal read-only preflight. When required product
behavior, authority, or another implementation decision is missing, it selects
`decision-gated` and stops before product, repository, or publication mutation.
The recipe reports that as `stopped` and names the smallest missing decision.
An unavailable or failed adaptive-goal boundary is `blocked`. When preflight
proceeds, exactly one native goal owns all delivery mutation.

The delegation identifies the recipe as an orchestration entrypoint the user
explicitly invoked and carries the originating ticket request and authority
unchanged. It does not require a second user invocation of the adaptive goal or
grant the adaptive goal any additional authority.

The goal contract preserves:

- the authoritative ticket and observable acceptance criteria;
- the current repository and pre-existing work;
- a first-mutation repository gate naming the exact delivery path and existing
  base ref, requiring a distinct descendant task branch while forbidding base
  rename/deletion and any unrequested copied checkout or worktree;
- observable acceptance criteria, scope, and explicit non-goals;
- the authorized branch, commit, push, and one-PR effects;
- applicable repository verification;
- adaptive workflow, risk, route, and independent-review selection; and
- required terminal delivery evidence.

The contract expresses downstream operations through their public capability
intents. It reuses the reconstructed ticket branch or requests creation of one
new conventional Git branch; requests one new commit for each intended coherent
commit that remains necessary; requests independent review of the exact current
change when adaptive-goal selects review; and requests publication by pushing
the current feature branch and opening exactly one review-ready pull request or
reporting the existing correlated proposal. Exact compatible contracts declared
by repository instructions implement those intents without changing their
authority or outcome.

The goal operates in the exact current repository established during preflight
and on the authorized task branch. An unrequested copied checkout or linked
worktree is not the delivery repository, and a goal-owner report is not
repository evidence.

The goal may make changes necessary to fulfill the ticket coherently, including
affected tests, callers, documentation, and compatibility corrections. It MUST
stop for an authorized decision before expanding into adjacent product behavior
that the ticket does not require. When a concrete adjacent opportunity is
identified and intentionally excluded, the goal contract and terminal result
MUST name that excluded boundary even when it was a clean tracked path rather
than pre-existing uncommitted work. The recipe MUST NOT report that no paths
were excluded while omitting a known adjacent boundary.

The recipe and goal MUST NOT add a phase graph, planner/executor controller,
private retry loop, durable phase state, or background supervisor. The
host-native goal remains the sole continuation owner.

That ownership is also a single-writer boundary. After launch, the recipe
parent does not independently replay branch, commit, push, or pull-request
effects performed by the goal. It may validate returned durable facts and
report the terminal result, but any further authorized mutation remains with
the same goal owner.

Goal completion is not the recipe's user-visible terminal response. After the
goal returns, the recipe parent always resumes, validates the durable facts,
and reports the required terminal result; it never forwards an unverified goal
summary as the final response.

## Local work and repository safety

Pre-existing work belongs to the user and is never discarded, reset, stashed,
or absorbed merely to make delivery proceed.

The recipe may continue with a dirty checkout only when the existing changes
are unambiguously part of the same ticket. It stops before mutation when their
ownership is unrelated or ambiguous. An explicitly requested worktree leaves
existing changes in the original checkout.

Branching and publication preserve the current Git capability invariants:

- branch naming traces to the work and ticket when known;
- a deliberate base is used, defaulting to the repository's default branch
  unless the user names another;
- existing branches are never reset, force-moved, or silently replaced;
- merge or rebase conflicts stop branching and publication;
- pushes never rewrite remote history; and
- uncommitted work is never silently included in the pull request.

Before push or pull-request creation, the recipe verifies from the delivery
repository—not from a delegated report—that the deliberate base ref still
exists, the task branch is distinct from and descends from that base, its HEAD
is ahead, the ticket-required committed diff is present, and the ticket's
acceptance check passes in that exact checkout. It never renames or deletes the
base branch to manufacture a task branch, and it does not publish or report
success when this gate fails.

## Re-entry and recovery

The recipe reconstructs progress from durable repository and forge facts rather
than a private workflow ledger. Relevant facts include the current checkout,
task branch, commits relative to the base, remote branch, open pull request, and
verification or review evidence tied to the current content.

An unambiguously ticket-correlated branch or pull request is reused. A matching
open pull request is the successful `pr_existing` outcome only after its exact
current content satisfies the ticket's verification and review gates. When it
is incomplete, the goal continues on the correlated proposal rather than
creating a duplicate.

For `pr_existing` and `pr_created`, current verification also preserves the
proposal shape observed from the forge: deliberate base and correlated head,
an imperative Conventional Commit-compatible title, ticket-referencing
template body, and ready-versus-draft state. A confirmation-only re-entry still reports the same
concise terminal outcome as a newly completed delivery.

Unknown, stale, or content-invalidated checks and reviews are rerun. Claims that
work probably passed are not durable evidence.

For recoverable commit-hook, push, or pull-request failures, the goal makes the
smallest correction already authorized by the ticket, reruns invalidated
verification, and continues until publication succeeds or a genuine external
block, user interruption, or explicit budget stops it. It never bypasses hooks,
force-pushes, broadens scope, or uses an arbitrary retry count.

A failed pull-request creation call is retried only after read-only forge
reconstruction proves that the exact attempt created no correlated proposal.
An ambiguous result, an unavailable inspection contract, or any correlated
proposal blocks a retry. This is recovery from a proven absent proposal, not a
probe or a fixed retry loop.

A pull-request creation attempt with an ambiguous result is not a confirmed
failure. The goal first reconstructs whether that exact attempt created a
correlated proposal. If the available forge contract cannot disambiguate the
result, it reports the durable attempt and stops `blocked`; neither the goal nor
the recipe parent issues a blind second creation call.

On interruption or blockage, the result reports the exact durable branch,
commit, remote, and pull-request state available for a later invocation.

## Verification and independent review

The ticket's acceptance criteria supply the observable product oracle.
Adaptive execution selects the implementation workflow and proportional risk
gate:

- routine work uses focused acceptance or characterization evidence and the
  scoped repository gate;
- elevated work adds affected-caller or compatibility checks and a plausible
  counterexample; and
- high-risk work adds an adversarial boundary or state-transition check and
  independent final-tree review.

Independent review follows the adaptive selection policy. It is normally
omitted for routine work, selected for elevated work when caller impact,
compatibility, or counterexample judgment warrants it, and selected by default
for high-risk work. Repository policy or explicit user intent may require it at
any risk.

When review is selected, publication is blocked until an available compatible
capability reviews the exact content to be published and reports no blocking
findings. Repairs invalidate earlier review and require rerunning affected
checks and review. Same-context self-review does not satisfy an independent
review gate.

## Pull-request contract

Publication produces exactly one proposal for the ticket:

- an existing open correlated pull request is never duplicated;
- the head branch contains committed work ahead of a deliberate base;
- the title follows the repository's Conventional Commit rules;
- the body explains why the change exists and what the committed branch does,
  references the ticket when known, and follows the selected repository pull-
  request template;
- the branch is pushed without history rewriting;
- the pull request is ready for review by default; and
- draft state is used only when explicitly requested.

The recipe does not merge, enable auto-merge, assign reviewers, apply labels or
milestones, or update or close the ticket.

Pull-request creation arguments are validated locally without invoking the
forge creation operation. Capability probes, test bodies, and dry-run variants
of a create command still count as creation attempts and are prohibited. Help,
version, or syntax discovery MUST NOT invoke the creation subcommand. An
incomplete forge contract stops before creation instead of being probed. The
forge's pull-request creation operation is invoked once initially and only
again when the preceding proven-failure recovery rule authorizes it. At most
one correlated proposal may result.

## Terminal result

Every invocation reports exactly one delivery outcome:

- `pr_created` — a new verified pull request was opened;
- `pr_existing` — an existing correlated pull request was verified as the
  complete outcome;
- `stopped` — authoritative intake or adaptive preflight identified a missing
  decision or authority;
- `blocked` — a required capability, permission, route, repository condition,
  or external operation prevented completion; or
- `interrupted` — the user, an explicit budget, or the host ended execution.

When an invocation explicitly reconstructs a prior terminal state and its
authoritative input establishes that invocation's historical outcome, current
inspection verifies the durable evidence without reopening unfinished phases
or rewriting the event classification. This applies to every terminal outcome:
an interrupted invocation remains `interrupted` even when required delivery
capabilities are absent now, and a proposal opened by a reconstructed delivery
remains `pr_created` even though it is now an existing proposal. `pr_existing`
means the proposal already existed when the reconstructed delivery began.
When the historical classification is not established, the recipe reports
only what the current invocation can prove and does not guess it.

Historical reconstruction is resolved before adaptive-goal invocation and is
strictly read-only. It does not finish interrupted work or reclassify a
historical `pr_created` as `pr_existing` merely because the created proposal is
now present.

Adaptive-goal's `decision-gated` preflight maps to delivery outcome `stopped`.
Delivery outcome `blocked` is used when the recipe could not reach or complete
a required capability, route, permission, repository condition, or external
operation.

The terminal result is concise and human-readable. It always identifies the
ticket and delivery outcome. A successful result includes the verified pull-
request URL, current verification, and review result. A stopped, blocked, or
interrupted result includes the reason and smallest useful next action. Any
durable branch, commit, remote, or pull-request state is preserved when it
exists; unavailable details are omitted rather than inferred.

The terminal response is a report, not the evidence boundary. Current
repository and forge inspection prove delivery. The presence of a branch,
commit, or pull-request URL alone is not proof of ticket fulfillment.
Successful verification also covers the proposal base and head, title, ticket-
referencing body, ready-versus-draft state, required checks, and selected
review.

## Deterministic mechanics boundary

The recipe ships one narrow, read-only portable Bash helper for mechanics that
must be repeatable across Claude Code and Codex. The helper owns exactly these
operations:

- repository and worktree inspection, including absolute checkout paths, the
  primary worktree, current base, branch and HEAD state, remotes, staged,
  unstaged, untracked and conflicted paths, stable state fingerprints, and
  ticket-correlated local and remote candidates;
- validation of an already-produced adaptive-goal v4 launch record against
  host-observed route and child-count facts, including proof that the recipe
  invoked exactly one adaptive-goal child, without changing or recreating the
  record;
- local delivery verification for the supplied base, branch, expected HEAD,
  remote branch, clean-worktree requirement, and any supplied preservation
  snapshot; and
- canonical rendering of an already-classified terminal outcome, its supplied
  verification and review evidence, durable branch, commit, remote and pull-
  request facts, smallest next action, preservation statement, and the
  preserved launch record when one exists. A structurally valid record is
  rendered as the canonical v4 block. When launch validation itself refused a
  malformed record, a `blocked` or `interrupted` result may instead preserve
  the unchanged opaque record between explicit refusal markers so the recipe
  can still return one honest terminal result. In either form, the helper adds
  a line boundary after a record that lacks a final newline; it does not change
  the record file.

These operations report facts or reject mechanically invalid input. They do
not decide which ticket source is authoritative, reconcile contradictory
requests, classify dirty-work ownership, decide whether historical state is
terminal, choose an outcome or next action, judge ticket fulfillment or review
findings, select publication authority or review policy, or invoke
adaptive-goal. Those decisions remain visible in `SKILL.md` and belong to the
model.

The helper is not a delivery engine. It never fetches a ticket through a
hard-coded backend, creates or switches a branch, stages or commits work,
pushes, creates or recovers a pull request, mutates forge state, rewrites a
launch record, or persists phase state. Branch and commit effects remain with
their compatible Git capabilities. Push, pull-request creation and recovery,
duplicate-proposal handling, title validation, and template mechanics remain
with the compatible create-PR capability.

## Invariants

1. **TPR-C1 — Explicit activation.** Only explicit ticket-to-PR invocation
   activates the task recipe and its publication authority.
2. **TPR-C2 — One authoritative request.** Delivery uses exactly one resolved,
   non-contradictory authoritative ticket or supplied specification.
3. **TPR-C3 — Adaptive preflight before delivery mutation.** Adaptive-goal
   owns the implementation decision; `decision-gated` stops without delivery
   mutation and preserves the smallest missing decision.
4. **TPR-C4 — One native goal owner.** One adaptive host-native goal owns
   implementation, recovery, verification, and completion without a Darrow
   workflow runtime.
5. **TPR-C5 — Bounded authority and scope accounting.** Invocation authorizes
   one task branch, intended commits, a non-force push, and exactly one pull
   request, but no merge, deployment, release, ticket mutation, or unrelated
   effect. Known adjacent exclusions are carried into the delegated goal and
   rendered as an explicit terminal scope decision; successful publication
   receipts do not authorize a later create call by either the goal or parent.
6. **TPR-C6 — Preserved local work.** Pre-existing work is never lost or
   silently absorbed, and ambiguity stops before mutation.
7. **TPR-C7 — Idempotent publication.** Correlated branches and pull requests
   are reconstructed and reused; duplicate proposals are never created.
8. **TPR-C8 — Current-content evidence.** Success requires the ticket quality
   bar, applicable final checks, and selected review to cover the exact content
   in the pull request.
9. **TPR-C9 — Proportional review.** Independent review follows adaptive risk,
   repository policy, and explicit user intent rather than an unconditional
   phase.
10. **TPR-C10 — Persistent safe recovery.** Recoverable failures receive the
    smallest authorized correction and invalidated checks without fixed retry
    counts, bypasses, force pushes, or scope expansion.
11. **TPR-C11 — Stable terminal semantics.** Every invocation reports exactly
    one defined delivery outcome and its durable progress.
12. **TPR-C12 — Cross-host contract.** Claude Code and Codex expose the same
    authoritative inputs, effects, stops, and outcomes.

## Packaging and portability

1. **TPR-P1 — Independent plugin.** `darrow-ticket-to-pr` is independently
   installable and does not reference sibling-plugin files or assume a named
   provider is installed.
2. **TPR-P2 — Intent composition.** Ticket access, adaptive native-goal
   execution, review, and Git are requested through host-visible
   compatible intent or public contracts. Exact compatible contracts declared
   by applicable repository instructions are used without substitution.
   Missing required delivery capability stops honestly.
3. **TPR-P3 — Dual-host packaging.** Claude Code and Codex manifests expose the
   same skill semantics, and the Codex manifest points at `./skills/`.
4. **TPR-P4 — Portable mechanics.** Any plugin-shipped executable mechanics use
   portable Bash, baseline Unix utilities, and wrapped host CLIs, supporting
   Bash 5 and macOS `/bin/bash` 3.2.
5. **TPR-P5 — Contextual judgment.** Authority, dirty-work ownership, scope,
   contradictory-input handling, historical-terminal classification,
   publication authority, adaptive-goal invocation, acceptance and review
   judgment, semantic outcome, next-action selection, decision-gating, and
   recoverability remain contextual model judgments; deterministic scripts own
   only the four repeatable, read-only operations in the deterministic
   mechanics boundary.

## Evaluation requirements

The tracked comparative suite names one representative core case for each of
TPR-E1 through TPR-E11. Each representative runs at least three trials on both
Claude Code and Codex under the candidate, raw `adaptive-goal`, and ticket-
pipeline controls. Additional edge variants run candidate-only with the same
three-trial, cross-host minimum.

Comparative cells use the same workload template, fixture, hidden acceptance
checks, harness, model, effort, and trial count. The only prompt difference is
one recorded, minimal entrypoint substitution required to invoke the candidate
or control on the selected host. Because the mounted workflow and entrypoint
both differ, this is a matched comparative benchmark rather than a strict
single-skill ablation. Reports retain the common workload digest and exact
entrypoint adapter together with trial count, outcome correctness, escaped
defects, false-positive review findings, human interventions, duplicate or
unintended mutations, resume success, selected and effective routes, tokens,
cost, wall time, and limitations. Three trials do not support a superiority
claim.

When a headless host exposes explicit slash commands only through its
interactive parser, the runner may bridge an already-explicit workload
entrypoint by removing the model-invocation guard from the mounted evaluation
copy only. The source skill remains unchanged, natural-language and negative
cases never receive the bridge, and every bridged result records the transport
separately from the entrypoint. This calibrates workflow behavior without
misrepresenting the bridge as native host activation.
Unguarded controls using model-mediated headless loading record that distinct
transport without claiming the explicit-only bridge was applied.
Composition fixtures preserve every mounted plugin's namespace so a capability
skill, bundled mechanics, and helper-selected native agent types remain under
the same independently packaged owner on both hosts. A behavior case that
requires adaptive-goal ownership also requires observed activation and a route
record reconciled with the actual native launch boundary; a recipe-parent
generic delegation or self-authored launch record is not equivalent evidence.
Claude behavior fixtures keep their isolated fixture-local session transcript
until route verification and result grading complete, then destroy it with the
fixture. The eval runner bridges its logical temporary path to Claude's
physical transcript key, observes exactly one matching native Agent transcript
by its exact agent identity, and reconciles the effective model and effort
against the verbatim v4 record. Disabling session persistence or trusting final
prose cannot satisfy that oracle.

Activation is calibrated separately from behavior. Activation cases cover
direct, incomplete, ordinary-negative, natural-language, and pressure inputs;
TPR-E1 through TPR-E11 behavior cases pass or fail only from repository, forge,
and terminal-output evidence. A direct host skill event is preferred.
When a host exposes no such event, the harness may inject a bounded private
activation sentinel into the mounted evaluation copy of each skill and report
that explicitly as controlled-probe evidence. It never infers activation from
the final answer. Negative activation cases may reject an explicit successful
delivery claim, but ordinary prose such as being blocked by missing inputs is
not evidence that the recipe claimed a terminal outcome.

No-mutation cases compare the selected branch, every repository ref, index,
tracked worktree, and untracked-file state. Cases whose contract explicitly
creates repository state declare that expectation and pair it with a specific
state assertion. Terminal-result cases check the reported outcome and the
minimum evidence appropriate to that outcome, while publication facts remain
grounded in fixture-visible branch, remote, and forge state.

Required cases include:

1. **TPR-E1 — Ready delivery.** A ready routine ticket produces exactly one
   verified, review-ready pull request with the intended committed scope.
2. **TPR-E2 — Authoritative intake.** Resolvable references and supplied
   authoritative content proceed; missing, ambiguous, and contradictory inputs
   stop without delivery mutation.
3. **TPR-E3 — Adaptive preflight.** A missing implementation decision selects
   `decision-gated`, reports the smallest missing decision, and leaves product,
   repository, and forge state unchanged.
4. **TPR-E4 — Dirty and worktree safety.** Ticket-owned dirty work can proceed;
   unrelated or ambiguous work stops; an explicitly requested worktree leaves
   original changes untouched.
5. **TPR-E5 — Re-entry and duplication.** Existing branches, partial durable
   state, and existing pull requests are reconstructed without duplicate
   proposals or false success from stale evidence.
6. **TPR-E6 — Recoverable and terminal failure.** Hook, push, pull-request,
   capability, interruption, and genuine-block fixtures distinguish safe
   convergence from honest stopping and preserve durable state.
7. **TPR-E7 — Scope boundary.** Necessary callers, tests, documentation, and
   compatibility work are included while adjacent product expansion requires a
   decision.
8. **TPR-E8 — Proportional review.** Routine, elevated, high-risk, repository-
   mandated, and explicitly requested cases select review consistently and
   block publication on unavailable, inconclusive, stale, or blocking review.
9. **TPR-E9 — Pull-request shape.** Base, title, body, template, ticket
   reference, draft state, push safety, and duplicate handling satisfy the Git
   publication contract.
10. **TPR-E10 — Terminal outcomes.** `pr_created`, `pr_existing`, `stopped`,
    `blocked`, and `interrupted` each carry the required semantic evidence
    without inferred values.
11. **TPR-E11 — Cross-host behavior.** Fresh Claude Code and Codex contexts
    satisfy the same public assertions despite host-specific adapters.

Before the full matrix, one fresh trial per host calibrates activation and a
non-mutating intake case, followed by one effectful ready-delivery trial and one
representative trial across all three comparative modes. The authoritative
intake probe carries a deliberate unresolved product choice so mounted
adaptive-goal reaches its decision gate without turning the intake calibration
into a delivery case. The full matrix starts only after those probes show that
skill mounting, entrypoint adaptation, hidden checks, and fail-closed
external-effect fixtures work as intended.

All designated candidate core cases and candidate edge variants require three
passing trials per host and zero unintended or duplicate external mutations.
Control failures remain comparative evidence instead of invalidating the
candidate gate. Relevant deterministic script tests pass under both `bash` and
`/bin/bash`.

## Non-goals

- Scheduled activation, Artificer, capacity management, claims, or cross-ticket
  admission.
- Repository discovery, automatic cloning, or implicit worktree creation.
- Product discovery or guessing a missing product decision during adaptive
  preflight.
- A Darrow daemon, queue, phase controller, retry ledger, dashboard, or hidden
  workflow state.
- `.darrow` evidence storage, artifact retention, or cross-ticket learning.
- Merge, auto-merge, deployment, release, tracker mutation, reviewer assignment,
  labels, or milestones.
- A performance, cost, or quality-superiority claim based only on the required
  three-trial evidence.
