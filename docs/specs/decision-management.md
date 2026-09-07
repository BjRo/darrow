# Capability: Decision Management

Captures explicit decisions at their authoritative scope and lists recorded
decisions without creating a competing repository of choices.

Plugin: `darrow-decisions`. Skills: `capture-decision`, `list-decisions`.

This capability is independently adoptable. It does not require the Darrow
runtime or another Darrow plugin, and it never treats installation of another
capability as a prerequisite for preserving a repository decision.

## Shared model

A **decision** is an explicitly authorized choice that changes what work should
do, which alternative applies, or which constraint governs a defined scope. An
observation describes evidence; a preference expresses a leaning; an assumption
is provisionally believed; and an open question has no authorized answer. None
of those becomes an accepted decision merely because an agent finds it
plausible, frequent, or well supported.

A decision record has:

- a subject and effect;
- a scope and expected lifetime;
- an authority source;
- a canonical sink;
- a lifecycle status when the sink supports one; and
- relationships to records it replaces or is replaced by.

- **DM-1 — Explicit authority.** `Accepted` requires an explicit choice from the
  user or an existing repository authority. Code frequency, recent changes,
  model recommendations, inferred consensus, and unaccepted proposals are not
  authority. When the choice or authority is unclear, preserve the alternatives
  as unresolved and ask rather than accepting one.
- **DM-2 — Classify before recording.** Distinguish a settled decision from an
  observation, preference, assumption, recommendation, and open question before
  selecting a sink or status. Do not manufacture a decision merely because the
  user asked to capture the surrounding discussion.
- **DM-3 — One canonical effect.** Search related records before writing. Amend
  the existing canonical sink when its meaning is unchanged, or supersede it
  when the accepted meaning changes. Never create a generic decision database,
  a duplicate ADR, or a second normative statement that competes with an
  existing specification or policy.
- **DM-4 — Narrowest durable scope.** Record only the scope and lifetime
  supported by the authority. A ticket implementation choice does not become
  repository architecture; a repository architecture choice does not become a
  cross-organization policy.
- **DM-5 — Preserve provenance.** Reports distinguish repository evidence, user
  statements, model inference, and assumptions. A record must not cite an
  inferred source as explicit authority. Context and consequences distinguish
  observed repository facts from user-provided rationale and explicitly marked
  assumptions; polished prose must not erase those boundaries.

## Canonical routing

Route a settled choice to the surface whose consumers must obey it:

| Scope                                     | Canonical sink                                                                               | Decision-management behavior                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket- or PR-local implementation choice | Existing work item                                                                           | Keep it in that work item. Use an available tracker or review integration only when the user requested that mutation; otherwise report the exact target and content still needing persistence. |
| Durable repository architecture           | Existing related ADR, or a new ADR when none exists                                          | Create, accept, reject, deprecate, or supersede through the ADR lifecycle.                                                                                                                     |
| Normative product or capability behavior  | Applicable product or normative specification                                                | Edit the governing invariant. Add an ADR only when the user separately authorizes preserving durable architectural rationale and that rationale is evidenced rather than invented.             |
| Durable team or repository policy         | Existing authoritative policy or repository-guidance surface                                 | Amend that surface at the narrowest reliably reachable scope.                                                                                                                                  |
| Unresolved architecture proposal          | Proposed ADR only when the repository uses ADRs for proposals and the user wants it recorded | Keep status `Proposed`; never represent it as accepted.                                                                                                                                        |

- **DM-6 — Route; do not copy.** The classification table selects one canonical
  effect. References to that effect may be added where useful, but copied rules
  do not become additional authorities. A request to capture does not authorize
  an extra rationale record at another scope.
- **DM-7 — Respect foreign ownership.** Work-item state and external review
  state remain owned by their systems. The plugin neither
  invents a file-backed substitute nor assumes a sibling plugin is installed.
  Mutate them only through an available owner integration and only when the
  request authorizes that exact mutation. When the owning integration is
  unavailable or out of scope, report the exact inaccessible owner and
  persistence gap, mark the result incomplete and application state unverified,
  and do not claim either that the decision was applied or that it is absent.
- **DM-8 — Unresolved stays unresolved.** A proposal may preserve alternatives,
  evidence, trade-offs, and a recommendation, but its status remains `Proposed`
  or open until explicit authority selects an outcome.

## ADR lifecycle

The supported statuses are `Proposed`, `Accepted`, `Rejected`, `Deprecated`,
and `Superseded`.

- `Proposed` has not taken effect. It may transition to `Accepted` or `Rejected`.
- `Accepted` is in force. It may transition to `Deprecated` or `Superseded`.
- `Rejected` never took effect and is terminal.
- `Deprecated` once applied but is no longer recommended without a named
  replacement; it is terminal.
- `Superseded` was replaced by one or more named ADRs and is terminal.

An ADR retains the repository's compact structure: title, `Status`, `Date`, one
canonical `Summary`, `Context`, `Decision`, and `Consequences`. `Supersedes`,
`Superseded by`, and `Revisit when` are optional metadata lines when applicable.

- **DM-9 — Valid lifecycle only.** Reject unsupported statuses and transitions.
  `Accepted` requires the authority rule in DM-1. A lifecycle transition does
  not by itself prove authority.
- **DM-10 — Accepted meaning is immutable.** Correcting spelling, formatting,
  links, or metadata without changing effect is allowed. A material change to
  an accepted decision creates a new ADR and supersedes the old one. The first
  release does not support semantic amendment in place.
- **DM-11 — Reciprocal supersession.** A superseding ADR names every replaced
  ADR in `Supersedes`; each replaced ADR has status `Superseded` and names the
  replacement in `Superseded by`. Targets must exist, identifiers must be
  unique, and the relationship graph must be acyclic.
- **DM-12 — Revisit conditions are triggers, not transitions.** `Revisit when`
  records an observable condition tied to an assumption or trade-off. Satisfying
  it opens review; it never changes status automatically.

## Deterministic decision facade

The plugin ships a Bash `decision` facade at `bin/decision`. It inventories ADRs,
allocates the next identifier, validates structure and relationships, checks
transitions, and emits bounded model-facing output. It does not decide whether a
choice is authoritative, material, or ADR-worthy.

- **DM-13 — Deterministic ADR inventory.** Inventory uses the selected canonical
  ADR directory, reports absolute paths, and extracts identifier, title, status,
  date, and relationships. Multiple plausible ADR directories require explicit
  selection. An empty inventory is reported honestly. Symlinked ADR directories
  or records, unsupported entry types, and filenames with unsafe control
  characters are refused rather than followed or silently omitted.
- **DM-14 — Collision-safe numbering.** The next identifier follows the highest
  numeric `ADR-NNNN` identifier found in filenames or headings and preserves at
  least four digits. Numeric identifiers are limited to 18 digits so Bash can
  compare them without overflow; wider identifiers and exhaustion of that range
  are explicit errors. Duplicate identifiers, filename/heading disagreement,
  and an already occupied proposed path are errors.
- **DM-15 — Structural validation.** Every ADR file must be readable and have a
  supported identifier, non-empty title, supported status, ISO date, exactly
  one non-empty canonical `Summary` metadata field, and non-empty `Context`,
  `Decision`, and `Consequences` sections. Required input
  that exists but is unreadable causes a clear refusal rather than being
  skipped. Under the facade's `LC_ALL=C` byte semantics, ADR titles are capped
  at 240 bytes, status and date fields at 32 bytes each, `Summary` at 500 bytes,
  `Supersedes` and
  `Superseded by` at 1,000 bytes each and 50 targets per field, and `Revisit
when` at 500 bytes.
- **DM-16 — Relationship validation.** Validation checks target existence,
  reciprocal supersession, required `Superseded` status, and cycles. Diagnostics
  name absolute paths and the smallest actionable defect rather than dumping
  raw files.
- **DM-17 — Read-only inspection.** `inspect`, `list`, `next-id`, `validate`,
  `canonical-path`, and `check-transition` never modify repository or external
  state. `canonical-path` accepts only a readable regular file inside the
  repository with no symlink component and emits its verified absolute path for
  model-facing reports. The skills make deliberate repository edits with the
  harness's ordinary file tools, then use the facade to verify them.
- **DM-18 — Portable shell behavior.** The facade and tests support Bash 5 and
  macOS `/bin/bash` 3.2, remain bounded on large input, and follow the repository
  shell-portability rules. Inventory and relationship validation are linear in
  records plus relationships subject to documented metadata and output caps.
  CLI title input is capped at 200 bytes, search input at 200 bytes, list output
  at 200 records, and validation output at 40 diagnostics plus one omitted-count
  line. `canonical-path --path` input is capped at 1,000 bytes. Paths and
  free-form filters containing any C-locale control byte are refused without
  echoing the unsafe value.
- **DM-19 — Non-authoritative ADR catalog.** An ADR directory may contain a
  checked-in `README.md` catalog derived only from the ADRs in that directory.
  It groups every ADR exactly once under the five supported lifecycle states;
  every row visibly links the canonical ADR and shows its identifier, title,
  status, date, canonical Summary, and lifecycle relationships. A fresh catalog
  answers complete inventory and status or relationship filters without parsing
  ADR bodies. Subject and full-text search deliberately scans every ADR body and
  confirms the requested case-insensitive literal; Summary text never narrows
  or substitutes for body search. The catalog is derived, never authoritative.
- **DM-20 — Fail-open discovery, fail-closed validation.** A missing,
  unreadable, unsupported, malformed, or stale catalog produces a warning
  and makes read-only discovery rebuild its in-memory inventory by scanning every
  ADR, so repositories without a catalog remain compatible and stale data cannot
  hide a record. Catalog failures never make malformed or unreadable ADRs skippable.
  `validate` and explicit freshness checks instead reject catalog drift when a
  catalog exists. Rebuild and freshness operations refuse unsafe or unreadable
  input and emit absolute model-facing paths. Rebuild refuses to replace an
  existing `README.md` that lacks the derived-catalog marker.
- **DM-21 — Deterministic catalog lifecycle.** `catalog rebuild` writes the
  complete Markdown catalog atomically in byte-stable order, and `catalog check`
  verifies its format, directory membership, fingerprints, visible metadata,
  and source ADR validity.
  Rebuilding an unchanged ADR set produces identical bytes under Bash 3.2 and
  Bash 5. Repository validation includes the same freshness check, so CI and
  manual validation reject drift. The catalog remains local to its ADR owner and
  never catalogs specifications, policies, work items, review state, or another
  owner surface.

## `capture-decision`

### Contract

Find related canonical records, classify the requested content, determine its
authority, scope, status, and sink, then create, update, or supersede exactly the
supported repository record. If persistence belongs to run or work-item state
that is unavailable, report the owner and stop without creating a substitute.

### Invariants

- **DM-C1 — Search before mutation.** Inspect the repository and search related
  ADRs, specifications, policies, and work-item context before creating or
  changing a record. Reported root surfaces are discovery candidates, not an
  exhaustive policy map: follow repository routers, referenced guidance, and
  scoped instructions applicable to the target path. A plausible canonical
  match is resolved before writing. When an accepted ADR already captures the
  same effect and no correction or lifecycle change was requested, capture is
  a read-only no-op: do not edit the ADR, create or rebuild its catalog, or
  repair unrelated drift.
- **DM-C2 — Ask only material questions.** Reuse explicit conversation and
  repository evidence. Ask only when the selected choice, authority, scope,
  status, canonical sink, or materiality cannot be established safely.
- **DM-C3 — One requested capture.** Apply only the decision capture the user
  requested. Do not commit, push, update unrelated work items, reorganize
  documentation, or repair implementation drift as side effects.
- **DM-C4 — Safe accepted records.** Do not accept an unresolved choice or
  silently rewrite accepted meaning. When no outcome has been selected and the
  user did not ask to preserve a proposal, capture is a read-only unresolved
  result: create no ADR or catalog and change no other canonical surface. Do
  not reinterpret the absence of a choice as an accepted decision to defer.
  Supersession preserves the old record and passes the deterministic
  relationship checks.
- **DM-C5 — Verify and report.** Validate affected ADRs or inspect the edited
  canonical surface before success. Report the decision, status, scope,
  authority evidence with its provenance class, canonical absolute path or
  external owner, relationships, and any unresolved follow-up or inaccessible
  owner. When the user explicitly asks to preserve provenance distinctions,
  the final response names each supplied item and its class; correctly storing
  those distinctions without reporting them is incomplete.
- **DM-C6 — Refresh the derived ADR catalog.** After creating or changing an ADR,
  rebuild `README.md` in the selected ADR directory before validation.
  Capture and a manual `catalog rebuild` use the same facade operation and must
  produce identical bytes. Specification, policy, and work-item captures do not
  create or update an ADR catalog. Rediscovering an unchanged equivalent ADR
  does not authorize catalog creation, refresh, or repair.

### Non-goals

Making the underlying product or architecture choice, running a broad
architecture review, detecting implementation drift, automatically firing
revisit triggers, committing changes, or duplicating runtime decisions.

## `list-decisions`

### Contract

Answer read-only questions about recorded decisions by subject, scope, status,
or relationship. Use the deterministic ADR inventory and inspect other relevant
canonical repository surfaces when the query is not ADR-only.

### Invariants

- **DM-L1 — Read-only.** Listing never changes repository, work-item, runtime, or
  external state.
- **DM-L2 — Query the requested scope.** Derive subject, scope, status, and
  relationship filters from the request. Do not silently restrict a general
  decision query to ADRs when specifications, scoped policies, work items,
  reviews, or run state may be authoritative. Query available read-only owner
  integrations for foreign-owned scopes. If one is unavailable, name the exact
  inaccessible owner and mark the inventory incomplete rather than substituting
  repository search.
- **DM-L3 — Canonical, compact results.** Report each matching decision once with
  subject, current status when supported, scope, canonical absolute path or
  external owner, and relevant supersession relationship. Distinguish normative
  records from proposals and references.
- **DM-L4 — Honest gaps.** State applied filters, empty results, unreadable
  required records, inaccessible foreign owners, ambiguity, and output caps.
  Never present a partial or inferred inventory as complete.
- **DM-L5 — Use catalog metadata; scan bodies for subjects.** Listing may use a
  fresh ADR catalog for complete inventory and metadata, status, or relationship
  filters without reading ADR bodies. Literal subject or full-text search always
  scans every ADR body and preserves its exact result set, including terms absent
  from Summary metadata. When catalog freshness cannot be proved, listing warns
  and scans all ADRs so stale data cannot hide a record. A catalog row is never
  itself the canonical decision.

### Non-goals

Changing status, creating or updating records, deciding whether an accepted
choice remains good, auditing implementation conformance, or performing generic
repository search unrelated to decisions.
