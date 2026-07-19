# darrow — Product Specification

## 1. Product definition

**Status:** Invariant

darrow is a local-first, vendor-neutral workflow runtime for agentic software
delivery. It combines an independently installed CLI, declarative workflow
packs, canonical plugin skill source with deterministic harness projections,
durable execution, and typed artifacts. Claude Code and Codex are supported
harnesses; Codex is the first reference harness.

darrow makes the control plane around probabilistic agents deterministic. It
does not make model output byte-for-byte reproducible. It does make workflow
structure, inputs, resolved dependencies, attempts, human decisions, artifacts,
side-effect reports, and observable history inspectable and recoverable.

The first product is for one developer working in a Git repository, either
directly through the CLI or through a command skill in Codex or Claude Code.
Hosted and multi-user operation build on the same contracts later.

## 2. Status vocabulary and reading map

This document distinguishes five kinds of statement:

- **Invariant** — required across conforming implementations.
- **Milestone requirement** — required to complete the named milestone.
- **Deferred** — supported by the architecture but not currently scheduled.
- **Research question** — requires evidence before it can become a contract.
- **Non-goal** — intentionally excluded.

The product specification defines direction, boundaries, and product-level
contracts. Exact runtime behavior lives in these normative specifications:

- [Workflow runtime](specs/workflow-runtime.md) — read for workflow compilation,
  command and capability execution, human continuation, retries, waivers, and
  run conclusions.
- [Workspaces and artifacts](specs/workspaces-artifacts.md) — read for `.darrow/`
  layout, Git worktrees, concurrency, artifact publication, retention, and
  cleanup.
- [Compatibility](specs/compatibility.md) — read for version axes, resolution,
  locking, skill metadata, snapshots, trust, and release gates.
- [Observability](specs/observability.md) — read for journals, harness events,
  handoffs, OpenTelemetry, content, and redaction.
- [Product-value evaluation](specs/product-value-evaluation.md) — read for the
  M2 product gate, controlled treatments, task-level inference, and decision
  rules.
- [Delivery workflow](specs/delivery-workflow.md) — read for the M1
  `implement-change` command, red/green evidence, and delivery side-effect
  boundaries.
- [Git workflow](specs/git-workflow.md),
  [ticket management](specs/ticket-management.md),
  [information architecture](specs/information-architecture.md), and
  [decision management](specs/decision-management.md) — read for the behavior of
  the independently adoptable capability plugins.

Architecture choices with meaningful alternatives are recorded separately:

- [ADR-0001](decisions/ADR-0001-eval-runner.md) — custom Bun/TypeScript eval
  runner.
- [ADR-0002](decisions/ADR-0002-shipped-cli.md) — plugin-local Bash facades.
- [ADR-0003](decisions/ADR-0003-global-cli.md) — global TypeScript/Bun CLI.
- [ADR-0004](decisions/ADR-0004-temporal-backend.md) — Temporal as the first
  durable backend.

Stable invariant IDs in the normative specifications are the traceability
targets for implementation tests and evals. Links from this document are part of
the contract and must remain valid.

## 3. Product principles

**Status:** Invariant

1. **Deterministic control plane, probabilistic workers.** Static workflow
   structure, typed contracts, and bounded control flow surround agent work.
2. **Explicit commands, inferred capabilities.** The orchestrator invokes
   command skills by stable name. Optional behavioral capabilities are loaded by
   the surrounding harness from natural-language intent.
3. **Local-first, hosted-capable.** Local use needs no user-managed database,
   container stack, telemetry collector, or first-party UI.
4. **Loose coupling.** The engine, CLI protocol, workflow schema, workflows,
   command contracts, capability contracts, routing-policy contracts, and plugin
   packages evolve on independent compatibility axes.
5. **Artifact-first handoff.** Steps exchange typed, immutable artifact
   references instead of repeatedly rewriting one ticket or shared prompt.
6. **Durable human control.** A run can end an agent turn, wait without holding a
   process open, and continue later with explicit human input.
7. **Judgment in skills, mechanics in scripts.** Skills retain model judgment;
   deterministic scripts and CLIs enforce every checkable invariant.
8. **Observable and private by default.** Repository-local records explain what
   happened. Content export is opt-in, and Darrow does not claim it can detect
   every possible secret disclosure by an external tool or model.
9. **No silent mutation of the environment.** Ordinary skills never install or
   update the CLI, plugins, workers, or active-run dependencies.

## 4. Product architecture

**Status:** Invariant

The product has six cooperating surfaces:

1. **Runtime and global CLI** — source under `/cli`; owns workflow compilation,
   resolution, locking, execution, continuation, inspection, and cleanup.
2. **Plugins** — self-contained packages under `plugins/<name>/`; own one
   directly authored canonical skill source, optional bounded harness overlays,
   committed deterministic Claude and Codex projections, scripts, evals, Darrow
   metadata, and both runtime manifests.
3. **Workflow packs** — versioned YAML processes, project-local or independently
   distributed, with no generated runtime-specific source tree.
4. **Execution profiles** — bind workflow roles to a harness, provider, model
   policy, native permission configuration, and limits.
5. **Harness adapters** — translate canonical command invocations into native
   Codex or Claude Code operations and normalize their results.
6. **Execution backend** — Temporal first, hidden behind a backend interface so
   workflows and plugins do not depend on Temporal APIs.

The root `.claude-plugin/marketplace.json` indexes one plugin directory for both
supported runtimes. Each plugin retains native `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json` files with one identity and package version. Each
manifest selects its committed generated skills projection. Arbitrary Darrow
fields are not added to those runtime manifests.

`plugins/<name>/source/` is the only directly authored skill implementation.
Optional `overlays/claude/` and `overlays/codex/` content may express native
metadata, integration, or prompt optimization without changing portable
behavior, inputs, outputs, side effects, or safety guarantees. Deterministic
development tooling materializes `claude-skills/` and `codex-skills/` in the
same atomic plugin package. Generated projections and their provenance lock are
committed publication inputs, never independently edited sources.

### 4.1 Installation and distribution

**Status:** Milestone requirement — M1

The global CLI is implemented in TypeScript on Bun and released independently of
plugins. A user may install it through an explicit installer command skill or
directly through Bun. The user chooses global or repository-local scope; Darrow
has no implicit default. A repository-local install may change package and lock
files only after that choice.

Only the dedicated installer command skill may install or update the CLI.
Ordinary entrypoint, command, and capability skills report a missing or
incompatible executable and provide the installer skill or direct Bun command.
No skill updates the CLI implicitly.

Plugin-local Bash facades such as `ticket` remain implementation details covered
by [ADR-0002](decisions/ADR-0002-shipped-cli.md); they are not the global
orchestration CLI.

### 4.2 Repository-local state

**Status:** Invariant

All repository-specific Darrow configuration and state lives under one canonical
`.darrow/` directory in the primary Git worktree. Linked worktrees resolve that
same directory. Versioned configuration and published ticket artifacts may be
committed; runtime state and managed worktrees are ignored.

`darrow init` creates the layout and idempotently updates `.gitignore` and
`.gitattributes`. It never commits. Other commands do not initialize a
repository silently. Exact layout and cleanup rules are defined in
[workspaces and artifacts](specs/workspaces-artifacts.md).

## 5. Skills and control-plane providers

**Status:** Invariant

darrow initially recognizes two kinds of runtime-aware skill. M2c adds a
control-plane routing-policy provider that may be packaged with skills but is
resolved and invoked by Darrow rather than loaded by a selected harness from
intent.

### 5.1 Command skills

A command skill is an explicit operation invoked by the orchestrator. Its
canonical ID is `<plugin-name>:<skill-name>`, derived from the selected runtime
plugin manifest and its declared projection's skill directory; for example,
`darrow:run` or `darrow-delivery:review`. The same logical skill has that identity
in every harness projection. Workflows reference this ID directly. There is no
intent matching or alias registry for commands, and renaming either component is
a breaking change.

Harness adapters render the same canonical ID using native invocation syntax.
The command returns a common Darrow envelope plus output validated against its
own contract. The adapter translates invocation, streaming, cancellation,
timeout, and native-session behavior; it does not reinterpret domain results.

A command may state ordinary intent such as “create a ticket with these labels.”
It does not name the capability skill that should satisfy that intent.

### 5.2 Capability skills

A capability skill is an optional behavioral overlay loaded by the surrounding
Codex or Claude Code environment from intent. For example, the intent to create a
ticket may load `darrow-tickets:create-ticket` when that capability is installed
and enabled, or another compatible project or user capability when it is not.

Capability metadata declares portable contracts such as `tickets.create` and
their versions. Workflows and command metadata may declare a hard requirement on
a portable capability contract, never on a provider skill name. Darrow validates
hard requirements during preflight before worktrees or external side effects are
created. Missing, incompatible, ambiguous, or unverifiable hard requirements
stop with an actionable error. Optional capabilities require no hard check.

When several providers satisfy one contract, the environment configuration must
disambiguate them. Capability execution remains intent-triggered even after
preflight; preflight does not turn it into direct command invocation.

### 5.3 Skill metadata

Every Darrow-aware command, capability, or M2c routing-policy provider has a
colocated `darrow.json` in canonical source and in each generated projection.
Runtime manifests continue to own plugin identity and package version;
`darrow.json` owns command, capability, or routing-policy classification and
Darrow contract metadata. Skill and plugin names are derived rather than
duplicated. Exact shape, projection, and validation rules are defined in
[compatibility](specs/compatibility.md).

Skills or providers without `darrow.json` remain ordinary harness content and
are invisible to Darrow preflight.

### 5.4 Routing-policy providers

**Status:** Milestone requirement — M2c

A routing-policy provider implements a portable, versioned contract that selects
one complete candidate route for one declared target step or attempt. Darrow
selects the provider explicitly through scoped configuration and invokes it at
the engine scheduling boundary. It is not a capability skill: capability intent
routing occurs inside a harness after the execution route has already been
chosen.

A provider may be deterministic code or use model judgment through an
agent-backed skill. An agent-backed provider has one fixed, locked bootstrap
profile and cannot route its own invocation. Providers receive bounded typed
inputs and return a candidate route ID plus concise exposed rationale; Darrow
retains authority to validate, persist, and apply the decision.

## 6. Declarative workflow model

**Status:** Invariant

Workflow YAML describes orchestration, not arbitrary program execution. A
workflow declares its schema and workflow versions, compatible engine range,
typed inputs and outputs, command requirements, hard capability requirements,
artifact flow, roles, steps, conditions, bounded execution paths, bounded loop
regions, human gates, and subworkflows.

The static workflow graph is acyclic. Repetition exists only inside explicit,
bounded loop regions. “Execution path” and “parallel path” describe workflow
control flow; “branch” is reserved for Git branches.

The expression language is deliberately small. Conditions may inspect workflow
inputs, step states, typed outputs, artifact metadata, and capability
availability using boolean operators, comparisons, membership, and explicit
presence checks. Conditions are type-checked where possible and cannot perform
I/O, call arbitrary code, access the environment, or define functions. A
possibly skipped step cannot be the sole source of a required input unless the
workflow declares a fallback or makes the input optional.

Workflow YAML may call a closed, extensible registry of typed, versioned Darrow
built-ins by name and arguments. Pure built-ins inspect or transform workflow
data. Side-effecting built-ins execute as durable steps with the same history and
retry rules as other activities. Built-ins cover orchestration mechanics, not
domain behavior such as Git or ticket operations. YAML cannot invoke arbitrary
JavaScript, shell, or host-language functions.

Runtime-generated workflow YAML and model-directed graph rewriting are out of
scope. A workflow may use static conditions, optional steps, bounded loops, and
allowlisted subworkflows.

Starting in M2b, every command step names a workflow role. Each role resolves to
an execution profile, and each fixed profile selects one complete execution
route: harness, provider, model, reasoning effort, native permission
configuration, and limits. Different roles in one static graph may resolve to
different Claude Code or Codex routes. Workflows name roles and profile IDs; they
do not embed provider-specific model or effort names in step definitions.

The M2b shape is equivalent to this illustrative fragment; the versioned
workflow JSON Schema remains authoritative:

```yaml
roles:
  implement:
    profile: codex-deep
  review:
    profile: claude-review
steps:
  - id: implement
    role: implement
    command: { id: darrow-delivery:implement, version: ^1.0.0 }
  - id: review
    role: review
    dependsOn: [implement]
    command: { id: darrow-delivery:review, version: ^1.0.0 }
```

The compiler resolves every role and embeds the complete selected route in each
step of the immutable plan. A legacy workflow with one top-level profile remains
a shorthand for one implicit role applied to every command step.

### 6.1 Compilation and resolution

Before execution, Darrow deterministically performs:

```text
workflow source
  → schema and expression validation
  → scoped workflow resolution
  → role, profile, and execution-route resolution
  → command and hard-capability preflight
  → artifact and graph validation
  → exact version and digest resolution
  → immutable ResolvedPlan and dependency lock
  → repository-local run snapshot
  → execution backend
```

Workflow lookup resolves one scope at a time:

```text
explicit path or override > project > user > bundled defaults
```

The first scope with a match wins. Multiple matches inside that scope are an
error. Preflight reports the selected source, scope, version, and digest; the run
lock records them. Project workflows may intentionally shadow user workflows.

The backend receives the immutable `ResolvedPlan`, never a path to mutable YAML.
Run creation snapshots the workflow plus the exact harness-selected command and
capability projections, bundled scripts, and schemas under
`.darrow/runs/<run-id>/snapshot/`. The lock identifies each selected projection
and digest. Later plugin or workflow updates affect new runs only.

## 7. Execution and human continuation

**Status:** Invariant

Temporal history is authoritative for active control state. Repository-local
run data stores the plan, lock, snapshots, artifacts, content, and an append-only
audit journal. Editing that journal cannot advance a workflow.

Run lifecycle state and terminal conclusion are separate. A run can be
`running`, `waiting_for_input`, or `completed`; a completed run concludes
`succeeded`, `succeeded_with_waivers`, `failed`, or `cancelled`.

### 7.1 Waiting for input

When a decision or additional input is required, Darrow persists the state and
returns `waiting_for_input` as a successful CLI result. Human-readable and agent
handoff output includes the reason, question, allowed continuations, and ends
with:

```text
Continue: darrow continue <run-id>
```

Machine-readable output exposes the same continuation as structured data without
mixing output formats. Free-form content is supplied through the next prompt,
stdin, or structured input; it is never embedded into a generated shell command.

In an agent harness this ends the current turn. A later turn invokes `darrow
continue`; there is no polling or active agent process while waiting. Waiting has
no default expiry. Timeouts and notifications are deferred to future hosted
operation.

Any local user able to invoke `darrow continue` may respond. Actor or harness
identity is recorded when available as unverified audit metadata, not as a local
authorization decision.

### 7.2 Attempts, waivers, retries, and cancellation

A human may rerun a declared step with supplemental instructions. The previous
attempt remains immutable; the instructions become a new input artifact, and a
new attempt receives the relevant prior outputs. Every human authorization adds
only a finite number of attempts.

Only workflow-declared quality or outcome failures may be waived. Corrupt state,
missing required artifacts, hard capability failures, and infrastructure errors
are not waivable. A waived step records `accepted_with_waiver`; any accepted
waiver makes the final run conclusion `succeeded_with_waivers`. A waiver may
carry immutable instructions for the next declared step, scoped to that step
unless the workflow explicitly propagates them.

Read-only and explicitly idempotent activities may retry automatically. Agent
activities and externally effectful activities default to one automatic
attempt. If Darrow cannot know whether an external effect completed, it waits
for human inspection rather than guessing. A human may retry, accept a declared
waiver, or abort. Capabilities may implement operation-specific deduplication,
but Darrow does not pretend there is one universal side-effect receipt protocol.

Failure and cancellation stop new work without implicit rollback. Completed
commits, tickets, pull requests, comments, and published artifacts remain.
Compensation occurs only as an explicit workflow step. Cancellation interrupts
an active activity only when its checkpoint policy declares that safe. The final
result identifies completed, incomplete, and uncertain effects.

## 8. Workspaces and concurrent runs

**Status:** Invariant

Each mutating run owns an exclusive linked worktree and normally an exclusive Git
branch. Managed worktrees default to `.darrow/worktrees/<run-id>/`; an explicit
path is accepted exactly when usable. Darrow coordinates allocation only and
does not hold a repository-wide lock for the run duration.

Two Darrow processes may run independent work streams against the same
repository. Their run state, worktrees, attempts, failures, and cancellation are
independent. Integration or merge is an explicit workflow action. Worktrees are
dedicated workspaces, not security sandboxes.

A dirty invoking checkout is never silently copied, stashed, discarded, or
excluded. Unless the caller explicitly selects a base or attaches the current
workspace, Darrow waits with choices to start from `HEAD`, attach the current
worktree exclusively, or abort.

Managed worktrees are retained after success, failure, and cancellation by
default. Cleanup is explicit and refuses unsafe deletion. Details are in
[workspaces and artifacts](specs/workspaces-artifacts.md).

## 9. Artifacts and ticket learning

**Status:** Invariant

Every attempt writes immutable run-local artifacts. A workflow may explicitly
publish selected outputs under a ticket workspace for learning and reasoning
across tickets. Darrow uses “ticket” as the canonical term; external backends may
use different product vocabulary.

Ticket workspaces contain artifacts only. Tickets themselves remain records in
an external tracker behind the backend-neutral ticket capability. There is no
planned file-backed or in-repository ticket backend.

Delivery may publish a compact retained summary containing decisions, outcomes,
failed approaches, and lessons while leaving bulky intermediate transcripts,
logs, patches, and test output eligible for later cleanup. `darrow init` marks
published ticket artifacts `linguist-generated` through `.gitattributes` so
GitHub pull requests collapse them by default.

There is no background or opportunistic local garbage collection. `darrow clean`
reports eligible data, and explicit filters such as `--older-than 30d` select
deletions. `darrow clean --tickets` may create ordinary working-tree deletions of
old checked-in ticket artifacts for review and commit. It never commits, pushes,
or rewrites history, and active-run references remain protected.

## 10. Compatibility, provenance, and model policy

**Status:** Invariant

Engine, CLI protocol, workflow schema, workflow, execution-profile schema,
command contract, capability contract, routing-policy contract, and plugin
package versions are independent. A plugin's Claude and Codex projections ship
atomically under its one package version. Semantic versions express
compatibility; content digests identify exact bytes. The lock records every
resolved role and profile, the selected harness projection and digest, plus each
step's requested harness, provider, model, reasoning effort, adapter, permission
configuration, and resolved model snapshot when exposed.

Models, harnesses, providers, and their supported effort levels are external
dependencies and may disappear. Darrow never silently substitutes any component
of a requested fixed route. Unavailability produces `waiting_for_input`; an
approved replacement names a complete compatible route and creates an explicit,
scoped run amendment without rewriting the original plan. Native automatic
fallback is not enabled for fixed routes.

**Status:** Milestone requirement — M2c

An M2c role may select a versioned routing-policy provider instead of one fixed
route. The engine asks that provider to choose the route for one declared target
step or attempt from a finite allowed envelope that was resolved,
compatibility-checked, and locked before execution. A routing decision selects a
candidate route ID; it cannot emit an arbitrary provider, model, effort,
permission configuration, command, or graph mutation.

The policy may use task characteristics, prior outcomes, quality, latency, and
budget. The lock records the policy and candidate envelope; every invocation
records the actual route, selection source, and a concise reason. An explicit
user pin overrides dynamic routing within the same declared envelope.
Provider- and model-family-specific names remain profile data, not workflow step
syntax.

## 11. Temporal and portability

**Status:** Milestone requirement — M1 onward

Temporal is the first execution backend. Local Darrow owns startup, readiness,
namespacing, worker lifecycle, and repository-local Temporal data without
requiring Docker or PostgreSQL. The workflow engine is a generic interpreter over
the immutable plan; delivery workflows remain data.

The backend interface remains explicit. Darrow re-evaluates Temporal only if it
cannot satisfy a core requirement: zero-configuration local use, durable
recovery, bounded history, acceptable distribution footprint, or semantic
parity between local and hosted operation. Implementation difficulty alone is
not a reason to introduce another backend.

Local and hosted execution share workflow graphs, conditions, gates, retries,
escalations, command contracts, and artifact schemas. Paths, credentials,
sandboxing, models, tool output, and timing may differ. This is semantic
portability, not an identical environment.

Active-run migration between local and hosted environments is out of scope.
Local runs resume in the same repository environment; hosted runs resume within
their deployment workspace service. Completed artifacts and workflow sources
remain portable.

## 12. Observability and content

**Status:** Invariant

The CLI and command skill are the initial user interface; a first-party Darrow UI
is not required. `darrow inspect` combines live Temporal state with the run lock,
journal, artifacts, and authorized local content.

Darrow captures the harness events it owns or receives: command inputs and
outputs, exposed reasoning-summary items, tool activity, stdout/stderr, human
continuations, artifacts, native session references, and the effective role,
profile, harness, provider, model, effort, and route-selection source for every
invocation. It cannot observe the entire outer Codex or Claude Code conversation.

On the next agent-mediated invocation, the agent may provide a self-reported
`AgentHandoff` summarizing work between Darrow invocations: actions, files,
decisions, side effects, unresolved items, and artifact references. It contains
high-level rationale, not hidden chain-of-thought. Missing handoff data creates
an explicit observability gap but does not block execution.

OpenTelemetry export is optional, disabled by default, versioned, and
best-effort. Export failure never changes run state or outcome. Default telemetry
contains identifiers, timing, transitions, model routing, usage, and error
categories—not prompts, transcripts, free-form human input, source, diffs, or
artifact bodies.

Before full OpenTelemetry integration or M3 investment, Darrow must pass the
preregistered product-value evaluation in the
[product-value evaluation specification](specs/product-value-evaluation.md).
Only the lightweight structured records needed by that experiment are required
for the gate.

## 13. Security and permissions

**Status:** Invariant

The surrounding Codex, Claude Code, or hosted environment owns permission
enforcement. Darrow profiles select native permission configuration, record what
was selected, never broaden it, and report denials through the adapter. A
portable fine-grained permission broker is deferred to a future hosted runtime.

Darrow never intentionally serializes configured secret values. It redacts
persisted or exported content when configured values or patterns are available.
The environment remains responsible for secret access and for preventing tools
or models from disclosing unknown or transformed values. Darrow does not claim
perfect secret detection. Content telemetry is disabled by default.

For local operation, installed and enabled plugins are trusted because the user
or environment selected them. Darrow records source provenance and content
digests. Publisher identity is informational; cryptographic signing and a
Darrow-managed trust store are deferred to hosted or curated distribution.

## 14. Release requirements

**Status:** Invariant

Plugins and workflow packs release independently. Deterministic tests, contract
validation, and applicable eval suites must pass their declared thresholds.
Manifest versions, contract versions, and content digests must be consistent,
and breaking contract changes require the appropriate major-version bump. Every
plugin release contains both current harness projections and exact deterministic
provenance under one package version. Staged-commit validation and CI reject
stale or directly edited generated content without silently regenerating it.
Exact publication automation and marketplace promotion policy are outside this
product specification.

Skill eval criteria are hidden from the harness under evaluation. The shared
runner isolates each fixture from the source checkout and sibling fixtures with
an outer OS boundary that harness flags cannot disable; it refuses execution
when neither the native boundary nor an explicitly declared equivalent external
sandbox is available. A disposable Git fixture alone is not an isolation
boundary.

## 15. Milestones and exit criteria

### M0 — Capability foundation

**Status:** Milestone requirement — existing foundation

Canonical dual-runtime plugin sources with deterministic harness projections,
capability specifications, deterministic scripts and tests, judgment-focused
evals, and the shared marketplace prove the opt-in capability model.

**Exit criterion:** each shipped capability is independently installable and its
declared invariants are covered by deterministic tests and scoped evals.

### M1 — Thin durable vertical slice

**Status:** Milestone requirement

Build the TypeScript/Bun global CLI under `/cli`; explicit installation and
`darrow init`; a static sequential workflow schema; workflow and skill catalog;
hard-capability preflight; immutable plan, lock, and snapshot; minimal local
Temporal startup; one command invocation through the Codex harness; one managed
worktree; and `run`/`inspect` through terminal completion.

**Exit criterion:** in a fresh Git repository, documented interfaces alone can
initialize Darrow, resolve and lock a sequential workflow, invoke one Codex-backed
command in a managed worktree, persist its artifacts, and inspect the terminal
result without manually editing state.

### M2 — Durable local expansion

**Status:** Milestone requirement

Add concurrent runs in separate worktrees, parallel execution paths, bounded
loops, human waiting and continuation, reruns with instructions, waivers,
cancellation, crash recovery, artifact publication and cleanup, the Claude Code
adapter, and optional OpenTelemetry export.

**Exit criterion:** two Darrow processes can advance independent work streams in
one repository; one run can survive a process restart and a human wait; a bounded
implementation/review loop can retry or conclude with a recorded waiver; and
cleanup refuses active or dirty state.

### M2b — Per-step execution routing

**Status:** Milestone requirement

Replace the run-wide execution profile with role-bound profiles resolved per
command step while retaining the single-profile workflow form as compatible
shorthand. Profiles may pin different Claude Code or Codex harnesses, providers,
models, reasoning efforts, native permission configurations, and limits.
Compilation preflights every route that the static workflow can execute, locks
the complete route per step, dispatches each attempt through its selected
adapter, and records the effective route in results and journal events.

Define the M2c routing seam at the same time: a routing-policy provider may select
one candidate route for one declared target step from a finite, preflighted,
locked envelope. M2b does not require automatic routing, difficulty estimation,
or budget optimization.

**Exit criterion:** one locked workflow executes at least two dependent command
steps through different Claude Code and Codex profiles with independently chosen
models and reasoning efforts; restart and inspection preserve each attempt's
effective route; structurally incompatible routes fail before mutation; and a
model or effort change cannot silently affect another step.

### M2c — Pluggable adaptive routing

**Status:** Milestone requirement

Add an engine-owned routing decision point after a target step becomes ready and
before its command invocation is scheduled. Define a portable, versioned
routing-policy provider contract with scoped explicit resolution, bounded typed
requests, candidate-route decisions, abstention, explicit user pins, and durable
replay-safe history. The provider runs as a durable activity; the workflow engine
records and validates its decision before applying it.

Ship at least one deterministic policy and one interchangeable agent-backed
policy. The agent-backed policy uses a fixed locked bootstrap profile and cannot
route itself. M2c proves the mechanism and interchangeability; it does not make
adaptive routing the default or claim that its selections outperform fixed
routes.

**Exit criterion:** the same locked workflow and candidate envelope can use two
different routing-policy providers without changing its graph; both select only
eligible Claude Code or Codex routes from resolved upcoming work; explicit pins
and abstention behave as declared; invalid selections never fall through; and a
restart reuses the recorded decision without invoking the provider again.

### M3 — Evaluated delivery packs

**Status:** Milestone requirement

Entry into M3 is conditional on applying the preregistered M2 product-value
gate. A `continue` result permits the milestone as written; `narrow` limits M3
to the task strata that demonstrated practical value; `redesign` requires a new
preregistered confirmatory evaluation before M3; and `stop` ends investment in
the current orchestration approach. Full OpenTelemetry integration follows the
same gate and is not used to produce its evidence.

Package evidence-backed delivery workflows that exercise M2b role routing and
M2c policy routing, ticket artifact publication, and cross-runtime eval coverage.
Compare routed runs with fixed-route baselines using quality, cost, latency, and
route-selection stability. Do not require one universal delivery sequence.

**Exit criterion:** at least one released delivery pack completes its declared
cross-runtime evaluation matrix with Codex and Claude Code assigned to different
roles while satisfying its quality gates and compatibility checks; routing
results state whether and where the evaluated policies outperform fixed routes.

### M4 — Hosted operation

**Status:** Deferred

Package a hosted worker, tenant-aware workspace and content services, identity
and authorization, optional notifications and deadlines, signed distribution,
and managed Temporal deployment.

**Exit criterion:** the same workflow source demonstrates semantic parity across
local, self-hosted, and managed execution, with environment differences explicit
in profiles and provenance.

## 16. Research questions

- **Workflow fit:** compare shorter outcome-gated workflows with staged,
  verification-heavy, and dynamically deep variants using quality, token cost,
  and wall time.
- **Native versus explicit review:** compare harness-native review with command
  skills and deterministic gates.
- **Temporal feasibility:** validate replay safety, local startup, recovery,
  bounded history, uncertain side effects, long waits, and deployment parity
  against the re-evaluation criteria in section 11.
- **CLI implementation language:** after Temporal feasibility is established and
  the Rust SDK matures, compare the TypeScript/Bun runtime with a standalone
  Rust implementation across distribution footprint, runtime support,
  development cost, protocol compatibility, and active-run migration.
- **Dynamic routing policy:** use M3 evidence to determine confidence and
  abstention thresholds, per-step versus per-attempt reconsideration, and whether
  any routing policy should become a recommended or default profile behavior.
- **Development tooling:** consider a future `darrow-dev` capability for
  scaffolding, validation, and manifest maintenance beyond the deterministic
  projection generator, without creating another canonical source tree.

## 17. Non-goals

- Making probabilistic model output byte-for-byte deterministic.
- Turning workflow YAML into a general-purpose programming language.
- Runtime-generated workflow graphs or candidate YAML.
- Router-generated routes outside a finite preflighted candidate envelope.
- Silent native fallback to an unrecorded harness, provider, model, or effort.
- Building Git, ticket, ideation, or another domain application into the
  orchestration engine.
- A file-backed ticket backend.
- Implicit CLI, plugin, worker, or dependency installation and upgrades.
- Automatic rollback of completed external effects.
- A mandatory first-party UI in the local milestones.
- Background local artifact or worktree deletion.
- Active-run migration between local and hosted environments.
- Fine-grained portable permission brokering in the local runtime.
- Cryptographic plugin signing or third-party marketplace curation at launch.
- Independently authored plugin implementations per harness.
- Independent Claude and Codex release versions for one logical plugin.
- A second canonical marketplace or release-artifact source tree.
- Shipping a Pi adapter at launch.
