# darrow — Product Specification

## 1. What darrow is

darrow is a reusable, vendor-neutral **agentic delivery factory and workflow
runtime**. It combines an independently distributed CLI, declarative workflow
packs, and directly authored, versioned plugin skills for Claude Code and Codex
(Pi later). Shared behavior lives in explicit workflow, skill, artifact, and
adapter contracts rather than generated runtime-specific source trees.

The domain application is irrelevant to darrow; any repository is a workload.
Claude and Codex are first-class, interoperable execution targets. A single run
may, for example, use Claude as planner and reviewer while Codex acts as the
implementer and workhorse.

darrow makes the orchestration around probabilistic agents as deterministic as
possible. It does not claim that an LLM invocation is byte-for-byte
deterministic. Instead it makes the workflow graph, inputs, versions,
permissions, retries, gates, artifacts, and observable run history reproducible.

## 2. Product principles

1. **Deterministic control plane, probabilistic workers.** Control flow and
   quality gates are code- and schema-driven. LLM, harness, git, filesystem, and
   test execution happen behind explicit, retry-safe activity boundaries.
2. **Vendor-neutral contracts.** Workflows name roles and skill contracts, not
   vendor-specific commands. Execution profiles bind those roles to a harness,
   provider, and model.
3. **Loose coupling.** The darrow CLI, workflow packs, plugins, and skill
   contracts have independent release cycles. Compatibility is checked before a
   run; nothing is silently installed or upgraded.
4. **Local-first, hosted-capable.** A local run needs no manually managed
   database, container stack, or telemetry collector. The same resolved workflow
   can run against hosted infrastructure without changing its semantics.
5. **Artifact-first handoff.** Steps exchange typed, immutable artifact
   references rather than growing one shared prompt or mutable ticket document.
6. **Observable by default, private by default.** Every run has a local,
   structured journal and can export OpenTelemetry. Users can see live and
   historical conversations in the UI, but conversation content is kept in a
   separate, access-controlled content store rather than copied into workflow
   history or telemetry. Source, prompts, responses, diffs, and tool content are
   not exported unless explicitly enabled; managed secrets are never recorded or
   exported.
7. **Judgment in skills, mechanics in scripts.** Skills retain model judgment;
   deterministic scripts and CLIs enforce every checkable invariant.
8. **Durable human control.** Agents can request input or a decision, and bounded
   automation escalates instead of looping indefinitely. Darrow pauses without
   losing state and resumes the declared continuation after an authorized
   resolution.

## 3. Existing foundation

darrow already proves the capability packaging model on a deliberately small
surface:

- each capability is an independently adoptable plugin that does not assume a
  sibling plugin is installed;
- capabilities are opinionated implementations of an intent: they codify how an
  operation should happen when installed, while remaining optional and
  replaceable;
- workflows target declared intents and contracts rather than a specific darrow
  plugin. Intent resolution may select the darrow capability, a compatible
  third-party plugin, a project-local implementation, or a declared
  harness-native fallback when no additional conventions are required;
- Claude Code and Codex consume the same marketplace while retaining their own
  plugin manifests and runtime-specific skill invocation syntax;
- capability behavior is specified through invariants, deterministic scripts
  and tests, and judgment-focused evals;
- plugin-local CLIs keep backend mechanics out of skills—for example,
  `darrow-tickets` exposes backend-neutral ticket operations currently backed by
  GitHub Issues;
- skills hold judgment while scripts enforce every checkable safety rule.

For example, a team using another ticket system can omit `darrow-tickets` and
provide a plugin that satisfies the required ticket intents. A team with its own
git conventions can omit `darrow-git` and provide its own git capability. A
workflow that only needs ordinary git or GitHub pull-request operations may
instead permit the agent to use its native `git` and `gh` tools.

Missing optional capabilities may be skipped or satisfied through a declared
harness-native fallback. Darrow rejects a run only when no available
implementation satisfies a hard workflow requirement. It must never silently
claim that an unavailable capability's conventions or guarantees were enforced.

These are product constraints for the workflow runtime. A historical delivery
process is not: darrow will encode only workflow structures that earn their place
through evaluation on current agents and real tasks.

## 4. Product architecture

The architecture has four source and distribution surfaces plus execution
infrastructure:

1. **darrow runtime and CLI** — the generic control plane whose source lives at
   the repository root under `cli/`. It owns the workflow schema and compiler,
   shared contract types, dependency resolver, lock format, run journal, and
   execution interfaces. It discovers, validates, resolves, locks, executes,
   resumes, and inspects workflows without hardcoding delivery phases.
2. **Plugins** — directly authored, self-contained capabilities under
   `plugins/<name>/`. Each plugin owns its skills, scripts, evals, and both
   runtime manifests. Shared skill source is canonical; runtime-specific metadata
   is colocated only where the runtime requires it.
3. **Workflow packs** — independently versioned YAML definitions that compose
   skills into reusable delivery processes. Packs may be project-local under
   `.darrow/workflows/`, plugin-provided under `workflows/`, or distributed as
   standalone packages.
4. **Marketplace index** — `.claude-plugin/marketplace.json` points directly at
   the canonical plugin directories under `plugins/`. Codex consumes the same
   index. There is no separate `marketplace/` source or generated-artifact
   directory.
5. **Execution backend** — Temporal is the initial durable backend. darrow keeps
   Temporal behind an engine interface so the workflow format, plugins, and
   skills do not depend on Temporal APIs.
6. **Catalog and harness adapters** — a `SkillCatalog` discovers installed
   plugin manifests in each supported runtime. Harness adapters translate a
   canonical invocation into the runtime-specific form and normalize results.

The same engine can therefore assemble a full delivery pipeline, a small-change
workflow, a dependency update, a security fix, ticket refinement, or a docs
refresh without changing the CLI binary.

Modularity remains **capability = plugin = opt-in unit**. Consumers can adopt a
workflow or ticket capability while retaining their own git conventions. The
development loop is edit canonical plugin or workflow source → run deterministic
tests and evals → version → update the marketplace index when needed → publish.
darrow dogfoods its own marketplace, skills, workflows, and runtime.

Generation is not a product layer. Build tooling may derive schemas, metadata,
documentation, or release archives when that transformation is purely
mechanical. Such output is disposable build output and never a second canonical
plugin or marketplace tree.

### 4.1 Distribution boundary

The darrow CLI is released independently, for example as a Homebrew package,
standalone binary, npm package, or hosted worker image. Plugins and marketplace
entries can update without updating the CLI, provided their declared contracts
remain compatible.

The canonical source, package metadata, and tests for the global runtime live in
`/cli` in this repository. Release pipelines build CLI and worker artifacts from
that directory. Plugins may depend on a compatible released CLI contract, but
must not vendor or duplicate its source.

A plugin or skill must never install or upgrade the darrow CLI, deploy a worker,
start hosted infrastructure, or install another plugin. An entrypoint skill
checks compatibility and fails with an actionable message when the runtime or a
required skill is absent.

Plugin-local bash facades such as `ticket` remain governed by
[ADR-0002](decisions/ADR-0002-shipped-cli.md). They are capability implementation
details bundled with a plugin and are distinct from the global darrow
orchestration CLI. The implementation and packaging language of the global CLI
requires its own ADR.

### 4.2 Entry points and invocation direction

Users can start the same workflow directly:

```text
darrow run delivery --profile mixed-frontier
```

or through an installed plugin skill:

```text
Codex:       $darrow:run delivery
Claude Code: /darrow:run delivery
```

The entrypoint skill invokes the already-installed `darrow` executable through
a versioned, machine-readable CLI contract. The CLI owns orchestration; no MCP
server is required in the invocation path. Commands used by skills accept
structured input where needed, provide structured output, and return documented,
stable exit statuses.

The CLI exposes human-readable `darrow help` plus agent-oriented discovery via
`darrow help --format json` and `darrow help <command> --format json`. Structured
help reports the CLI and protocol versions, available commands, arguments,
input/output schemas, exit statuses, capability requirements, and concise usage
examples. Skills use this interface for discovery and compatibility checks
rather than parsing prose help or assuming commands from a particular CLI
release.

The runtime invokes worker skills by canonical name, for example
`darrow:refine`. The harness adapter renders `$darrow:refine` for Codex or
`/darrow:refine` for Claude Code. Entrypoint skills and worker skills are
separate: worker skills do not call the orchestration CLI and cannot recursively
start the same workflow.

## 5. Declarative workflow model

Workflow YAML describes orchestration, not arbitrary program execution. A
definition contains:

- a workflow name, semantic version, and schema version;
- a compatible darrow engine range;
- required skills and their contract-version ranges;
- typed inputs, outputs, and artifact references;
- abstract roles such as planner, implementer, reviewer, and QA;
- sequential or acyclic graph steps, bounded parallelism, deterministic
  conditions, and bounded repeat/rework loops;
- retries, timeouts, typed human escalations, subworkflows, and quality gates;
- the permissions and capabilities each role may request.

Execution profiles are separate from workflow definitions. They bind abstract
roles to a harness, provider, model, and limits. This makes a Claude-planner /
Codex-implementer profile a configuration choice rather than a fork of the
workflow.

The first DSL deliberately excludes arbitrary JavaScript, inline shell,
unbounded loops, runtime-generated skill names, I/O from conditions, and
unbounded model-directed graph rewriting. New orchestration primitives enter the
schema only when their replay and validation behavior is well defined.

### 5.1 Compilation and immutable plans

Before execution, darrow compiles a workflow through a deterministic pipeline:

```text
YAML
  → schema validation
  → engine and skill resolution
  → capability, permission, and artifact-type validation
  → cycle and bound checks
  → exact version and digest pinning
  → immutable ResolvedPlan
  → execution backend
```

The backend receives the frozen `ResolvedPlan`, never a path to mutable YAML.
The plan contains the workflow digest, exact plugin and skill implementations,
contract versions, profiles, models, permissions, timeouts, and retry policy.

### 5.2 Dynamic planning and Claude workflow reuse

Vendor-specific dynamic workflows are not directly portable because their
commands, tool schemas, hooks, and state semantics belong to that harness. Their
planning logic is reusable in darrow in either of two forms:

1. translate the flow into a portable darrow workflow and keep only the
   vendor-specific invocation behind an adapter; or
2. let a planner, including Claude, select an allowlisted subworkflow or produce
   candidate darrow YAML.

Model-produced workflow changes never execute immediately. They pass through the
same schema compiler, resolver, capability policy, bounds checks, and optional
human approval before becoming an immutable plan. This preserves useful dynamic
planning without giving a model an unconstrained control plane.

### 5.3 Human escalation contracts

Human input is a first-class workflow event, not an error or an interaction
implemented independently by each skill. A step can produce a typed escalation
request instead of succeeding or failing. Initial escalation kinds are:

- **input** — required context or clarification is missing;
- **decision** — several valid continuations require a human choice;
- **approval** — a plan, permission increase, policy exception, or external side
  effect requires authorization;
- **non-convergence** — a bounded review, verification, or rework loop exhausted
  its allowed attempts;
- **manual pause** — an authorized user deliberately stops progress to provide
  direction.

An escalation request contains a stable ID and version, run and step IDs, kind,
reason, question, response schema, permitted options, required responder role,
context artifact references, timeout policy, and the allowed continuation for
each resolution. The full plan, diff, transcript, or test output is referenced,
not copied into workflow state.

A resolution contains the escalation ID and expected version, authenticated
actor, selected decision, optional response-content reference and hash, and
timestamp. It is accepted only while that exact escalation is open. Duplicate,
stale, malformed, or unauthorized resolutions are rejected deterministically.

Workflows declare escalation behavior at the point where it can occur. A
planning activity that needs clarification can resume the same logical step with
the extra input. A bounded loop declares its maximum attempts and an exhaustion
escalation whose choices can route to another attempt, accept with an explicit
waiver, return to an earlier step, or abort. Timeout behavior is also explicit:
keep waiting, notify again, choose a declared default, fail, or cancel. There is
no implicit approval or unbounded retry.

Independent branches may continue while one branch waits for a human unless the
workflow explicitly makes the escalation run-blocking. Exact YAML field names
remain part of the workflow-schema decision, but these semantics are mandatory.

## 6. Compatibility, resolution, and locking

darrow versions three contracts independently:

1. **Engine and CLI protocol version** — command, structured help, input/output,
   and exit-status schemas together with the workflow schema and execution
   semantics.
2. **Workflow version** — the declarative process and its input/output contract.
3. **Skill contract version** — the callable behavior, schemas, artifacts, and
   required capabilities of one skill.

A plugin package version is not a skill contract version. For example, plugin
`7.4.2` may provide `darrow:refine` contract `3.1.0`. A workflow can require
`>=3.0.0 <4.0.0` and continue to work across compatible plugin releases.

The resolver performs a complete preflight before creating a run. It rejects a
missing, incompatible, ambiguous, or unauthorized skill with a clear error; it
does not auto-install or auto-update anything. For mixed-runtime workflows it
checks availability and compatibility in every selected harness.

Resolution follows these rules:

- use an existing lock when it satisfies the workflow;
- otherwise choose the highest installed compatible contract implementation;
- record the exact plugin version and digest, skill contract version, workflow
  digest, darrow engine/protocol version, harness, provider, and model;
- snapshot or content-address the resolved plugin files for the lifetime of the
  run; marketplace updates affect new runs only;
- refuse to resume if an immutable dependency cannot be recovered or its digest
  has drifted.

Cross-plugin composition happens only through canonical skill intent and
versioned schemas. A plugin never reaches into a sibling plugin path or assumes
that a sibling is installed.

## 7. Execution model

### 7.1 Deterministic orchestration

The workflow engine performs only deterministic state transitions. Every
nondeterministic or external side effect—LLM calls, harness invocations, git,
filesystem writes, tests, network requests, and artifact storage—runs as an
activity with explicit inputs and outputs.

Activities may be retried and therefore must be idempotent or deduplicated with
a stable run and invocation ID. Agent activities checkpoint immutable artifacts
so a retry can detect a completed invocation rather than duplicate commits,
comments, pull requests, or other side effects. Gates consume structured output
and decide pass, fail, retry, rework, or open a typed escalation without asking a
model to interpret control state implicitly.

Durable runs support pause, resume, cancellation, approvals, and status queries.
Temporal Updates submit tracked, validated human resolutions; Queries expose
status without mutating workflow state; Signals serve asynchronous integrations
that do not require an immediate result.

### 7.2 Human escalation lifecycle

When a step requests escalation, Darrow completes the current activity, records
its output, and transitions the affected branch from `RUNNING` to
`WAITING_FOR_HUMAN`. It checkpoints the immutable `ResolvedPlan` and dependency
lock, current step and attempt, workspace state, artifacts, transcript reference,
and native harness session ID when one exists. The workflow does not retry the
step and no agent process or worker slot remains occupied while waiting.

A planning or review activity that needs human input returns this structured
result instead of holding an agent call open. An externally requested manual
pause takes effect at a deterministic activity boundary or cancels the active
activity only when the workflow's checkpoint policy declares cancellation safe.

The CLI and UI expose open escalations through workflow Queries. An authenticated
resolution is submitted through a validated Temporal Update so the caller gets a
tracked acceptance or rejection. Signals are reserved for asynchronous
integrations that do not require an immediate result. The workflow records the
accepted resolution, transitions the branch back to `RUNNING`, and schedules the
declared continuation.

Free-form human input and supporting content are written to Darrow's content
store first. Temporal receives only a decision value, content reference and
hash, escalation ID, and expected version; conversation content is not embedded
in workflow history. The run journal records escalation-opened and
escalation-resolved events with the actor, time, choice, and content reference.

A runtime adapter may resume a native Claude Code or Codex session when it is
available, but native session continuity is only an optimization. The portable
resume path reconstructs context from the locked plan, workspace, artifacts,
transcript reference, and human response. A run must therefore resume after a
process restart, a long wait, or migration to another compatible worker without
depending on provider-owned conversation state.

### 7.3 Temporal backend and local experience

Temporal is the initial execution backend because it provides durable state,
retries, timers, signals, queries, and replayable workflows in an open-source,
self-hostable system. darrow uses a generic interpreter over the immutable plan;
individual delivery workflows are data, not newly compiled Temporal code.

Local execution is zero-configuration by default:

- `darrow run` ensures a compatible local Temporal development service and
  worker are available, using file-backed local state and no required Docker or
  PostgreSQL; the darrow distribution bundles or manages this dependency rather
  than delegating it to a skill;
- darrow owns startup, readiness, namespacing, shutdown policy, and state paths;
- repeated CLI and skill invocations attach to the same local service;
- advanced users may run the service and worker explicitly.

Hosted execution uses the same workflow compiler and worker code. Configuration
points darrow at Temporal Cloud or a self-hosted Temporal cluster and at the
appropriate artifact, secret, and workspace services. Backend-specific
connection details stay outside workflow YAML.

### 7.4 Workspaces and artifacts

Local coding activities run in isolated git worktrees. Hosted activities run in
ephemeral workspaces that clone a pinned revision and apply prior patch
artifacts. Both expose the same workspace contract to skills.

Per-issue artifacts live under `.darrow/issues/<issue-id>/` when they belong in
the repository. Per-run metadata lives under `.darrow/runs/<run-id>/`. Large
logs, patches, source snapshots, prompts, and model responses are stored outside
Temporal history; workflow state carries only typed references, hashes, sizes,
and schemas.

### 7.5 Conversations and content

Conversation visibility is a product requirement and is independent of
observability export. The UI receives live agent events and can read the
authorized transcript for a run. Local runs retain conversation history by
default in the run's local content store so the UI and `darrow inspect` can
reopen it after a restart. That content is not automatically sent to an OTLP
collector or placed in Temporal history.

Hosted deployments use an encrypted, tenant-isolated content store with explicit
access control, retention, and deletion policies. Deployments may offer a
live-only mode that streams conversation events without retaining the full
transcript. In either mode, Temporal and the structured run journal carry only
content references and safe metadata. Managed secrets are excluded, and content
is redacted for accidental secret exposure before it is stored or streamed.

## 8. Observability

Observability belongs to the darrow runtime and adapters, not to individual
skills. Every run writes a structured local journal even when no telemetry
collector is configured:

```text
.darrow/runs/<run-id>/
  run.json
  events.jsonl
  content/
  artifacts/
  results/
```

`run.json` and `events.jsonl` form the structured journal;
`darrow inspect <run-id>` combines that journal with authorized conversation and
artifact content. The journal is the durable product-level record;
OpenTelemetry is an export projection, not the only source of truth.

When standard OTLP environment configuration is present, darrow exports traces,
metrics, and logs through OpenTelemetry. Instrumentation includes the Temporal
SDK interceptor plus product-level spans for workflow compilation, phases and
steps, skill and agent invocation, gates, retries, approvals, workspaces, and
artifacts.

A multi-day run is not represented as one open span. Short activity and phase
traces are correlated with stable `darrow.run.id`, Temporal workflow/run IDs,
and span links. Relevant attributes include workflow version and digest, step ID
and type, requested and resolved skill contracts, plugin version and digest,
harness and model, permission profile, usage, gate result, and artifact hashes.
When an escalation opens, the active step span ends with
`darrow.state=waiting_for_human`. Resolution starts a linked resume trace rather
than extending a span across the human wait. Escalation type, wait duration, and
resolution choice are observable; questions, answers, and referenced content are
not telemetry attributes.

Metrics use low-cardinality dimensions. Run, ticket, repository, branch, and
artifact IDs belong in traces or logs, not metric labels. Telemetry records
metadata, hashes, and URIs by default; content capture is explicit, scoped, and
redacted. Even when content capture is enabled, known secrets are never eligible
for export.

## 9. Product features

### F1 — Delivery workflows

Delivery workflows are versioned workflow packs, never hardcoded CLI behavior.
Their steps, order, and depth are intentionally unsettled and evidence-driven. A
workflow may combine concerns into one agent invocation, skip work that is not
useful for the task, fan out independent checks, or enter a bounded rework loop.
Required outcomes and quality gates matter more than preserving a named phase
sequence. Candidate workflows are compared using the same eval infrastructure.

### F2 — Skill evals

Every plugin skill has an eval suite, and CI gates changes on passing evals. The
runner remains thin and custom (Bun/TypeScript), with harness adapters for Claude
headless and Codex exec (Pi later). Cases are declarative fixtures with outcome
assertions against git state, files, and capability-spec invariants; an LLM judge
is used only for qualitative checks.

Requirements:

- **Multi-metric:** accuracy, wall time, token count, and selectable optimization
  target.
- **Model-pinned:** case × harness × model matrices, with results keyed to exact
  versions.
- **Statistically relevant:** multiple trials, pass-rate thresholds, and mean/p95
  time and token reporting.
- **Comparison mode:** baseline versus candidate with per-metric deltas.
- **Budget guard:** per-suite cost caps, sampling mode for iteration, and full CI
  mode.

### F3 — Git utility skills

`create-branch`, `create-commit`, and `create-pr` are intent-triggered skills that
consolidate git workflow across delivery workflows and ad-hoc use.

### F4 — Improved ideation

Rework ideation using obra-superpowers brainstorm and related skills as
reference material.

### F5 — Rules, ADRs, and ticket facade

Glob-routed rules and ADR templates can be supplied by plugins or workflow packs
and instantiated in target projects. Ticket operations are a separate,
backend-neutral capability: the `create-ticket`, `list-tickets`, and
`update-ticket` skills call the plugin-local `ticket` CLI, whose current backend
is GitHub Issues via `gh`. `create-ticket` writes only through the configured
tracker backend; it does not assume an implicit in-repo ticket store. Additional
tracker backends belong behind the CLI contract and do not change the skills or
workflow definitions.

### F5a — Issue workspaces

When a workflow needs repository-resident issue artifacts, it writes independent
outputs rather than repeatedly rewriting a ticket description or one growing
document:

```text
.darrow/issues/<issue-id>/
  artifacts/
    <step-id>/
      <artifact>
```

The workflow declares artifact types and dependencies. Each step reads only what
it needs, and workflows that do not need repository-resident artifacts do not
create this directory.

### F6 — Custom marketplace

The repository hosts darrow's canonical, directly authored plugins under
`plugins/`. Each plugin contains both `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json`. The root `.claude-plugin/marketplace.json` is a thin
index consumed by both runtimes and points directly to those directories. A
separate `marketplace/` directory is neither required nor part of the source
layout.

### F7 — Generic workflow CLI and skill entrypoint

The same workflow can be started, resumed, cancelled, and inspected from the CLI
or triggered by an installed skill. The CLI can resolve and invoke plugin skills
by canonical name without owning or installing them. It also exposes
`escalations list`, `escalation show`, and `escalation resolve` operations with
structured output for UI and automation clients. Its versioned, JSON-formatted
help allows an agent to discover these operations and their contracts without an
MCP dependency.

### F8 — Mixed-runtime execution profiles

Profiles can bind each workflow role independently, including planner,
implementer, reviewer, and workhorse roles on different providers and harnesses.
Capabilities and permissions declared by a role are upper bounds: a profile may
grant less, never more.

### F9 — Durable execution and OpenTelemetry

Runs survive process restarts and approvals, retain immutable dependency and
artifact provenance, and export backend-neutral OpenTelemetry without requiring
skills to implement tracing. The UI can show live and retained conversations
from the separate content store without embedding those conversations in
Temporal history or telemetry.

### F10 — Human escalation and durable resume

The UI presents an escalation inbox containing the reason, question, relevant
artifacts, allowed decisions and their consequences, required responder role,
and timeout policy. Users can provide a structured choice and, when allowed,
free-form direction. Optional email, chat, or webhook integrations may notify or
link to an escalation, but authenticated resolution always enters through the
Darrow control plane.

Planning can request extra input without failing the run. Bounded review and
rework can escalate when they do not converge. Once the decision is accepted,
Darrow resumes the declared continuation from the durable checkpoint rather than
restarting the workflow.

## 10. Research spikes

Outcomes become ADRs.

- **R1 — Plan-prompt learning:** inspect native planning behavior and harvest
  techniques that improve portable planning contracts without coupling darrow
  to a private prompt or fixed planning phase.
- **R2 — Native review versus custom lenses:** compare native review features
  with explicit review skills and deterministic checks; adopt, blend, or keep
  based on measured results.
- **R3 — Workflow fit for frontier models:** the declarative engine is the
  product direction; useful delivery graphs remain empirical. Compare shorter
  outcome-gated workflows with more staged variants, dynamic depth, and
  verification-heavy/process-light approaches on quality, token cost, and wall
  time. Promote successful structures into workflow packs without making one
  universal sequence mandatory.
- **R4 — Temporal backend proof:** validate replay safety, activity idempotency,
  local auto-start, worker recovery, escalation Updates and Queries, long human
  waits, content-reference privacy, history growth, and self-hosted versus cloud
  parity before treating the backend as production ready.
- **R5 — Cross-runtime contract proof:** execute one locked workflow with Claude
  and Codex assigned to different roles, including plugin upgrades between new
  runs and deterministic resume of an existing run.

## 11. Security and policy

- Workflow roles declare required capabilities; execution profiles and deployment
  policy may only reduce them.
- Preflight policy can allowlist plugin publishers, skill contracts, digests,
  models, network destinations, secrets, tools, and workspace permissions.
- Secrets are injected at the activity boundary and are never serialized into
  workflow plans, histories, journals, content stores, or telemetry.
- Hosted conversation content is encrypted and tenant-isolated, with deployment
  policy controlling access, retention, deletion, and whether transcripts are
  retained at all.
- Hosted workers isolate repositories and activities; local workers make the
  selected permission profile visible before execution.
- Each escalation kind declares who may resolve it. The control plane
  authenticates the actor, enforces role and repository policy, and audits the
  decision without placing free-form response content in Temporal or telemetry.
- Human approval is required when a generated plan, requested capability, policy
  exception, or external side effect exceeds configured policy. A resolution
  cannot grant more authority than the responder is allowed to delegate.

## 12. Non-goals

- Making probabilistic model output byte-for-byte deterministic.
- Using Claude-, Codex-, provider-, or Temporal-specific formats as the canonical
  workflow language.
- Letting skills install the darrow CLI, deploy infrastructure, update plugins,
  or mutate active-run dependencies.
- Turning workflow YAML into a general-purpose programming language.
- Storing large model payloads, source trees, diffs, or logs in Temporal history
  or OpenTelemetry by default.
- Building a domain application inside darrow.
- Curating third-party marketplace plugins at launch.
- Shipping a Pi adapter at launch.
- Maintaining separate generated or hand-authored plugin trees for each runtime.
- Introducing a second canonical marketplace or release-artifact source tree.

## 13. Milestones

- **M0 — Plugin infrastructure, git plugin, and eval loop:** marketplace
  scaffold; `darrow-git`; capability specs; deterministic tests; full skill eval
  suites; darrow dogfooding through its marketplace.
- **M1 — Workflow contracts and local CLI:** establish the global runtime under
  `/cli`; implement the workflow schema, compiler, `ResolvedPlan`, skill catalog,
  semantic-version resolver, lock format, local run journal, machine-readable
  help contract, `run`/`inspect`, and a minimal entrypoint skill. Prove that
  plugins and CLI upgrade independently.
- **M2 — Durable local execution:** Temporal development backend hidden behind
  the CLI, generic plan interpreter, retries and resume, typed escalations,
  validated Update/Query handlers, CLI and UI escalation operations, artifact
  checkpoints, isolated worktrees, and OpenTelemetry export.
- **M3 — Mixed-runtime delivery workflows:** package the best-performing
  candidate workflows as YAML, add Claude and Codex harness adapters and
  execution profiles, issue-workspace and ticket-facade integration where a
  workflow needs them, and cross-runtime eval coverage.
- **M4 — Hosted operation and packaging:** publish plugins directly from their
  canonical directories, publish workflow packs, ship a hosted worker image, and
  prove parity between local, self-hosted, and managed Temporal deployments.

Research spikes run alongside the milestones where they de-risk the next
contract.

## 14. Open decisions

- Global darrow CLI implementation and packaging language; ADR-0002 remains
  scoped to plugin-local bash CLIs.
- Exact workflow schema, expression language, artifact schema registry, and
  backward-compatibility policy.
- Minimal execution-backend interface and whether a non-Temporal lightweight
  backend is useful for tests or constrained local environments.
- Plugin contract metadata location, publisher identity, signing, digest, and
  trust policy.
- Local snapshot/cache retention, garbage collection, and remote artifact-store
  implementation.
- Default delivery graph and model-triage policy after R3.
- Eval gating and marketplace/workflow-pack release integration.
- Approval policy for model-generated candidate workflows and subworkflow
  selection.
- Escalation schema, responder-role model, notification integrations, default
  retention, and which timeout policies are permitted in unattended runs.
