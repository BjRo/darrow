# Capability: Ticket Pipeline

Darrow retains a deprecated but installable static, explicitly invoked ticket
pipeline reference whose orchestration state and phase artifacts live in one
existing tracker ticket. New orchestration work should use `darrow-adaptive-delivery`.
The top-level controller continues to delegate each predefined phase to a fresh
child agent that explicitly runs the phase's skill, then uses bounded
refine/challenge, review/rework, and QA/fix branches to converge or escalate.

Plugin: `darrow-ticket-pipeline`  
Skills: `deliver-ticket`, `refine-ticket`, `challenge-ticket`,
`implement-ticket`, `review-ticket`, `rework-ticket`, `qa-ticket`,
`codify-ticket`

## Why

`darrow-adaptive-delivery` deliberately minimizes orchestration and keeps its state
transient. This capability preserves a materially different design for later
comparison: more phase specialization, a durable ticket handoff, and explicit
bounded convergence loops. It follows the useful part of Mynab's delivery
approach without importing its project configuration, `.agent-shared` layer,
launch scripts, worktree slots, or application-specific personas.

The normal flow is:

```text
ticket
  -> refine -> challenge --needs revision--> refine       (at most 3 challenges)
  -> implement
  -> review --changes requested--> rework -> review        (at most 2 reviews)
  -> QA --failed--> rework -> QA                           (at most 2 QA attempts)
  -> codify
  -> report
```

This is a native, skill-driven orchestrator, not a daemon or workflow runtime.

## Capability invariants

- **TP-D1 — Deprecated reference availability.** The pipeline remains listed
  and installable as a deprecated reference implementation, directs new
  orchestration work to `darrow-adaptive-delivery`, and preserves deliberate explicit
  `deliver-ticket` invocation without a deprecation warning or confirmation
  gate. Codex-facing defaults use the installed plugin-qualified invocation
  token; shared skill prose names the capability without prescribing one
  host's transport syntax.
- **TP-A1 — Explicit controller.** Only explicit `deliver-ticket` invocation
  starts a run; its parent context controls but never performs a phase.
- **TP-T1 — Durable ticket.** One existing ticket retains the run metadata,
  phase state, execution ledger, every successful child artifact, and an
  escalation for every launched attempt that cannot return a valid artifact.
- **TP-P1 — Skill-isolated phases.** Every phase runs in a fresh child that
  invokes its named phase skill; missing isolation or skill availability is
  blocked rather than executed inline.
- **TP-L1 — Bounded convergence.** Challenge, review/rework, and QA/fix obey
  their fixed limits and escalate or fail instead of adding retries.
- **TP-S1 — Mutation boundary.** Only implement/rework write product files;
  only the controller writes the named ticket; publication needs separate
  authority and pre-existing work is preserved.
- **TP-E1 — Validated evidence.** Every launched child has a durable route
  record written before launch and either one mechanically valid artifact or
  an explicit escalation before a dependent phase starts.
- **TP-R1 — Ticket resume.** A replacement controller resumes from validated
  ticket evidence without repeating a completed writer.
- **TP-V1 — Final-tree proof.** Verified requires approved review, passed QA,
  applicable final-tree gates, preserved user work, and codify evidence.
- **TP-C1 — Comparable result.** The final record reports outcome, phases,
  routes, files, gates, loop counts, child invocations, interruptions, risks,
  and next action in a comparison-friendly shape.

## Shared model

### Controller

`deliver-ticket` runs in the user-facing parent context. It owns phase order,
loop counters, child lifecycle, ticket persistence, permission boundaries,
escalation, and the final report. It MUST NOT implement, review, repair, or
verify the product change itself.

The controller is the sole ticket writer. Child agents return phase artifacts
to the controller; they MUST NOT race one another to edit the ticket.

### Ticket

The input is one existing, open tracker ticket containing the requested
outcome and observable done criteria. The ticket is both the task identifier
and the durable handoff. The controller reads and replaces its description
through an installed backend-neutral ticket-management capability. It MUST
detect that capability before launching children and stop as `blocked` when
the ticket cannot be read or its description cannot be updated. The plugin
MUST NOT reference another plugin's files or bypass the capability with raw,
tracker-specific commands.

Explicit invocation with a ticket identifier authorizes only reads and
description updates on that ticket for ticket pipeline artifacts. It does not
authorize status, label, relation, milestone, assignee, or comment mutations.

The controller preserves all ticket content it does not own. Pipeline-owned
sections are namespaced under `Ticket Pipeline` headings and are updated
mechanically. Every phase attempt is retained; later iterations do not erase
earlier artifacts.

### Children and phase skills

Every phase runs in a fresh child context with a bounded packet containing the
absolute repository path, run ID, ticket ID, current ticket-body snapshot,
phase name, iteration, permissions, stopping budget, and expected artifact
shape. It MUST NOT contain the parent transcript or another child's hidden
reasoning.

The controller explicitly directs each child to run exactly one matching
phase skill:

| Phase     | Skill              | Product writes |
| --------- | ------------------ | -------------- |
| refine    | `refine-ticket`    | no             |
| challenge | `challenge-ticket` | no             |
| implement | `implement-ticket` | yes            |
| review    | `review-ticket`    | no             |
| rework    | `rework-ticket`    | yes            |
| QA        | `qa-ticket`        | no             |
| codify    | `codify-ticket`    | no             |

At most one write-capable child may be active. The controller waits for and
closes every child before starting a dependent phase. Inline phase execution
is not a successful fallback: unavailable child isolation or a missing phase
skill is `blocked`.

### Phase artifact

Every child returns one UTF-8 artifact with a TSV header followed by Markdown:

```text
format\tdarrow-ticket-pipeline-phase-v1
run_id\t<run-id>
phase\t<phase>
iteration\t<positive integer>
agent\t<stable child id or name>
status\t<phase-specific status>
summary\t<single-line summary>
---
<phase evidence>
```

The bundled mechanic validates headers and statuses before the controller
persists an artifact. Missing, malformed, wrong-run, or wrong-phase output is
not success; the controller records the failure and stops or applies the
phase's bounded retry rule.

The ticket contains:

- `## Ticket Pipeline Run` with format, run ID, state, repository, and start revision;
- `## Ticket Pipeline User Work Baseline` with filename-safe initial porcelain status
  plus content, mode, and index fingerprints for every pre-existing path;
- `## Ticket Pipeline Phase State` with the latest status and iteration per phase;
- `## Ticket Pipeline Execution Ledger` with one row per child attempt, including its
  stable ID, harness/model/effort route, and outcome;
- one `## Ticket Pipeline Artifact — <phase> — Iteration <n>` section per valid child
  result, or a retained in-flight ledger row plus escalation when no valid
  artifact can be recovered;
- `## Ticket Pipeline Escalation` only when human input is required.

The controller persists a ledger row and `in_progress` phase state before it
launches each child. The ticket is authoritative for resume. A new controller
reads the current run, reconciles phase rows, ledger routes, and artifact
headers, and resumes at the first incomplete dependency without repeating
completed write phases. A surviving `in_progress` attempt is uncertain and
requires a human decision rather than replay, especially for a writer. The
controller refuses any missing artifact, ambiguous attempt, or internally
contradictory run rather than guessing.

## Phase contracts

### Refine and challenge

`refine-ticket` inspects the ticket, repository guidance, relevant code, and
tests. It returns a decision-complete plan, explicit acceptance criteria,
scope, non-goals, risks, affected paths, and verification commands without
editing product files.

`challenge-ticket` tests the plan against the ticket intent and repository
evidence. It returns `approved`, `needs_revision`, `needs_human`, or `blocked`.
Only a concrete gap that could violate the requested outcome, repository
rules, safety, or verifiability blocks approval; preferences do not.

The controller permits at most three challenge attempts. `needs_revision`
starts a fresh refiner with the prior challenge artifact. A third unresolved
challenge ends as `needs_human` with the exact open decision or contradiction.

### Implement

`implement-ticket` is the first write-capable phase. It follows the approved
plan, preserves pre-existing work, applies any requested implementation
discipline, and runs the applicable focused and repository gates. It does not
commit, push, open a pull request, merge, deploy, edit the ticket, or run later
phases. It returns changed paths and command evidence.

### Review and rework

`review-ticket` is a fresh read-only reviewer. It checks both ticket/spec
fulfillment and repository correctness against the final diff and applicable
commands. Findings require severity, location or command, violated criterion,
and evidence. It returns `approved`, `changes_requested`, `needs_human`, or
`blocked`.

One `changes_requested` verdict may launch `rework-ticket`, which receives the
approved plan and structured findings, fixes only those root causes, and
reruns affected checks. Any repair invalidates the prior review. A second
review still returning `changes_requested` ends as `needs_human`; the
controller MUST NOT create an unbounded repair loop.

### QA and QA fix

`qa-ticket` independently verifies every acceptance criterion and applicable
deterministic gate against the current tree. It returns `passed`, `failed`,
`needs_human`, or `blocked`, with explicit evidence for every criterion.

One `failed` verdict may launch `rework-ticket` in `qa_fix` mode with the QA
artifact, followed by a fresh QA attempt. A second failure ends as `failed` or
`needs_human` according to whether another product decision is required.

### Codify

`codify-ticket` always runs after review and QA converge. It returns either
`complete` with concise durable-learning recommendations or `no_change`.
It is read-only for both product files and repository guidance; recommendations
remain ticket artifacts so codification cannot invalidate the verified tree.

## Safety and publication

- Pre-existing working-tree changes are user-owned, recorded at start, and
  never reverted or overwritten to make the run pass.
- The default publication boundary is the local working tree plus authorized
  artifact updates to the named ticket.
- The ticket pipeline does not create or switch branches or worktrees, commit,
  push, open or edit pull requests, merge, release, deploy, or mutate any other
  external state without a separate user request.
- Destructive work, materially ambiguous product behavior, security/privacy
  policy choices, secrets, billing, irreversible migrations, and authority not
  present in the ticket require a human decision before product writes.
- Child failures, unavailable required commands, unreadable guidance, and
  tracker errors are reported honestly. They are never converted to passes.

## Outcomes and result record

A run ends in exactly one state: `verified`, `needs_human`, `blocked`,
`failed`, or `budget_exhausted`.

The final response contains a machine-readable record beginning with:

```text
format\tdarrow-ticket-pipeline-result-v1
run_id\t<run-id>
ticket\t<ticket-id>
status\t<outcome>
```

It also records every phase attempt and child route, changed files, every
applicable command and result, review and QA verdicts, loop counts, remaining
risks, the smallest next action, `evaluation_child_invocations`, and
`evaluation_human_interruptions`. Those last two fields make the result
directly usable by the shared orchestration comparison runner.

`verified` is valid only when the latest review is `approved`, the latest QA
is `passed`, every applicable gate passed on the final tree, pre-existing work
was preserved, codify returned `complete` or `no_change`, and the ticket
contains validated artifacts for every launched child.

## Evaluation requirements

Initial capability acceptance MUST include one judgment eval for every phase,
one normal controller composition, one missing-ticket preflight, and portable
mechanics tests for dependency ordering, ticket reconciliation, and all loop
limits. Paired comparison test cases are intentionally a separate follow-up so
the ticket pipeline can be frozen before it is compared with `darrow-adaptive-delivery`.

That later comparison suite MUST cover at least:

1. a normal code change that delegates all phases and leaves a verified local
   tree plus complete ticket artifacts;
2. a plan challenge that forces one refine/challenge loop before approval;
3. a seeded implementation defect that forces review/rework/re-review;
4. a repeated QA failure that stops after one QA-fix retry;
5. missing ticket-management or child-agent capability that blocks before
   product writes;
6. refusal to commit, push, open a PR, or mutate a different ticket without
   separate authority;
7. resumption from ticket evidence without repeating a completed writer.

Comparisons with `darrow-adaptive-delivery` should use the same fixture, model, effort,
acceptance checks, trials, and harness version, and compare pass rate, escaped
defects, false positives, child invocations, human interruptions, tokens,
cost, and wall time.
