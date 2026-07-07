# Capability: Ticket Management

Consolidates ticket/issue operations into intent-triggered skills so that
creating and updating tickets is consistent, traceable, and backend-neutral
regardless of which agent runtime executes them and which tracker backs them.

Plugin: `darrow-tickets`. Skills: `create-ticket`, `update-ticket`,
`list-tickets`.

Scope: mechanics only. These skills record and mutate tickets; they do not
refine requirements, plan or break down work, or review solutions. Those
are separate capabilities that reach this one through intent ("create a
ticket for X") and a ticket is only as elaborate as what its caller already
knows.

## Why

Agents left to improvise tracker usage produce duplicate tickets, vague
one-line bodies, invented repro steps, and tool attribution in ticket
history. Worse, every skill that needs a ticket ends up hard-coding one
tracker's CLI. Encapsulating the workflow as skills gives other capabilities
a stable intent ("create a ticket for X") while the backend stays swappable —
the decoupling the product spec's F5 requires.

## Backend contract

- The skill layer is backend-neutral: intents and invariants hold for any
  tracker. All backend specifics (CLI calls, field names, linking syntax)
  live in the bundled scripts — SKILL.md never names a tracker.
- First backend: GitHub Issues via `gh`. Planned: the in-repo ticket store
  behind the ticket CLI (product spec F5) as a second backend; others when
  needed. Adding a backend touches scripts only.
- **TM-1 — Deliberate backend.** The script resolves exactly one usable
  backend deterministically and the report names it. No usable backend
  (no remote, issues disabled, missing CLI) → refuse with a clear error
  stating what's missing; never guess or fall back silently.

## Relations contract

Tickets relate in two ways: `depends-on` (this ticket is blocked by
another) and `parent` (this ticket belongs under an umbrella ticket, e.g.
an epic). Both are pure mechanics here — the caller decides the structure,
the skills only record it. Deciding what depends on what, or how work
breaks down under an umbrella, belongs to the planning capabilities.

- **TM-2 — Caller-decided, target-verified.** A relation is recorded only
  when the caller names it, never inferred from content. The target ticket
  is verified to exist before anything is created or mutated; a missing
  target is reported and stops the operation.
- **TM-3 — Script-owned mechanism.** How a relation is stored is the
  script's business per backend: a native mechanism where one exists
  (e.g. sub-issues), a structured marker line otherwise. Skills and
  callers never hand-write tracker syntax. Every recorded relation is
  stated in the report (type + target id).

## create-ticket

### Intent triggers

"create a ticket", "file an issue", "open a bug for this", "track this",
"turn this into a ticket", or an explicit skill invocation.

### Contract

Produce exactly one well-formed ticket that captures the problem or desired
outcome. Search for existing tickets first, choose the type deliberately,
build the body from real evidence, then create.

### Invariants

- **TM-C1 — One ticket, deduped.** Search open tickets for the same problem
  before creating. A plausible existing match is reported (id + title) and
  nothing is created — the user decides whether to file anyway. Exactly one
  ticket per invocation.
- **TM-C2 — Deliberate type.** The type (bug, feature, task, chore) is
  chosen from the request and evidence, stated in the report, and mapped to
  the backend's taxonomy by the script.
- **TM-C3 — Structured body per type.** Bug: observed vs expected behavior
  plus reproduction steps. Feature: motivation plus acceptance criteria.
  Task/chore: outcome plus done-criteria. Every section carries real
  content; no empty headings, no boilerplate filler. A section the caller
  cannot fill becomes an open question (TM-C4), never invented content.
- **TM-C4 — Evidence, not invention.** Error messages quoted verbatim;
  paths, versions, and commands taken from the repo or conversation.
  Unknowns are listed as open questions, never fabricated into repro steps
  or speculative details presented as fact.
- **TM-C5 — Searchable title.** Concise and specific, states the problem or
  outcome (not the implementation), no trailing period.
- **TM-C6 — Labeled from existing taxonomy.** Every ticket is labeled: the
  script surfaces the tracker's existing labels and the ticket gets the
  applicable ones — at minimum the label matching its type, plus any that
  clearly apply from content (e.g. area labels). Only values that already
  exist in the tracker are used; never create labels as a side effect. If
  no existing label fits, the ticket is created unlabeled and the report
  says so. Milestones and assignees stay opt-in: only when the user asks,
  and only to existing values.
- **TM-C7 — No tool attribution.** No "Generated with ..." lines, no AI
  co-author credits, no tool emoji in title or body.
- **TM-C8 — Traceable report.** The report states the ticket id and URL (or
  path, for a file-backed store), the type, the labels applied, and
  anything omitted under TM-C1/TM-C6.
- **TM-C9 — Relations by request.** `depends-on` and `parent` relations are
  set at creation only when the caller names them, per the relations
  contract (TM-2/TM-3).

### Non-goals

Refining or elaborating the request beyond what is already known (TM-C4),
planning or breaking down the work, deciding dependency or parent/child
structure (recording caller-named relations is TM-C9), bulk creation,
sprint/board placement, creating labels or milestones, updating existing
tickets (see update-ticket), starting the work itself (branching goes
through the git capability's intents).

## update-ticket

### Intent triggers

"update the ticket", "comment on <id>", "add my findings to the ticket",
"close the issue", "reopen <id>", or an explicit skill invocation.

### Contract

Apply exactly the requested change — comment, status transition, field or
relation update — to exactly one verified ticket. Resolve and confirm the
target before mutating anything.

### Invariants

- **TM-U1 — Verified target.** The reference resolves to exactly one ticket,
  fetched before mutation; the report echoes id + title so the user can
  spot a mismatch. Ambiguous or missing reference → list candidates (or
  report none), stop.
- **TM-U2 — Only the asked change.** Exactly the requested mutation; no
  drive-by edits (relabeling, reformatting, or a status change smuggled in
  alongside a comment).
- **TM-U3 — Append, don't rewrite.** Updates land as comments. The
  description is edited only on explicit request; other authors' comments
  are never edited or deleted.
- **TM-U4 — Deliberate transitions.** Status changes only to a state the
  user named or clearly implied ("close it"); the report states the
  transition (from → to). A transition the backend refuses is relayed
  verbatim and stops the workflow.
- **TM-U5 — Verbatim cross-references.** Known commit, PR, or branch ids
  are referenced verbatim — never paraphrased or retyped from memory. When
  a backend needs ids transformed into linking syntax, that transformation
  is the script's job (GitHub links bare `#N` and SHAs as-is).
- **TM-U6 — No tool attribution.** Same as TM-C7, applied to comments and
  edits.
- **TM-U7 — Relations per contract.** Adding or removing a `depends-on` or
  `parent` relation follows the relations contract (TM-2/TM-3):
  caller-named, target verified, mechanism script-owned.

### Non-goals

Reviewing or assessing the work a ticket tracks, deciding dependency or
parent/child structure (recording caller-named relations is TM-U7),
deleting tickets, bulk updates, editing tracker configuration or
workflows, transferring tickets between repos/projects, creating tickets
(see create-ticket), merging or closing PRs (git capability).

## list-tickets

### Intent triggers

"list open tickets", "what's open?", "show open bugs", "which tickets are
in milestone X", "find tickets about Y", or an explicit skill invocation.

### Contract

Report matching tickets, read-only. Derive filters from the request, query
the backend, and present a compact list the user (or a calling skill) can
act on.

### Invariants

- **TM-L1 — Read-only.** Listing never mutates tracker state — no label
  changes, no status changes, nothing.
- **TM-L2 — Deliberate filters.** Filters (type/label, milestone, text,
  state) are derived from the request and stated in the report. Open
  tickets are the default; closed or all states only when asked.
- **TM-L3 — Compact, decision-relevant output.** Per ticket: id, title,
  type/labels (and state, when the query spans states) — no raw tracker
  dumps.
- **TM-L4 — Honest truncation.** A capped list states the cap and the
  total match count; an empty result states which filters produced it.
  Never present a truncated list as complete.

### Non-goals

Mutating tickets (see create-ticket / update-ticket), cross-repo or
cross-project queries, analytics or reporting (velocity, aging stats),
board/sprint views.
