# Task Recipe: Ticket to Pull Request

Darrow should provide one explicitly invoked task recipe that turns one ready,
authoritative ticket in the current repository into exactly one verified pull
request. The recipe composes focused environment capabilities and one adaptive
host-native goal without introducing a workflow runtime.

Plugin: `darrow-ticket-to-pr`  
Skill: `ticket-to-pr`

## Why

Ticket delivery requires more than implementation. The complete outcome spans
authoritative ticket intake, readiness, local-work safety, adaptive execution,
verification, conditional independent review, Git publication, recovery, and
an inspectable terminal result. Requiring users to restate those boundaries for
every ticket is error-prone, while rebuilding them as a controller would
duplicate the host's execution and recovery machinery.

`ticket-to-pr` provides the reusable outcome contract. It performs specialized
read-only intake and preflight, then delegates execution and continuation to
one adaptive native goal. Installed capabilities continue to own ticket access,
readiness, review, Git operations, and telemetry mechanics.

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
content fulfills the ready ticket and its quality bar. The pull request may be
newly created or an existing unambiguously correlated proposal reconstructed
during re-entry.

The recipe uses the current repository. It does not search for or clone another
repository. A linked worktree is created only when the user explicitly requests
one through an available matching capability.

Codex and Claude Code expose the same public recipe behavior. Host-specific
launch, capability, and telemetry adapters may differ underneath that contract.

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

## Read-only preflight

Before product, repository, or publication mutation, the recipe:

1. resolves the authoritative ticket input;
2. confirms the current repository and records pre-existing work;
3. discovers required capability availability and applicable repository
   constraints;
4. reconstructs any unambiguously correlated branch, commits, remote branch,
   and open pull request;
5. confirms the invocation's exact authority; and
6. invokes an available implementation-readiness capability.

Only a `ready` readiness verdict permits delivery mutation. Every other verdict
terminates the recipe before delivery mutation and preserves the complete
readiness result and smallest next action. The recipe does not turn a non-ready
ticket into an implicit discovery or planning workflow.

OpenTelemetry observation authorized by this recipe may begin during preflight.
Telemetry emission is operational evidence, not delivery mutation, and grants
no authority to continue past a non-ready result.

## Adaptive execution

For a ready ticket, the recipe compiles and activates exactly one adaptive
host-native goal through a compatible environment capability. The goal owns
implementation, adaptation, recovery, verification, and completion.

The delegation identifies the recipe as an orchestration entrypoint the user
explicitly invoked and carries the originating ticket request and authority
unchanged. It does not require a second user invocation of the adaptive goal or
grant the adaptive goal any additional authority.

The goal contract preserves:

- the authoritative ticket and concrete readiness quality bar;
- the current repository and pre-existing work;
- observable acceptance criteria, scope, and explicit non-goals;
- the authorized branch, commit, push, and one-PR effects;
- applicable repository verification;
- adaptive workflow, risk, route, and independent-review selection; and
- required terminal delivery and telemetry evidence.

The goal may make changes necessary to fulfill the ticket coherently, including
affected tests, callers, documentation, and compatibility corrections. It MUST
stop for an authorized decision before expanding into adjacent product behavior
that the ticket does not require.

The recipe and goal MUST NOT add a phase graph, planner/executor controller,
private retry loop, durable phase state, or background supervisor. The
host-native goal remains the sole continuation owner.

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

Unknown, stale, or content-invalidated checks and reviews are rerun. Claims that
work probably passed are not durable evidence.

For recoverable commit-hook, push, or pull-request failures, the goal makes the
smallest correction already authorized by the ticket, reruns invalidated
verification, and continues until publication succeeds or a genuine external
block, user interruption, or explicit budget stops it. It never bypasses hooks,
force-pushes, broadens scope, or uses an arbitrary retry count.

On interruption or blockage, the result reports the exact durable branch,
commit, remote, and pull-request state available for a later invocation.

## Verification and independent review

The readiness quality bar supplies the observable product oracle. Adaptive
execution selects the implementation workflow and proportional risk gate:

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

## Terminal result

Every invocation reports exactly one delivery outcome:

- `pr_created` — a new verified pull request was opened;
- `pr_existing` — an existing correlated pull request was verified as the
  complete outcome;
- `stopped` — readiness or an authorized decision stopped delivery;
- `blocked` — a required capability, permission, route, repository condition,
  or external operation prevented completion; or
- `interrupted` — the user, an explicit budget, or the host ended execution.

The terminal result is serialization-neutral and identifies:

- the ticket and repository;
- the delivery outcome and its reason;
- the readiness verdict and quality bar;
- the applicable branch, base, commits, remote branch, and pull-request URL;
- verification and independent-review evidence;
- preserved or excluded local work;
- the adaptive-goal launch record; and
- telemetry status.

Unavailable values are reported honestly rather than inferred. A successful
outcome requires current-content verification; the presence of a branch,
commit, or pull-request URL alone is not proof of ticket fulfillment.

## OpenTelemetry contract

OpenTelemetry is part of the v1 product contract. The recipe emits one
versioned, correlated lifecycle through an available environment adapter while
leaving SDK, exporter, collector, storage, and dashboard ownership outside the
plugin.

The lifecycle correlates:

- recipe invocation and terminal outcome;
- ticket and repository identity;
- ticket resolution and readiness outcome;
- adaptive workflow, risk, selected and effective route, launch boundary, and
  goal completion;
- invoked capability outcomes and durations;
- branch, base, commit, remote, and pull-request identity when available;
- verification and independent-review outcomes; and
- interruption, blockage, retry, and degraded-evidence conditions.

The telemetry contract reuses or correlates the adaptive goal's canonical
launch record. It does not reconstruct host turns, descendant agents, or timing
that the environment can observe more accurately, and it never becomes a
workflow state store.

Telemetry reports one status independently of delivery outcome:

- `emitted` — the configured adapter accepted the lifecycle evidence;
- `degraded` — no compatible adapter was available; or
- `failed` — an available adapter failed to accept or complete emission.

`degraded` and `failed` are visible but do not convert a successful direct
delivery into failure. A future environment or automation policy may require
working telemetry as an admission condition without changing this recipe's
direct-invocation semantics.

PII, credentials, authentication tokens, private keys, and other secrets MUST
NOT be emitted. Non-PII, non-secret ticket text, prompts, diffs, and logs MAY be
emitted. Content-bearing attributes remain distinguishable so an environment
policy can redact or disable them without removing the core identifier,
outcome, duration, and correlation evidence. Unsafe content is omitted rather
than weakening the privacy boundary.

Exact OpenTelemetry span names, attribute names, schema-version mechanics, and
trace-context propagation are technical design inputs. Their implementation
MUST preserve the semantic lifecycle and privacy invariants in this
specification.

## Invariants

1. **TPR-C1 — Explicit activation.** Only explicit ticket-to-PR invocation
   activates the task recipe and its publication authority.
2. **TPR-C2 — One authoritative request.** Delivery uses exactly one resolved,
   non-contradictory authoritative ticket or supplied specification.
3. **TPR-C3 — Readiness before delivery mutation.** Only `ready` permits
   product, repository, or publication mutation; every other verdict stops and
   is preserved completely.
4. **TPR-C4 — One native goal owner.** One adaptive host-native goal owns
   implementation, recovery, verification, and completion without a Darrow
   workflow runtime.
5. **TPR-C5 — Bounded authority.** Invocation authorizes one task branch,
   intended commits, a non-force push, and exactly one pull request, but no
   merge, deployment, release, ticket mutation, or unrelated effect.
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
    one defined delivery outcome, durable progress, and an independent
    telemetry status.
12. **TPR-C12 — OpenTelemetry from v1.** The versioned semantic lifecycle is
    emitted when a compatible adapter exists and degrades visibly without one.
13. **TPR-C13 — Telemetry privacy.** PII and secrets never enter telemetry;
    non-sensitive content remains separately controllable from core metadata.
14. **TPR-C14 — Cross-host contract.** Claude Code and Codex expose the same
    authoritative inputs, effects, stops, outcomes, and telemetry semantics.

## Packaging and portability

1. **TPR-P1 — Independent plugin.** `darrow-ticket-to-pr` is independently
   installable and does not reference sibling-plugin files or assume a named
   provider is installed.
2. **TPR-P2 — Intent composition.** Ticket access, readiness, adaptive native-
   goal execution, review, Git, and telemetry are requested through host-visible
   compatible intent or public contracts. Missing required delivery capability
   stops honestly; missing telemetry degrades honestly.
3. **TPR-P3 — Dual-host packaging.** Claude Code and Codex manifests expose the
   same skill semantics, and the Codex manifest points at `./skills/`.
4. **TPR-P4 — Portable mechanics.** Any plugin-shipped executable mechanics use
   portable Bash, baseline Unix utilities, and wrapped host CLIs, supporting
   Bash 5 and macOS `/bin/bash` 3.2.
5. **TPR-P5 — Contextual judgment.** Authority, dirty-work ownership, scope,
   readiness evidence, and recoverability remain contextual model judgments;
   deterministic scripts own only repeatable protocol and validation mechanics.

## Evaluation requirements

The tracked comparative suite names one representative core case for each of
TPR-E1 through TPR-E13. Each representative runs at least three trials on both
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

Activation is calibrated separately from behavior. Activation cases cover
direct, incomplete, ordinary-negative, natural-language, and pressure inputs;
TPR-E1 through TPR-E13 behavior cases pass or fail only from repository, forge,
telemetry, and terminal-output evidence. A direct host skill event is preferred.
When a host exposes no such event, the harness may inject a bounded private
activation sentinel into the mounted evaluation copy of each skill and report
that explicitly as controlled-probe evidence. It never infers activation from
the final answer.

No-mutation cases compare the selected branch, every repository ref, index,
tracked worktree, and untracked-file state. Cases whose contract explicitly
creates repository state declare that expectation and pair it with a specific
state assertion. Telemetry fixtures append every adapter invocation and require
exactly one lifecycle so a later safe payload cannot overwrite an earlier
secret or hide a duplicate emission. Terminal-result cases require one
versioned record with each required field exactly once and ground publication
facts in fixture-visible branch, remote, and forge state.

Required cases include:

1. **TPR-E1 — Ready delivery.** A ready routine ticket produces exactly one
   verified, review-ready pull request with the intended committed scope.
2. **TPR-E2 — Authoritative intake.** Resolvable references and supplied
   authoritative content proceed; missing, ambiguous, and contradictory inputs
   stop without delivery mutation.
3. **TPR-E3 — Readiness composition.** Every non-ready verdict is preserved
   completely and leaves product, repository, and forge state unchanged.
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
11. **TPR-E11 — OpenTelemetry lifecycle.** Configured adapters receive one
    coherent versioned lifecycle correlated with delivery evidence; unavailable
    and failing adapters produce `degraded` and `failed` without corrupting the
    delivery outcome.
12. **TPR-E12 — Telemetry privacy.** Seeded PII, credentials, tokens, keys, and
    other secrets never appear in exported attributes, events, errors, or
    content fields; permitted non-sensitive content remains independently
    controllable.
13. **TPR-E13 — Cross-host behavior.** Fresh Claude Code and Codex contexts
    satisfy the same public assertions despite host-specific adapters.

Before the full matrix, one fresh trial per host calibrates activation and a
non-mutating intake case, followed by one effectful ready-delivery trial and one
representative trial across all three comparative modes. The full matrix starts
only after those probes show that skill mounting, entrypoint adaptation, hidden
checks, and fail-closed external-effect fixtures work as intended.

All designated candidate core cases and candidate edge variants require three
passing trials per host, zero unintended or duplicate external mutations, and
zero seeded PII or secret leakage. Control failures remain comparative evidence
instead of invalidating the candidate gate. Relevant deterministic script tests
pass under both `bash` and `/bin/bash`.

## Non-goals

- Scheduled activation, Artificer, capacity management, claims, or cross-ticket
  admission.
- Repository discovery, automatic cloning, or implicit worktree creation.
- Product discovery, implementation planning, or decision-making inside a
  non-ready delivery run.
- A Darrow daemon, queue, phase controller, retry ledger, dashboard, or hidden
  workflow state.
- A bundled OpenTelemetry SDK, exporter, collector, backend, or visualization.
- `.darrow` evidence storage, artifact retention, or cross-ticket learning.
- Merge, auto-merge, deployment, release, tracker mutation, reviewer assignment,
  labels, or milestones.
- A performance, cost, or quality-superiority claim based only on the required
  three-trial evidence.
