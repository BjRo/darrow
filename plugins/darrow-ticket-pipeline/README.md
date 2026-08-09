# Darrow Ticket Pipeline

This plugin delivers one existing engineering ticket through a deliberately
static sequence of fresh phase agents. Unlike the adaptive goal loop, the route
is known in advance: refine and challenge the plan, implement it, review and
rework when needed, verify acceptance in QA, then identify any durable learning.

The ticket is the durable control plane. Pipeline metadata, launch intent,
phase artifacts, loop state, and escalation evidence are stored in a
pipeline-owned section of that one ticket description, so a replacement
controller can resume without a separate workflow service.

## What it provides

### `deliver-ticket`

The explicitly invoked controller for exactly one ticket. It discovers a
compatible installed ticket capability, records each child launch before
starting it, delegates every phase to a fresh agent with the matching skill,
and advances only according to the bundled state machine. The controller never
does phase work itself.

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

### `bin/ticket-pipeline` and artifact contract

The Bash state machine initializes runs, validates launch and result records,
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

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. "Darrow" is a trademark of Björn Rochel; forks
must rename. Part of the [Darrow](https://github.com/BjRo/darrow) marketplace.
