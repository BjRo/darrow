# Specification: Observability and Content

Defines the authoritative state sources, repository-local audit journal, harness
event capture, cross-invocation agent handoff, optional OpenTelemetry export, and
privacy boundaries.

Read [workflow runtime](workflow-runtime.md) for control-state transitions and
[workspaces and artifacts](workspaces-artifacts.md) for retention and cleanup.

## State sources

- **OB-1 — Temporal controls active runs.** Temporal history is authoritative for
  active workflow control state. The CLI queries Temporal for live state rather
  than inferring it from files.
- **OB-2 — Repository files explain the run.** `.darrow/runs/<run-id>/` stores the
  immutable plan, lock, snapshot, artifacts, content references, command results,
  and append-only audit journal needed to inspect and explain the run.
- **OB-3 — Journal is not a recovery engine.** Editing, truncating, or recreating
  a local journal cannot advance an active workflow. Loss of Temporal state is a
  recovery or backup problem; Darrow does not guess control state from
  `events.jsonl`.
- **OB-4 — Inspection joins sources.** `darrow inspect <run-id>` joins current
  Temporal state with repository-local plan, lock, journal, artifacts, and
  authorized content. Inspection of a terminal failed or cancelled run is itself
  a successful read operation.

The initial run record is:

```text
.darrow/runs/<run-id>/
  run.json
  events.jsonl
  snapshot/
  content/
  artifacts/
  results/
```

## Audit journal

- **OB-5 — Append-only events.** Darrow appends a structured event for workflow
  compilation, dependency resolution, run and step transitions, attempts,
  command invocations, capability preflight, artifacts, human requests and
  responses, recovery reconciliation, waivers, cancellations, cleanup
  eligibility, and terminal conclusions.
- **OB-5a — Cleanup audit.** Every completed resource deletion appends a
  `cleanup.resource.deleted` event with its resource ID, kind, absolute path,
  measured size, and completion time. A durable `cleanup.json` beside the run
  record stores selection and completion markers so intentional removal remains
  distinguishable from corruption and terminal inspection can explain missing
  bodies.
- **OB-6 — Stable correlation.** Every event carries protocol/schema version,
  timestamp, run ID, and event ID. Step, attempt, invocation, artifact, human
  request, Temporal workflow/run, and native session IDs appear when applicable.
- **OB-7 — References over payload duplication.** Large prompts, responses,
  source, diffs, patches, logs, and test output are stored once in local content
  or artifacts. Journal events contain typed references, hashes, sizes, and safe
  summaries.
- **OB-8 — Immutable prior attempts.** A rerun or waiver adds events and artifacts
  for the new decision and attempt. It never edits the prior attempt's record.
- **OB-9 — Actor honesty.** Local actor, harness, and session identity is recorded
  as supplied and labeled unverified. Hosted verified identity is a later
  authorization concern.
- **OB-9a — Cancellation audit.** A cancellation appends one
  `run.cancel.requested` event before the terminal `run.completed` event. Safe
  interruption of an active harness process also appends
  `command.invocation.cancelled`. The terminal event and run record preserve the
  request time plus completed, incomplete, and uncertain step IDs.

## Harness-owned events

- **OB-10 — Capture what Darrow receives.** Harness adapters persist the command
  input and normalized output, exposed message and reasoning-summary events, tool
  calls and results, file-change events, stdout/stderr, usage, timing, reported
  side effects, errors, and native session references when the harness exposes
  them.
- **OB-11 — Outer conversation boundary.** Darrow does not claim visibility into
  the entire surrounding Codex or Claude Code conversation, user interface, or
  hidden provider state between CLI invocations.
- **OB-12 — Native transcript is optional.** A native session or transcript
  reference improves inspection and resume but is not a portable control-state
  dependency.
- **OB-13 — No hidden reasoning requirement.** Darrow records exposed summaries
  and outcome-relevant rationale. It never requires, reconstructs, or labels
  hidden chain-of-thought as a product artifact.

## AgentHandoff

An agent-mediated invocation may include an `AgentHandoff` describing what
happened after the previous Darrow invocation and before the current one.

- **OB-14 — Self-reported provenance.** The handoff is explicitly labeled as an
  agent-provided summary, not as Darrow-observed fact.
- **OB-15 — Stable fields.** A handoff contains:
  - schema version;
  - previous Darrow invocation ID;
  - concise summary;
  - actions performed;
  - files examined or changed;
  - decisions made;
  - reported external side effects;
  - unresolved questions or risks; and
  - related artifact references.
- **OB-16 — High-level rationale only.** The summary may state assumptions,
  trade-offs, and why a decision was made. It must not request or claim raw hidden
  chain-of-thought.
- **OB-17 — Optional, with visible gaps.** A direct CLI caller may omit a handoff.
  An agent caller may also omit it; Darrow records an observability gap but does
  not block or fail the run.
- **OB-18 — Reference validation.** Darrow validates the handoff schema and
  artifact references. It does not treat a self-reported side effect as a
  deduplication receipt or proof of success.

## Human continuation content

- **OB-19 — Content stored before reference.** Free-form human input and
  supporting material are written to the repository-local content store before
  a bounded reference and hash enter workflow state. Repeating the same response
  may reuse identical stored content; it never overwrites different content at an
  existing immutable response location.
- **OB-20 — Decision metadata remains inspectable.** The journal records the
  human request ID and version, question summary, allowed choices, accepted
  choice, actor metadata, time, next-step instructions, waiver state, and content
  reference. Local actor and harness identity are optional, unverified audit
  metadata rather than authorization.
- **OB-20a — Waiver audit record.** Accepting a declared loop outcome appends a
  `waiver.accepted` event and preserves the same typed record in the run: waiver,
  loop, step, and attempt IDs; expected and actual scalar outcome; unverified
  actor metadata; immutable rationale reference; optional forward-instruction
  reference; and its declared target. Raw rationale and instruction text do not
  enter the journal or Temporal history.
- **OB-21 — No command-line interpolation.** Raw human response content never
  appears inside a generated `darrow continue` shell command or Temporal history.
  Workflow state carries only its bounded content reference and hash.

## OpenTelemetry

- **OB-22 — Optional and disabled by default.** Darrow exports OpenTelemetry only
  after explicit configuration. Local operation, inspection, continuation, and
  recovery do not require a collector.
- **OB-23 — Best-effort projection.** Telemetry is derived from product state and
  events. Export delay or failure never changes workflow state, retry behavior,
  human decisions, or conclusion.
- **OB-24 — Versioned semantic attributes.** Darrow versions its span, log, and
  metric attribute contract. Compatible additions follow the CLI-protocol
  compatibility rules; incompatible meanings require a major transition.
- **OB-25 — Bounded traces.** A multi-day run is represented by short linked
  traces for compilation, activities, waits, and continuation rather than one
  span held open across human time.
- **OB-26 — Default safe metadata.** Default export may include run and workflow
  identity, versions and digests, step and attempt identity, state transitions,
  command/capability contracts, harness and model routing, timing, usage, error
  category, waiver state, and artifact hashes.
- **OB-27 — Content excluded by default.** Prompts, responses, transcript text,
  free-form human input, source, diffs, tool payloads, stdout/stderr, and artifact
  bodies are not telemetry attributes or log bodies by default.
- **OB-28 — Low-cardinality metrics.** Run, ticket, repository, Git branch,
  invocation, and artifact IDs belong in traces or logs, not metric labels.

## Secrets, redaction, and retention

- **OB-29 — No intentional secret serialization.** Darrow does not intentionally
  write configured secret values into plans, locks, journals, content, artifacts,
  or telemetry.
- **OB-30 — Best-effort redaction.** Before persistence or export, Darrow redacts
  configured secret values and patterns it can recognize. Unknown, transformed,
  encoded, or tool-disclosed secret content may not be detectable.
- **OB-31 — Environment responsibility.** The harness environment owns secret
  access and permission enforcement and must prevent tools or models from
  exposing values they should not disclose.
- **OB-32 — Explicit local cleanup.** Raw harness events, transcripts, logs,
  patches, and test output remain eligible for explicit age-based cleanup after
  the run is terminal and active references are absent. No background cleanup
  occurs. Cleanup retains the bounded audit journal and cleanup markers even when
  selected content, results, artifacts, and snapshots are removed.
- **OB-33 — Compact retained learning.** A workflow may publish a smaller ticket
  summary for long-term learning while allowing raw intermediate content to be
  purged. Published content remains subject to explicit ticket cleanup.
