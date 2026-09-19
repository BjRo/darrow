---
name: deliver-ticket
description: Deliver one existing engineering ticket through a deprecated static reference pipeline of fresh refine, challenge, implementation, review, rework, QA, and codify agents. For new orchestration work, use darrow-adaptive-delivery instead. Use this only when the user deliberately and explicitly invokes deliver-ticket with exactly one ticket identifier; it edits the local working tree and pipeline-owned ticket-description sections but does not publish the result or require a deprecation confirmation.
---

# Deliver a ticket

> **Deprecated reference.** For new orchestration work, use
> `darrow-adaptive-delivery`. This skill remains installable and executes when
> deliberately invoked by its host-visible `deliver-ticket` skill name; the
> notice adds no warning or confirmation gate.

Control one ticket-backed delivery run. Never perform phase work in the parent
context: every phase belongs to a fresh child that explicitly invokes its
matching skill.

## Working model

- **Ticket-authoritative:** pipeline state, every launch route, valid child
  artifacts, and escalations survive in the named ticket description.
- **Intent before effect:** persist and verify an `in_progress` launch record
  before starting its child. An uncertain launched phase is never replayed.
- **Fresh phases:** one child performs one phase. Only implement and rework may
  write product files, and at most one writer may be active.
- **Static routing:** the bundled state machine selects the next predefined
  phase and enforces loop limits; the controller does not improvise phases or
  retries.
- **Local publication boundary:** the run may change the local working tree and
  pipeline-owned sections of the named ticket description. It does not branch,
  commit, push, create or edit a pull request, merge, release, deploy, change
  ticket fields/status, or mutate another external object.

**Controller protocol:** Read
[`references/controller-protocol.md`](references/controller-protocol.md)
completely before preflight. It is the single source of truth for baseline,
ticket-persistence, child-packet, loop, and result-record mechanics.

## Workflow

### 1. Bind authority and inputs

Resolve the current Git repository to an absolute path and require exactly one
ticket identifier. Discover an installed backend-neutral capability that can
both fetch that exact ticket and explicitly replace only its description.
Inspect its supported interface; do not assume a sibling plugin, read another
plugin's files, or substitute raw tracker-specific commands.

Fetch the ticket and require it to be open with a concrete outcome and
observable done criteria. Use `blocked` before child or product work when the
ticket operations are absent/failing or required evidence is unreadable. Use
`needs_human` before a writer when product behavior or authority is materially
ambiguous.

Record the current HEAD and capture the filename-safe user-work baseline as
specified by the protocol. Every pre-existing path is user-owned and outside
writer scope. A baseline that cannot be captured exactly blocks the run.

**Complete when:** repository, ticket, allowed ticket operations, outcome,
criteria, base revision, and preserved user work are concrete—or a terminal
preflight result has been returned with zero child launches and no mutations.

### 2. Initialize or resume durable state

Use the frozen `darrow-ticket-pipeline` entrypoint from `<skill-dir>/../../backend`
as specified by the controller protocol. Require UV and Python 3.10–3.13;
export the fetched description to private temporary storage outside the repository.

- No pipeline run: initialize one, replace the description through the ticket
  capability, re-fetch it, and validate the persisted state before continuing.
- Active run: reconcile it with `summary`. Require its repository bytes and
  base revision to match this repository and current HEAD.
- Completed run: report its persisted result; do not repeat it.
- Contradictory run: stop `blocked`.
- Any `in_progress` phase: stop `needs_human` with the exact uncertain phase;
  never replay it, especially when it may have written.

Preserve every non-pipeline ticket byte on every description replacement.

**Complete when:** one validated active run has an unambiguous `next_phase`, or
the existing evidence has produced an honest terminal result without launching
a child.

### 3. Execute the state machine

After every durable transition, use `darrow-ticket-pipeline summary` and follow its
`next_phase` exactly:

| Phase | Required skill | Product boundary |
| --- | --- | --- |
| refine | `$refine-ticket` | read-only |
| challenge | `$challenge-ticket` | read-only |
| implement | `$implement-ticket` | local working tree |
| review | `$review-ticket` | read-only |
| rework | `$rework-ticket` | local working tree |
| qa | `$qa-ticket` | read-only |
| codify | `$codify-ticket` | read-only, including guidance |

For each phase, execute the protocol's launch → persist → re-fetch → spawn →
consume → record → persist → re-fetch sequence. Pin the stable child ID and
actual harness/model/effort route before launch. Give the child only the
bounded packet, wait without inventing an ad hoc timeout, validate its artifact,
and close it before starting a dependent phase.

Never execute a phase inline or treat a missing/malformed artifact as phase
success. Preserve the launch row and stop `needs_human` when a launched child
is lost or returns no valid artifact. Stop on any phase `needs_human`,
`blocked`, or non-recoverable `failed` result. Follow only the protocol's
bounded challenge, review/rework, and QA/fix branches.

**Complete when:** every launched child has exactly one persisted route and
either one validated artifact or an explicit uncertainty escalation, no loop
limit is exceeded, and `summary` returns `complete` or a terminal condition.

### 4. Prove and persist the outcome

Before `verified`, prove against the latest tree that:

- the newest challenge and review are approved and the newest QA passed;
- codify returned `complete` or `no_change`;
- every acceptance criterion and applicable final-tree gate passes;
- every baseline path retains its recorded content, mode, and index state;
- every launched child is durably accounted for.

Finish the ticket through the bundled command, replace the description,
re-fetch it, and require the persisted state to match. For `needs_human`, write
only the smallest required decision into the escalation. Preserve other
terminal outcomes honestly.

Return the protocol's result record with actual phases, routes, files, gates,
loop counts, child invocations, human interruptions, residual risks, and next
action. Never invent evidence, token counts, costs, or phase work.

**Complete when:** the final record matches the re-fetched ticket state and
latest working tree, and every mutation stayed within the authorized local-tree
and named-ticket-description boundary.
