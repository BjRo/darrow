# Specification: Workflow Runtime

Defines the portable workflow semantics implemented by the Darrow compiler,
execution backend, CLI, command skills, and harness adapters.

Read [compatibility](compatibility.md) for version resolution and skill metadata,
[workspaces and artifacts](workspaces-artifacts.md) for repository state, and
[observability](observability.md) for journals and harness event capture.

## Terminology

- **Command skill** — an operation the orchestrator invokes by canonical name.
- **Capability skill** — an optional provider the harness loads from intent.
- **Built-in** — a typed operation owned by the Darrow runtime.
- **Step** — one node in the static workflow graph.
- **Attempt** — one immutable execution of a step.
- **Execution path** — one sequential path through the workflow graph. This is
  not a Git branch.
- **Run state** — current lifecycle position, independent from terminal outcome.
- **Run conclusion** — terminal outcome after state becomes `completed`.
- **Waiver** — explicit acceptance of a declared quality or outcome failure.

## Workflow definition

The versioned workflow JSON Schema is authoritative for YAML field names. The
schema must express the semantics below and ship in the repository with the CLI;
examples are illustrative rather than an alternate schema.

- **WR-1 — Static graph.** The compiler resolves a finite graph before execution.
  Runtime-generated steps, command names, workflow YAML, and graph rewriting are
  invalid.
- **WR-2 — Acyclic outside bounded loops.** The static graph is acyclic.
  Repetition exists only inside an explicitly declared loop region with a finite
  attempt bound and declared exhaustion behavior.
- **WR-3 — Typed boundaries.** Workflow inputs, step inputs and outputs, built-in
  arguments, artifacts, human responses, and workflow outputs have versioned
  schemas. Producers and consumers validate their side of each boundary.
- **WR-4 — Deterministic conditions.** Conditions may inspect workflow inputs,
  step state, typed outputs, artifact metadata, and capability availability.
  Supported operations are boolean composition, comparisons, membership, and
  explicit presence checks. Conditions cannot perform I/O, access the process
  environment, invoke tools, execute arbitrary code, or define functions.
- **WR-5 — Skipped output safety.** A skipped step has state `skipped` and
  produces no output. The compiler rejects a required input whose only source is
  a possibly skipped step unless a fallback is declared or the input is optional.
  Missing optional values are explicit and never represented by invented
  placeholders.
- **WR-6 — Allowlisted subworkflows.** A workflow may select among statically
  declared subworkflows. Models cannot introduce another subworkflow or mutate
  the selected graph.
- **WR-6a — Explicit step dependencies.** Every step declares `dependsOn` as a
  list of step IDs. An empty list identifies a root step. Step IDs are unique,
  dependencies must exist, self-dependencies are invalid, and the compiler
  rejects every cycle before execution.
- **WR-6b — Deterministic ready-set scheduling.** The backend may start every
  pending step whose declared dependencies succeeded. The compiler emits a
  stable topological plan using workflow order as the tie-breaker. Ready steps
  are selected in immutable plan order, may execute concurrently, and their
  recorded results remain in plan order regardless of completion order. A failed
  step blocks its transitive dependents without preventing an independent ready
  path from completing.
- **WR-6c — Shared workspace ordering.** Parallel paths in one run use that
  run's dedicated workspace. Workflow authors declare a dependency between
  steps whose workspace effects must be ordered; parallel paths do not imply
  additional Git worktrees or filesystem isolation.

## Commands, capabilities, and built-ins

- **WR-7 — Explicit command invocation.** A command step references the canonical
  `<plugin-name>:<skill-name>` ID and a compatible command-contract range. The
  orchestrator invokes that command by name through the selected harness adapter.
- **WR-8 — Intent-based capability use.** Command instructions express domain
  intent in ordinary language and never name a capability provider. The
  surrounding harness resolves and loads configured capabilities by intent.
- **WR-9 — Hard capability preflight.** A workflow or command may declare a hard
  portable capability requirement such as `tickets.create@^1`. Darrow verifies
  compatible enabled providers in every eligible harness before creating a
  worktree or performing an external side effect. Missing, incompatible,
  ambiguous, or unverifiable requirements stop with an actionable error.
  Optional capabilities do not require preflight.
- **WR-10 — Provider disambiguation.** When several providers satisfy one hard
  capability contract, environment configuration must select the eligible
  provider set unambiguously. Darrow records the resolved capability environment
  but still relies on native intent routing during execution.
- **WR-11 — Closed built-in registry.** Workflow YAML invokes built-ins by a
  stable name, compatible version, and typed arguments. The registry is closed
  for a given engine release and extensible through later compatible releases.
  Resolved built-in versions are locked.
- **WR-12 — Built-in boundary.** Pure built-ins may inspect or transform workflow
  data. Side-effecting built-ins run as durable activities. Built-ins implement
  orchestration mechanics, never Git, ticket, or another replaceable domain
  capability. YAML cannot invoke arbitrary shell, JavaScript, or host functions.

## Compilation and immutable plan

- **WR-13 — Complete compilation.** Compilation validates the workflow schema,
  expression types, graph bounds, command contracts, hard capabilities, artifact
  flow, execution profile, version compatibility, and resolved content digests.
- **WR-14 — Preflight precedes mutation.** Hard requirement failure occurs before
  worktree allocation, agent invocation, ticket mutation, or another externally
  visible effect.
- **WR-15 — Immutable plan.** The execution backend receives an immutable
  `ResolvedPlan`, never a path to mutable YAML. It includes the resolved graph,
  workflow and schema versions, step contracts, built-ins, capability
  environment, profile, model policy, retry rules, loop bounds, artifact schemas,
  and content digests.
- **WR-16 — Immutable original intent.** Human continuation, approved model
  substitution, and other allowed changes create append-only run amendments.
  They do not rewrite the original plan.
- **WR-17 — Snapshot before execution.** Exact workflow, skill, script, and schema
  inputs are copied into the repository-local run snapshot before the backend
  starts. See [compatibility](compatibility.md#run-lock-and-snapshot).

## State and conclusion

- **WR-18 — Separate lifecycle and outcome.** A run has one lifecycle state and,
  only after completion, one conclusion.

| State               | Meaning                                             |
| ------------------- | --------------------------------------------------- |
| `running`           | Darrow may schedule or execute work.                |
| `waiting_for_input` | Durable state requires explicit human continuation. |
| `completed`         | No more workflow work will be scheduled.            |

| Conclusion               | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `succeeded`              | All required outcomes completed without a waiver.                           |
| `succeeded_with_waivers` | Required outcomes completed and at least one declared failure was accepted. |
| `failed`                 | The workflow could not satisfy its required outcomes.                       |
| `cancelled`              | An explicit cancellation stopped the run.                                   |

- **WR-19 — Skipped is a step state.** `skipped` describes a step that a static
  condition did not select. It is distinct from an unavailable optional
  capability and from a failed command.

## Waiting and continuation

- **WR-20 — Waiting is not failure.** When human input is needed, Darrow persists
  `waiting_for_input` and the CLI exits successfully. Nonzero exit statuses are
  reserved for actual command, configuration, preflight, infrastructure, or run
  failures.
- **WR-21 — Complete handoff.** Text output contains the run and step IDs, reason,
  question, allowed continuations and consequences, referenced context, and a
  final line in this exact form:

  ```text
  Continue: darrow continue <run-id>
  ```

  Agent entrypoint skills return the same information to Codex or Claude Code.

- **WR-22 — Machine-readable continuation.** Structured output contains the same
  state and continuation command as fields and contains no extra prose. Free-form
  input is accepted through an interactive prompt, stdin, or structured request;
  it is never interpolated into a generated command line.
- **WR-23 — Turn boundary, not polling.** Returning `waiting_for_input` ends the
  CLI invocation and the current agent turn. No Darrow CLI or agent process polls
  while waiting. A later `darrow continue <run-id>` resumes the run.
  The repository-scoped Temporal service and worker may remain alive without
  the foreground CLI; `darrow resume <run-id>` reconnects after an interrupted
  invocation and reconciles authoritative workflow state.
- **WR-23a — Restart-safe startup reconciliation.** Before attempting to start a
  workflow, Darrow persists its deterministic workflow ID, task queue, immutable
  execution input, and an unconfirmed-start marker. On resume it queries Temporal
  with that identity. If the start is still unconfirmed and no execution exists,
  Darrow may start the exact locked input with the same ID. If a previously
  confirmed execution is missing, Darrow reports recovery failure and never
  reconstructs control state from repository files.
- **WR-24 — No local expiry or role authorization.** Local waiting has no default
  timeout. Any caller able to invoke `darrow continue` may respond. Darrow records
  supplied actor and harness identity as unverified audit metadata. Hosted
  deadlines, notifications, verified identity, and responder roles are deferred.
- **WR-25 — Stale responses rejected.** A response identifies the open request
  and its expected version. Duplicate, malformed, or stale responses cannot
  advance the run.

## Attempts and bounded convergence

- **WR-26 — Immutable attempts.** A rerun creates a new attempt. Prior inputs,
  outputs, artifacts, command envelope, and result remain unchanged and
  inspectable.
- **WR-27 — Supplemental instructions.** A human can authorize another declared
  attempt with extra instructions. The instructions are stored as an immutable
  input artifact and the new attempt receives relevant prior outputs.
- **WR-28 — Finite human authorization.** Each human response authorizes a finite
  number of additional attempts. It never converts a bounded loop into autonomous
  unbounded execution.
- **WR-29 — Declared waiver only.** Only a workflow-declared quality or outcome
  failure can be waived. Corrupt state, a missing required artifact, hard
  capability failure, and infrastructure failure are unwaivable.
- **WR-30 — Waiver provenance.** A waived step records
  `accepted_with_waiver`, the failed outcome, actor metadata, rationale, and any
  next-step instructions. At least one waiver produces run conclusion
  `succeeded_with_waivers`.
- **WR-31 — Scoped forward instructions.** Instructions attached to a waiver are
  passed only to the next declared target step unless the workflow explicitly
  propagates them. They cannot add steps or mutate the plan.

An implementation/review loop therefore exposes, when declared, these human
choices: retry with supplemental instructions, accept the current implementation
despite the review result, or abort.

## Retry and uncertain effects

- **WR-32 — Safe automatic retry.** Read-only and explicitly idempotent
  activities may declare automatic retries. Their retry policy is part of the
  immutable plan.
- **WR-33 — Effectful default.** Agent invocations and externally effectful
  activities default to one automatic attempt. Darrow does not assume that a
  commit, ticket, comment, pull request, or network mutation is universally
  deduplicable.
- **WR-34 — Uncertain outcome pauses.** If an activity may have completed its
  effect but did not report completion, Darrow records the uncertainty and waits
  for human inspection. Declared continuations may retry, accept a valid waiver,
  or abort.
- **WR-35 — Capability-specific deduplication.** A capability may use stable run
  and invocation IDs to implement operation-specific idempotency. That guarantee
  is part of its contract and does not create a universal Darrow receipt system.

## Failure and cancellation

- **WR-36 — Stop and report.** Failure stops newly dependent work and reports
  completed, incomplete, and uncertain effects. It does not roll back completed
  external effects.
- **WR-37 — Explicit compensation only.** A compensating action executes only
  when the static workflow declares it as a step with its own contract and
  artifacts.
- **WR-38 — Safe cancellation boundary.** Cancellation stops scheduling new
  work. An active activity is interrupted only when its checkpoint policy says
  cancellation is safe; otherwise Darrow waits for the activity boundary and
  records the result.
- **WR-39 — Path independence.** Failure or cancellation of one concurrent run
  or execution path does not mutate another unless the static workflow declares
  that dependency.

## Harness adapter contract

- **WR-40 — Common invocation envelope.** Every adapter accepts a stable
  invocation ID, command identity and version, typed input, resolved profile,
  workspace reference, artifact references, and cancellation context.
- **WR-41 — Common result envelope.** Every adapter returns:
  - invocation ID and status;
  - canonical command identity and resolved contract/implementation versions;
  - validated command payload;
  - produced artifact references;
  - transcript or event-stream reference;
  - reported external side effects;
  - usage and timing when exposed;
  - normalized error category and message when unsuccessful; and
  - resumable native session reference when the harness exposes one.
- **WR-42 — Translation, not reinterpretation.** The adapter owns native
  invocation syntax, event streaming, timeout, cancellation, and session resume.
  It does not reinterpret the command's domain result or fabricate missing
  guarantees.
- **WR-43 — Portable resume.** Native session continuation is an optimization.
  A compatible adapter can resume from the locked plan, run snapshot, workspace,
  artifacts, transcript reference, and human response without provider-owned
  conversation state.

## Permissions and backend authority

- **WR-44 — Environment-owned permissions.** Codex, Claude Code, or the hosted
  environment enforces permissions. The profile selects native permission
  configuration. Darrow records it, never broadens it, and normalizes permission
  denials as adapter errors.
- **WR-45 — Temporal authority.** Temporal history is authoritative for active
  workflow control state. `darrow inspect` queries live state and joins it with
  repository-local plan, lock, journal, content, and artifacts.
- **WR-46 — Journal cannot drive execution.** Repository-local audit records are
  append-only product records. Editing or reconstructing them cannot advance an
  active run or substitute for lost Temporal state.
- **WR-47 — No active environment migration.** A local run resumes in its
  repository environment and a hosted run resumes in its deployment workspace.
  Moving an active run between those environments is out of scope.
