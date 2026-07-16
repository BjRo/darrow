# darrow — Product Specification

## 1. Product definition

**Status:** Invariant

darrow is a local-first, vendor-neutral workflow runtime for agentic software
delivery. It combines an independently installed CLI, declarative workflow
packs, directly authored plugin skills, durable execution, and typed artifacts.
Claude Code and Codex are supported harnesses; Codex is the first reference
harness.

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
- [Delivery workflow](specs/delivery-workflow.md) — read for the M1
  `implement-change` command, red/green evidence, and delivery side-effect
  boundaries.
- [Git workflow](specs/git-workflow.md),
  [ticket management](specs/ticket-management.md), and
  [information architecture](specs/information-architecture.md) — read for the
  behavior of the existing capability plugins.

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
   command contracts, capability contracts, and plugin packages evolve on
   independent compatibility axes.
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
2. **Plugins** — directly authored, self-contained packages under
   `plugins/<name>/`; own skills, scripts, evals, Darrow metadata, and both
   runtime manifests.
3. **Workflow packs** — versioned YAML processes, project-local or independently
   distributed, with no generated runtime-specific source tree.
4. **Execution profiles** — bind workflow roles to a harness, provider, model
   policy, native permission configuration, and limits.
5. **Harness adapters** — translate canonical command invocations into native
   Codex or Claude Code operations and normalize their results.
6. **Execution backend** — Temporal first, hidden behind a backend interface so
   workflows and plugins do not depend on Temporal APIs.

The root `.claude-plugin/marketplace.json` indexes canonical plugin directories
for both supported runtimes. Each plugin retains native
`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` files. Arbitrary
Darrow fields are not added to those runtime manifests.

Generation is not a product layer. Future development tooling may scaffold,
validate, or mechanically package plugins, including runtime-specific tailoring,
but directly authored plugin directories remain canonical.

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

## 5. Skills: commands and capabilities

**Status:** Invariant

darrow recognizes two kinds of runtime-aware skill.

### 5.1 Command skills

A command skill is an explicit operation invoked by the orchestrator. Its
canonical ID is `<plugin-name>:<skill-name>`, derived from the runtime plugin
manifest and skill directory; for example, `darrow:run` or
`darrow-delivery:review`. Workflows reference this ID directly. There is no
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

Every Darrow-aware command or capability skill has a colocated `darrow.json`.
Runtime manifests continue to own plugin identity and package version;
`darrow.json` owns command/capability classification and Darrow contract
metadata. Skill and plugin names are derived rather than duplicated. Exact shape
and validation rules are defined in [compatibility](specs/compatibility.md).

Skills without `darrow.json` remain ordinary harness skills and are invisible to
Darrow preflight.

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

### 6.1 Compilation and resolution

Before execution, Darrow deterministically performs:

```text
workflow source
  → schema and expression validation
  → scoped workflow resolution
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
Run creation snapshots the workflow, command skills, capability skills, bundled
scripts, and schemas under `.darrow/runs/<run-id>/snapshot/`. Later plugin or
workflow updates affect new runs only.

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

Engine, CLI protocol, workflow schema, workflow, command contract, capability
contract, and plugin package versions are independent. Semantic versions express
compatibility; content digests identify exact bytes. The lock records exact
resolved versions and digests plus the requested model/provider, harness and
adapter version, profile digest, native permission configuration, and resolved
model snapshot when exposed.

The model and harness are external dependencies and may disappear. Darrow never
silently substitutes a requested fixed model. Unavailability produces
`waiting_for_input`; an approved substitution creates an explicit run amendment
without rewriting the original plan.

**Status:** Deferred

Execution profiles may later select a versioned dynamic model policy instead of
a fixed model. The policy chooses model, effort, and mode per step or attempt
from an allowed envelope using task characteristics, prior outcomes, quality,
latency, and budget. The lock records the policy and allowed envelope; every
invocation records the actual route and a concise reason. An explicit user pin
overrides routing. Model-family-specific names remain profile data, not workflow
schema.

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
continuations, artifacts, and native session references. It cannot observe the
entire outer Codex or Claude Code conversation.

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
and breaking contract changes require the appropriate major-version bump. Exact
CI, publication automation, and marketplace promotion policy are outside this
product specification.

## 15. Milestones and exit criteria

### M0 — Capability foundation

**Status:** Milestone requirement — existing foundation

Directly authored dual-runtime plugins, capability specifications,
deterministic scripts and tests, judgment-focused evals, and the shared
marketplace prove the opt-in capability model.

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

### M3 — Evaluated delivery packs

**Status:** Milestone requirement

Package evidence-backed delivery workflows, mixed-runtime profiles, ticket
artifact publication, and cross-runtime eval coverage. Do not require one
universal delivery sequence.

**Exit criterion:** at least one locked workflow completes representative tasks
with Codex and Claude Code assigned to different roles while satisfying its
declared quality gates and compatibility checks.

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
- **Dynamic model policy:** evaluate difficulty estimation and model/effort
  routing against fixed policies on representative workloads before scheduling
  it.
- **Development tooling:** consider a future `darrow-dev` capability for
  scaffolding, validation, manifest maintenance, and runtime packaging without
  creating another canonical source tree.

## 17. Non-goals

- Making probabilistic model output byte-for-byte deterministic.
- Turning workflow YAML into a general-purpose programming language.
- Runtime-generated workflow graphs or candidate YAML.
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
- Separate generated or hand-authored plugin trees per harness.
- A second canonical marketplace or release-artifact source tree.
- Shipping a Pi adapter at launch.
