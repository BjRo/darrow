# Darrow Ticket Pipeline

> **Deprecated reference.** This plugin remains installable and its explicitly
> invoked `deliver-ticket` workflow remains available for reproducible
> comparison. Use Adaptive Delivery for new orchestration work. This is
> informational only: deliberately invoking
> `deliver-ticket` does not add a warning or confirmation gate.

This plugin delivers one existing engineering ticket through a deliberately
static sequence of fresh phase agents. Unlike Adaptive Delivery, the route
is known in advance: refine and challenge the plan, implement it, review and
rework when needed, verify acceptance in QA, then identify any durable learning.

The ticket is the durable control plane. Pipeline metadata, launch intent,
phase artifacts, loop state, and escalation evidence are stored in a
pipeline-owned section of that one ticket description, so a replacement
controller can resume without a separate workflow service.

## What it provides

### `deliver-ticket`

The deprecated-reference controller for exactly one ticket. It remains
available only through deliberate explicit invocation: it discovers a
compatible installed ticket capability, records each child launch before
starting it, delegates every phase to a fresh agent with the matching skill,
and advances only according to the bundled state machine. The controller never
does phase work itself or adds a deprecation confirmation step.

Example: _“Use deliver-ticket for DAR-123.”_

### Planning phases

- `refine-ticket` turns the ticket into a decision-complete implementation plan
  with observable acceptance criteria, public seams, non-goals, and literal
  verification gates.
- `challenge-ticket` independently tests that plan against the ticket,
  repository constraints, safety, and verifiability. It approves the plan or
  returns concrete revision, human-decision, or blocked evidence.

### Change phases

- `implement-ticket` is the initial writer. It applies only the approved plan
  in the local working tree while preserving the recorded baseline of existing
  user work.
- `rework-ticket` is the bounded repair writer. In review mode it fixes named
  blocking review findings; in QA-fix mode it fixes reproducible acceptance or
  gate failures. It does not approve its own work.

### Evidence phases

- `review-ticket` checks the complete current change against both the approved
  ticket contract and repository correctness without editing it.
- `qa-ticket` independently proves every acceptance criterion through its
  public seam and runs every applicable final-tree gate.
- `codify-ticket` examines a converged delivery for non-obvious, reusable
  repository knowledge. It recommends one authoritative home or records that
  there is nothing new to codify; it does not apply the recommendation.

### `darrow-ticket-pipeline` and artifact contract

The contained Python state machine initializes runs, validates launch and result records,
selects the next predefined phase, enforces iteration limits, summarizes
resumable state, and validates terminal outcomes. `config/phase-artifact.md`
defines the shared artifact envelope used by every phase. The controller
protocol documents ticket persistence, child packets, baseline handling, and
final result mechanics.

## Pipeline shape

```text
refine <-> challenge -> implement -> review <-> rework -> QA <-> rework (qa_fix) -> codify
```

Revision branches are bounded. They exist only where the static pipeline
defines them, and every new verdict comes from a fresh read-only phase agent.

## Design boundaries

- The plugin depends on a compatible host ticket capability but never assumes
  a sibling Darrow plugin is installed or reads another plugin's files.
- Only implement and rework may edit product files, with at most one active
  writer. Other phases are read-only for repository and tracker state.
- The pipeline may edit the local working tree and its owned ticket-description
  section. It never branches, commits, pushes, edits pull requests, merges,
  releases, deploys, or changes ticket fields or status.
- It is not an adaptive planner, daemon, queue, or general workflow runtime.

## When to use

Use this deprecated reference for deliberate static-workflow comparisons. Use Adaptive Delivery for new orchestration work. Ordinary ticket requests do not activate it.

## Hosts and prerequisites

Codex or Claude Code with fresh-agent support;
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers), Git,
repository checks, and a compatible installed ticket capability with access
to the selected ticket. Mechanics run on macOS, Linux, and native Windows;
they do not require Bash or a sibling plugin. The host still owns child-agent
availability and tracker access.

Invoke the locked package directly, with the absolute installed plugin path:

```text
uv run --quiet --frozen --no-dev --project <plugin-root>/backend darrow-ticket-pipeline summary --body-file <absolute-ticket-snapshot>
```

Runtime dependencies are empty; development tools live only in the locked
development group.

### Migration and benchmark fidelity

Version 0.3.1 converts the facade to Python for native Windows support while
retaining this deprecated baseline. It removes the old Bash runtime path;
command arguments, TSV formats, phase artifacts, ticket serialization, limits,
and exit classes remain stable: `0` success, `2` invalid input or filesystem
failure, `4` contradictory state or refused transition, `64` unknown command.
Diagnostics remain specific but are not byte-identical to the old shell errors.
Output paths are absolute and new candidates never overwrite existing files.

The migration deliberately preserves two historical selection details:
`summary` returns `finish` for failed QA although explicit bounded QA repair is
accepted; and `needs_revision` continues to select refinement after a new
refinement until an explicit matching challenge is recorded. They are reference
behavior, not new recommendations for orchestration.

[Matched command evidence](backend/tests/README.md) covers the Bash reference
and Python candidate. The package gate runs on Python 3.10–3.13 across macOS,
Linux, and native Windows, and copied-artifact validation uses only locked
runtime dependencies. The meaningful shell regression scenarios are ported to native Python
integration tests; the shell test and runtime facade are removed. No Python quality exception is needed.

## Installation

Install `darrow-ticket-pipeline@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review the local authority and prerequisite boundaries first.

## Usage

This orchestration entrypoint is explicit-only; an implicit request does not
start it. For example:

> Use deliver-ticket for the exact ticket reference I supplied.

Select `deliver-ticket` from Codex's `$` menu, or invoke
`/darrow-ticket-pipeline:deliver-ticket` in Claude Code and provide the bounded request.

## Expected result

The predefined phase sequence can edit product files and its owned ticket-description section. It does not branch, commit, push, or create PRs.

## Troubleshooting

Retain ticket-owned pipeline state and the failing phase evidence. Resume through the controller's documented state machine; do not invent phases, bypass bounds, or do phase work in the controller.
For host discovery problems, use the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).
Report the exact host/plugin versions and refusal without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
