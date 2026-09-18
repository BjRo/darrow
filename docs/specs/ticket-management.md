# Capability: Ticket Management

Consolidates ticket operations into intent-triggered skills so that
creating and updating tickets is consistent, traceable, and backend-neutral
regardless of which agent runtime executes them and which tracker backs them.

GitHub Issues provider: `darrow-tickets-github`. Skills: `create-ticket`, `read-ticket`,
`update-ticket`, `list-tickets`.

Scope: mechanics only. These skills record and mutate tickets; they do not
refine requirements, plan or break down work, or review solutions. Those
are separate capabilities that reach this one through intent ("create a
ticket for X") and a ticket is only as elaborate as what its caller already
knows.

## Why

Agents left to improvise tracker usage produce duplicate tickets, vague
one-line bodies, invented repro steps, and tool attribution in ticket
history. Worse, every skill that needs a ticket ends up hard-coding one
tracker's CLI. Encapsulating the workflow as skills gives other capabilities a
stable intent ("create a ticket for X") while the backend stays swappable.

## Backend contract

- **TM-P3 — Contained portable mechanics.** The GitHub provider ships one
  dependency-free Python package managed by UV, invoked through its frozen
  `darrow-ticket` entrypoint by all four skills. Preserve the command arguments,
  output records, refusals, and exit codes while removing the Bash launcher.
  Use argument-vector subprocesses, explicit UTF-8 JSON decoding and validation,
  and native filesystem and temporary-file handling on Linux, macOS, and Windows.
  Provider failures must stop pending mutations; completed mutations remain
  visible if a later relation write or read fails. Validate with mocked provider
  operations, generated boundary cases, and fresh copied-plugin execution;
  automated tests must never mutate live GitHub state.

- **TM-P1 — Independently installable providers.** Each tracker implementation
  lives in its own `darrow-tickets-<provider>` plugin. The shipped provider is
  GitHub Issues via `gh`. Future trackers use separate, self-contained plugins;
  no shared runtime plugin or provider registry is required. Repository-resident
  Darrow ticket directories contain published artifacts only; they are never a
  tracker or a file-backed ticket store.
- **TM-P2 — Shared intents, explicit provider scope.** Skill names and operation
  invariants remain backend-neutral. Each provider advertises its tracker in
  discovery metadata and states its prerequisites in the skill. CLI calls,
  field mappings, and linking syntax stay in its bundled scripts. Consumers
  request operations by intent and select a provider matching the user's
  explicit tracker choice or established project context. If several installed
  providers remain plausible, ask which tracker before contacting one. An
  explicit request for another tracker must not be redirected to GitHub merely
  because the repository is hosted there. A URL's appearance alone is not an
  explicit provider choice: once this provider is selected, TM-R1 still requires
  the bundled CLI to validate every supplied ticket URL.
- **TM-1 — Deliberate backend.** The script resolves exactly one usable
  backend deterministically and the report names it. No usable backend
  (no remote, issues disabled, missing CLI) → refuse with a clear error
  stating what's missing; never guess or fall back silently.
  Every GitHub call, including native relation API reads and mutations, is
  bound to the resolved origin host and repository independently of ambient
  `GH_HOST` or `GH_REPO` configuration.

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
  script's business per backend: a native mechanism where one exists,
  a structured marker line otherwise. GitHub Issues has native support
  for both — sub-issues carry `parent`, issue dependencies ("blocked
  by") carry `depends-on` — so relations live in the tracker's own
  data model, visible in its UI and safe from description edits.
  Skills and callers never hand-write tracker syntax. Every recorded
  relation is stated in the report (type + target id).
  Parent reads retain and validate qualified repository identity against the
  backend's canonical current repository before using a local issue number,
  including when an old origin URL redirects after a rename or transfer.
  This provider refuses an existing foreign parent with
  its canonical URL before reporting it as local or attempting parent changes.
  Dependency reads follow every page before reporting blockers or deciding
  membership; a later-page failure aborts the read or pending mutation.

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
- **TM-C8 — Traceable report.** The report states the external ticket id and
  canonical URL, the type, the labels applied, and anything omitted under
  TM-C1/TM-C6.
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
"close the ticket", "reopen <id>", or an explicit skill invocation.

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
  Label values are literal: additions and removals must refuse comma-bearing
  values when the backend's label flags would split them into unrelated labels.
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

## read-ticket

### Intent triggers

"read ticket #42", "show me issue #42", "what does this ticket ask for?",
"fetch <canonical-ticket-url>", or an explicit skill invocation.

### Contract

Return one exact current-project ticket, read-only. Resolve only a stable ID,
canonical URL, or an exact ticket reference already bound in the conversation,
then relay its authoritative metadata, relations, and body.

### Invariants

- **TM-R1 — Exact current-project reference.** Direct or indirect requests to
  retrieve one referenced ticket select this capability without requiring the
  user to name the skill. Read only an explicit ticket ID, a canonical URL
  belonging to the current project's resolved backend, or an exact reference
  already bound unambiguously in the conversation. A missing reference asks for
  an ID or canonical URL. A topic, title fragment, foreign-project URL,
  ambiguous conversational reference, or numeric suffix extracted from a
  rejected URL never becomes a guessed ticket.
- **TM-R2 — Read-only.** Reading never mutates tracker state and never becomes
  permission to comment, edit, label, relate, close, reopen, assign, or start
  the tracked work.
- **TM-R3 — Authoritative complete output.** Return the backend, provider-owned
  `ticket-token: N` sourced from the authoritative ticket number, ID, state,
  title, canonical URL, labels, parent and dependency relations, and full
  description exactly as normalized by the bundled CLI. The token is identical
  whether the accepted input was `N`, `#N`, or the current-project canonical
  URL; it is absent from every refusal or retrieval failure. Consumers preserve
  it verbatim rather than deriving a token from an input reference or URL. Do not summarize,
  rerank, enrich, interpret, assess readiness, or omit inconvenient content.
- **TM-R4 — Honest retrieval failure.** A missing ticket, unusable backend,
  unreadable relation, or tracker error stops with the CLI's complete diagnostic.
  Backend-provided evidence remains verbatim but may be capped with an explicit
  truncation note; a silent backend failure gets an honest synthetic diagnostic.
  Never substitute repository files, a web search, raw tracker commands, or
  another plugin as an unverified fallback.

### Non-goals

Finding tickets by topic or returning a set (see list-tickets), reading comments
or event history, cross-repository/project retrieval, mutating tickets (see
update-ticket), assessing readiness, planning, implementing, or otherwise
starting the tracked work.

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
- **TM-L3 — Compact, decision-relevant output.** Relay the complete compact CLI
  response starting with its `backend:` line without changing its visible
  content or line order. Per ticket: id, title, type/labels (and state, when the
  query spans states) — no raw tracker dumps.
- **TM-L4 — Honest truncation.** A capped list states the cap and characterizes
  the total honestly, including `more than N` when the backend query establishes
  only a lower bound; an empty result states which filters produced it. Never
  present a truncated list as complete.

### Non-goals

Reading one exact ticket and its body (see read-ticket), mutating tickets (see
create-ticket / update-ticket), cross-repo or cross-project queries, analytics
or reporting (velocity, aging stats), board/sprint views.
