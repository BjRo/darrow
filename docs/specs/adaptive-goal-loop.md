# Capability: Adaptive Goal Loop

Darrow should provide a small, explicitly invoked adaptive goal-loop capability
that turns a bounded engineering request into a verified local working tree. It
should delegate judgment and implementation to current harnesses and models,
while adding only the mechanics needed for isolation, routing, verification,
safety, and observability.

Plugin: `darrow-goal-loop`  
Skills: `pursue-goal`, `check-goal-readiness`

## Why

An earlier orchestration design used long phase playbooks, persona fan-outs, durable
ledgers, and repeated re-description of the same task. Those mechanisms made
the process visible, but consumed substantial tokens and wall-clock time
without a proportional improvement in outcomes.

Current harnesses already provide capable coding agents, subagents, tool use,
model selection, effort controls, and goal-like loops. Darrow should compose
those primitives instead of recreating a workflow engine. The retained value
is a short path with explicit completion evidence:

```text
intent -> [planner] -> executor -> verifier -> [one repair -> verifier] -> report
```

Planning is conditional. Bracketed steps do not run unless the task requires
them. A human checkpoint is likewise conditional on risk, ambiguity, or new
authority. This keeps ordinary work cheap while preserving independent
assurance where it matters.

The loop stays light by owning little orchestration machinery, not by removing
human judgment. Unattended execution is earned task by task through clear
criteria and strong verification; the plugin does not presume that a repository
or team is permanently ready for fully dark operation.

## Selected design

The v1 design is a **native goal loop**: a non-writing controller delegates
to a small number of fresh child agents and uses the host harness as the
runtime.

This choice sits between two alternatives:

1. A single goal worker is cheaper, but its self-verification is not
   independent and makes silent mistakes harder to catch.
2. A headless supervisor can maximize unattended throughput, but reintroduces
   queues, state machines, retry policy, and lifecycle machinery before their
   value has been demonstrated.
3. The native goal loop adds one independent assurance boundary and an
   optional planning boundary without owning a general orchestration runtime.

The third option is normative for v1. The other options remain useful baselines
for evaluation, not alternate runtime modes that the plugin must maintain.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` describe capability requirements.
Implementation details and model identifiers can change without changing the
capability when these requirements still hold.

## Shared model

### Roles

- **Controller** — the host agent that creates the task packet, chooses the
  route, enforces boundaries, and reports the result. It may maintain transient
  run metadata but does not edit product files.
- **Planner** — an optional, fresh, read-only child that resolves meaningful
  ambiguity and proposes an implementation and verification plan.
- **Executor** — the sole write-capable child. It implements the task and works
  a bounded goal loop until its declared checks pass or it reaches a stopping
  condition.
- **Verifier** — a fresh child that did not author the change. It checks both
  the requested behavior and repository standards. It is read-only with
  respect to product files, though verification commands may create normal
  ignored build or test artifacts.
- **Repair executor** — an optional fresh write-capable child given the failed
  verification evidence. It replaces, rather than overlaps, the first
  executor.

An agent is **fresh** when it receives a bounded task packet and repository
access, but not the parent conversation transcript or another worker's hidden
reasoning.

### Task packet

Every child invocation receives a self-contained task packet with:

- a stable run identifier;
- objective and observable acceptance criteria;
- scope and explicit non-goals;
- relevant repository instructions and decisions, referenced by unambiguous
  paths rather than copied wholesale;
- the approved plan, when one exists;
- base revision and known pre-existing working-tree changes;
- allowed mutation and publication boundaries;
- required and discovered verification gates;
- time, token, repair, and stopping budgets;
- the required structured result shape.

The packet is a boundary, not a growing workflow diary. It MUST NOT contain a
full conversation transcript, prior workers' chain of thought, or broad
repository content that the child can inspect directly.

### Run outcome

A run ends in exactly one of these states:

- `verified` — acceptance criteria and all applicable checks passed under the
  verification contract;
- `needs_human` — a decision, approval, or authority boundary prevents safe
  continuation;
- `blocked` — the environment or repository prevents required work or proof;
- `failed` — implementation or verification failed within the bounded repair
  policy;
- `budget_exhausted` — an explicit time, token, or invocation limit was
  reached.

The controller MUST distinguish code correctness from telemetry health. A run
may report verified code with degraded telemetry, but it cannot silently report
telemetry as healthy.

## `pursue-goal`

### Intent

Pursue a bounded engineering goal with the least orchestration needed to return
a verified local change. This skill is user-invoked because it can create
several model calls, consume a meaningful budget, and edit the working tree.

### Contract

Input:

- a concrete objective;
- acceptance criteria, or enough context for the controller to make them
  explicit without changing product intent;
- optional route, budget, supervision, and telemetry overrides.

Output:

- final run outcome and concise summary;
- files changed and remaining working-tree risks;
- route used for every role, including provider, model, and effort;
- every applicable verification command and result;
- independent-verification findings and repair result, if any;
- telemetry export status and the stable run identifier;
- the smallest next decision when the run did not finish as `verified`.

The default publication boundary is the local working tree. Verification does
not authorize commit, push, pull-request creation, merge, deployment, or any
other external mutation.

### Control flow invariants

1. **AGL-A1 — Thin controller.** The controller MUST NOT implement the requested
   product change. It may inspect the repository, invoke deterministic
   preflight mechanics, manage child invocations, and assemble the result.
2. **AGL-A2 — One writer.** At most one write-capable child may be active at a
   time. Planner and verifier roles MUST NOT edit product files.
3. **AGL-A3 — No workflow runtime.** Run state is transient task packet and
   result data. The plugin MUST NOT require a daemon, queue, issue mirror,
   workflow database, phase ledger, or general-purpose state machine.
4. **AGL-A4 — Short normal path.** A straightforward substantive task SHOULD
   use two child contexts: executor and verifier. A planned task SHOULD use
   three. Repair MAY add one repair executor and one re-verifier.
5. **AGL-A5 — Bounded recovery.** The controller permits at most one repair
   cycle by default. A second failed verification ends as `failed` or
   `needs_human`; it MUST NOT create an unbounded self-healing loop.
6. **AGL-A6 — Preserve local work.** Pre-existing changes MUST be identified in
   the packet, treated as user-owned, and never reverted or overwritten merely
   to obtain a clean result.

### Planning invariants

1. **AGL-P1 — Conditional planning.** The controller MUST skip a dedicated
   planner when objective, scope, and verification are already clear.
2. **AGL-P2 — No router call.** Route selection MUST be a deterministic local
   policy applied by the controller. It MUST NOT consume a separate model call
   solely to decide which model to call.
3. **AGL-P3 — Planning triggers.** A planner SHOULD be used when the task spans
   architectural boundaries, changes a public contract or schema, has material
   product ambiguity, or needs a non-obvious test strategy.
4. **AGL-P4 — Read-only plan.** The planner returns decisions, assumptions,
   file-level intent, risks, and verification strategy. It MUST NOT edit the
   working tree or expand the requested product scope.
5. **AGL-P5 — Human plan gate.** Before writing, the controller MUST request
   human approval when the plan includes irreversible operations, destructive
   migration, security or privacy policy, external publication, materially
   ambiguous product behavior, or authority not present in the original
   request. An already approved spec or plan can satisfy this gate.

### Model and effort routing invariants

1. **AGL-R1 — Spawn-time routing.** Each child invocation pins or deliberately
   inherits its provider, model, and effort. The chosen route is recorded in
   the result and telemetry.
2. **AGL-R2 — Semantic profiles.** Routing policy is expressed as replaceable
   semantic profiles such as `fast`, `standard`, and `deep`, mapped to current
   model identifiers in one place. Capability instructions MUST NOT depend on
   a model name remaining current.
3. **AGL-R3 — Codex preference.** When both harnesses can satisfy the task,
   execution and verification default to Codex. Planning MAY use a different
   vendor or harness, such as a configured Fable planner, when configured or
   explicitly requested.
4. **AGL-R4 — Proportional effort.** Bounded mechanical work uses the cheapest
   profile that meets its oracle. Normal implementation uses `standard`.
   Architectural planning, ambiguous debugging, sensitive changes, and
   independent verification of risky work use `deep`.
5. **AGL-R5 — User authority.** An explicit user route overrides automatic
   routing. If a user-pinned route is unavailable, the controller stops rather
   than silently substituting another provider or effort. A policy-selected
   route MAY use a declared fallback and MUST report the substitution.
6. **AGL-R6 — Measured defaults.** Default mappings are changed through eval
   evidence for quality, token use, cost, and latency, not through additional
   prompt prose or permanent per-model playbooks.

### Execution goal invariants

1. **AGL-G1 — Portable goal contract.** The executor receives a goal consisting
   of objective, acceptance criteria, applicable checks, scope boundaries, and
   stopping budget. The host's native goal primitive SHOULD be used when
   available; otherwise the same semantics live in the child prompt and
   structured result.
2. **AGL-G2 — Agent autonomy.** The executor chooses its own implementation
   sequence and tool use within the packet. The plugin MUST NOT prescribe a
   long universal development playbook.
3. **AGL-G3 — Mechanical completion.** Before claiming completion, the executor
   runs every applicable lint, typecheck, and test gate discovered for the
   changed scope, plus task-specific acceptance checks.
4. **AGL-G4 — Applicability evidence.** A gate is applicable when repository
   instructions, manifests, CI configuration, or established component
   practice exposes it for the changed scope. Missing gates are recorded as
   `not_applicable` with discovery evidence; they are never silently treated as
   passing.
5. **AGL-G5 — Honest blockage.** A configured applicable gate that cannot run
   because of the environment is `blocked`, not `passed`. Pre-existing failures
   are reported with evidence and distinguished from regressions when that can
   be established.
6. **AGL-G6 — Final-tree evidence.** Completion evidence MUST describe the
   final working tree, not an earlier intermediate state. Changed tests alone
   do not prove the requested behavior unless they are run and pass.
7. **AGL-G7 — Intent-only disciplines.** The executor packet MAY ask for an
   implementation discipline when it materially helps the task, for example,
   “implement the changes via test-driven development.” This is worker intent,
   not a goal-loop phase. The goal loop MUST NOT discover, invoke, require, or
   coordinate a separately installed discipline plugin.

### Independent verification invariants

1. **AGL-V1 — Fresh verifier.** Source code, configuration, dependency, schema,
   build, test, or observable-behavior changes require a fresh independent
   verifier after execution.
2. **AGL-V2 — Narrow fast-path exception.** Independent verification MAY be
   omitted only for a prose-only, formatting-only, or generated mechanical
   transformation whose acceptance criteria are completely covered by a
   deterministic oracle. The controller records the exception and evidence;
   uncertainty selects the verifier path.
3. **AGL-V3 — Two-axis review.** The verifier checks both specification
   fulfillment and repository correctness. It MUST inspect the final diff and
   run or validate the applicable deterministic gates rather than accepting the
   executor's success claim. One verifier applies both lenses; v1 does not fan
   them out into permanent persona agents.
4. **AGL-V4 — Tools before taste.** Lint, formatting, type, and test questions
   that tools can settle are settled by tools. Model judgment focuses on
   behavior, missing cases, unsafe assumptions, and design fit.
5. **AGL-V5 — Structured findings.** A failing finding identifies severity,
   location or command, violated criterion, and concrete evidence. Preferences
   without a stated repository or task requirement do not fail a run.
6. **AGL-V6 — Repair packet.** A repair executor receives the original packet,
   final diff, and structured verification findings, but not the verifier's
   hidden reasoning or the full prior transcript.
7. **AGL-V7 — Re-verification.** Any repair invalidates the previous verdict
   and requires a fresh verifier invocation before `verified` can be reported.

### Supervision and safety invariants

1. **AGL-S1 — AFK-first bounded work.** Low- and medium-risk tasks default to
   uninterrupted execution through the selected path. The controller does not
   ask for confirmation at routine phase boundaries.
2. **AGL-S2 — Meaningful interruptions only.** The controller interrupts for a
   missing product decision, a high-risk gate, new external authority, an
   unavailable user-pinned route, or a stopping budget. It reports the evidence
   and smallest decision needed.
3. **AGL-S3 — Permission preservation.** Child agents inherit no greater
   permission than the host run and task packet. A planner's suggestion or a
   verifier's approval cannot expand authority.
4. **AGL-S4 — Sensitive defaults.** Destructive data changes, authentication or
   authorization changes, secret handling, privacy boundaries, billing, broad
   migrations, and weakly verifiable external effects are not automatically
   AFK-eligible without an approved plan.
5. **AGL-S5 — No implied publication.** `verified` means verified in the local
   scope only. It never implies that a change was committed, pushed, reviewed
   by a human, merged, released, or deployed.

### Cross-harness invariants

1. **AGL-X1 — Same semantics.** `pursue-goal` exposes the same roles, packet,
   stopping rules, and result states on Claude Code and Codex even when their
   native tool names differ.
2. **AGL-X2 — Native first.** A role uses a native fresh subagent when the host
   can supply the requested model and effort. The plugin MUST NOT introduce a
   process boundary merely for symmetry.
3. **AGL-X3 — Explicit foreign bridge.** A cross-vendor role runs through one
   small adapter around the installed foreign harness or its supported
   app-server interface, following the
   [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc)
   integration shape. It reuses that harness's authentication and configuration
   rather than implementing a second provider SDK.
4. **AGL-X4 — Packet isolation.** The foreign process receives the task packet
   through a bounded, injection-safe mechanism and returns a structured result.
   Ambient parent conversation and secrets MUST NOT be copied into its prompt
   or telemetry.
5. **AGL-X5 — Honest identity.** A foreign child may be treated as a logical
   subagent by the workflow, but user-facing output MUST NOT claim it was a
   native subagent of the host harness.
6. **AGL-X6 — Graceful capability loss.** Missing foreign tooling disables only
   routes that require it. A same-harness run remains available when its own
   requirements pass.

## Observability

Every run has one stable run identifier shared by packets, results, and
telemetry. The plugin emits OpenTelemetry-compatible traces and cost-relevant
usage so an OTLP backend such as Langfuse can correlate the complete run.

### Telemetry invariants

1. **AGL-O1 — Trace shape.** Telemetry represents the controller and each
   planner, executor, verifier, repair, deterministic gate, and human-wait
   boundary as correlated spans or events.
2. **AGL-O2 — Required attributes.** Each model invocation records role,
   harness, provider, model, effort, outcome, duration, and available input,
   output, reasoning, and cached-token usage. Run-level telemetry records repair
   count, verification outcome, supervision interruptions, and final state.
3. **AGL-O3 — Honest cost.** Actual provider cost is recorded when supplied.
   Derived cost MUST be labeled as estimated and identify the versioned pricing
   source. Unknown cost remains unknown; it is never represented as zero.
4. **AGL-O4 — Content privacy.** Prompt bodies, source code, tool output,
   environment values, and secrets are excluded by default. Content capture is
   explicit opt-in and follows host redaction settings.
5. **AGL-O5 — Exporter neutrality.** The plugin emits OTLP-compatible data and
   MUST NOT require Langfuse or any single collector. Provisioning and operating
   a telemetry backend are outside this capability.
6. **AGL-O6 — Observable degradation.** Export failures are visible in the run
   result. Best-effort telemetry failure does not change a code verdict; a
   user-selected strict telemetry mode blocks the run before paid child work
   when preflight cannot establish export readiness.
7. **AGL-O7 — No duplicate accounting.** When native harness telemetry and
   adapter telemetry cover the same model call, correlation metadata MUST allow
   the backend or collector to identify the duplicate. The plugin MUST NOT sum
   both as independent usage.

## `check-goal-readiness`

### Intent

Explain which goal-loop paths are ready before the user spends model budget.
This is an explicit, read-only diagnostic capability.

### Contract

The readiness reports:

- host harness and native child-agent support;
- configured semantic model profiles and fallbacks;
- availability of each requested foreign-harness adapter;
- whether provider/model/effort selection can be expressed for each role;
- OpenTelemetry configuration and exporter reachability when it can be checked
  without exposing credentials;
- supported and degraded run paths;
- exact remediation for failed preconditions.

### Invariants

1. **AGL-D1 — No paid probe by default.** The readiness MUST NOT invoke a paid
   model merely to test configuration unless the user explicitly requests a
   live probe.
2. **AGL-D2 — No silent setup mutation.** The readiness MUST NOT install harnesses,
   authenticate providers, or modify user-global telemetry configuration
   without a separate explicit request.
3. **AGL-D3 — Secret-safe output.** The readiness may report whether credentials
   are available but MUST NOT print their values.
4. **AGL-D4 — Actionable degradation.** A failed optional integration is
   reported as the specific route it disables, not as failure of the entire
   plugin.

## Result record

The exact serialization is an implementation detail, but every run result MUST
be machine-readable and contain at least:

```text
run_id
status
objective
base_revision
pre_existing_changes
changed_files
routes[]                 # role, harness, provider, model, effort, fallback
gates[]                  # name, command, applicability, status, evidence
verification             # required, verdict, findings, repair_count
permissions              # write and publication boundary
budgets                   # configured and consumed when available
telemetry                 # mode, correlation ids, export status
risks
next_action
```

The result record is evidence for the current run, not a durable phase ledger.
The plugin MUST NOT write it into the target repository unless the user asks
for an artifact there.

## Packaging and portability

1. **AGL-K1 — Independent plugin.** `darrow-goal-loop` is independently
   installable and MUST NOT reference files from sibling plugins or assume they
   are installed.
2. **AGL-K2 — Marketplace format.** The plugin includes both
   `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`; the Codex
   manifest points at `./skills/`.
3. **AGL-K3 — Explicit invocation.** Model-initiated implicit invocation is
   disabled for both goal-loop skills. Ordinary agent work MUST NOT unexpectedly
   fan out into a paid goal-loop run.
4. **AGL-K4 — Mechanics in scripts.** Deterministic packet validation,
   preflight, bridge, gate execution, result validation, and telemetry checks
   belong in bundled scripts. Routing and engineering judgment remain concise
   skill instructions.
5. **AGL-K5 — Portable scripts.** Bundled shell mechanics follow Darrow's Bash
   3.2 and Bash 5 portability requirements and emit absolute model-facing paths
   where paths are needed.
6. **AGL-K6 — Minimal surface.** V1 packages no custom agent catalogue or
   persona library. Roles are created dynamically from the task packet so that
   harness improvements remain available without copying their behavior into
   Darrow.

## Evaluation requirements

The capability is not successful merely because the happy path runs. Its evals
must test the claimed quality-to-cost tradeoff against both a direct strong
agent and the two alternative designs described above.

1. **AGL-E1 — Representative tasks.** The corpus includes straightforward
   mechanical work, a normal code change, an ambiguous cross-cutting change, a
   seeded defect for the verifier, a high-risk human gate, a failed applicable
   check, and a cross-vendor planning run.
2. **AGL-E2 — Cross-harness coverage.** Contract behavior is evaluated from
   fresh contexts on Codex and Claude Code. Foreign adapters are evaluated
   separately from native child paths.
3. **AGL-E3 — Outcome metrics.** Evaluation records task success, escaped
   defects, false-positive verifier findings, total tokens, estimated or actual
   cost, wall-clock time, child invocation count, human interruptions, and
   human review minutes.
4. **AGL-E4 — Structural budgets.** Tests fail when the normal path adds an
   undeclared planner, router model call, concurrent writer, second repair
   cycle, or hidden publication action.
5. **AGL-E5 — Telemetry reconciliation.** Eval fixtures prove that every child
   is correlated to one run, required attributes survive export, secrets are
   absent by default, and duplicate native/adapter accounting is detectable.
6. **AGL-E6 — Adversarial review.** A fresh-context reviewer tries to induce
   scope expansion, unnecessary planning, skipped gates, false `verified`
   status, silent model fallback, secret capture, and unauthorized publication.
7. **AGL-E7 — Evidence-based tuning.** A route or workflow step remains in the
   default path only when measured defect reduction justifies its incremental
   token and latency cost. No fixed AFK percentage or cost claim is made until
   the evaluation corpus measures it.

## Non-goals

- Building a general workflow engine, persistent task manager, autonomous
  backlog worker, or multi-repository scheduler.
- Recreating model reasoning in prescriptive phase playbooks, personas, or a
  large catalogue of permanent agents.
- Running several implementation agents in parallel against one working tree.
- Automatically creating worktrees, commits, branches, pull requests, merges,
  releases, or deployments.
- Provisioning Langfuse, an OpenTelemetry collector, provider accounts, or
  foreign harness credentials.
- Guaranteeing that every provider is callable from every host without its
  supported harness or bridge being installed.
- Treating lint, typecheck, or tests as substitutes for independent semantic
  verification on substantive changes.
- Continuing indefinitely until green, or converting a blocked verification
  environment into a false success.
- Depending on any other Darrow plugin to complete a goal-loop run.
