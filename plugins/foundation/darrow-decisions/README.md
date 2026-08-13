# Darrow Decisions

This plugin treats decisions as durable authority, not as notes scattered across
an agent conversation. It helps agents distinguish a settled choice from an
observation or recommendation, place that choice at the narrowest canonical
scope, and preserve its provenance and lifecycle.

It works with the repository's existing decision surfaces—ADRs, normative
specifications, scoped policy, work items, and review state—rather than creating
a separate Darrow decision store.

## What it provides

### `capture-decision`

Records or maintains exactly one explicit decision. The skill searches for an
existing canonical record, selects the correct owner, enforces the authority
required for an accepted decision, and handles corrections and supersession
without duplicating the decision's effect.

Example: _“Record our decision to keep audit events for 90 days.”_

### `list-decisions`

Answers read-only questions about recorded decisions across the relevant
canonical surfaces. It supports subject, scope, status, owner, and supersession
queries while reporting each authoritative effect only once.

Example: _“What have we decided about authentication?”_

### `bin/decision`

A portable Bash facade shared by both skills. It discovers ADRs, validates
their structure and relationships, allocates collision-safe identifiers, and
supports deterministic inspection and filtering. A checked-in
`.darrow-adr-index` beside the ADRs can route literal searches to a small
candidate set; every returned match is still confirmed from its canonical ADR
body. The facade is deliberately narrow: agents retain judgment about whether
something is a decision and where it belongs.

Build and verify the derived ADR-only index with:

```sh
bash bin/decision index rebuild --repo /absolute/path/to/repository
bash bin/decision index check --repo /absolute/path/to/repository
bash bin/decision validate --repo /absolute/path/to/repository
```

Rebuilds are byte-deterministic and atomic. `validate` rejects a stale checked-in
index. Read-only literal listing instead warns and full-scans when the index is
missing, unreadable, malformed, or stale, preserving compatibility with
repositories that have not adopted the index and ensuring stale routing data
cannot hide a decision.

## Design boundaries

- `Accepted` always requires explicit user or repository authority; the plugin
  does not turn model confidence or code frequency into policy.
- One decision has one canonical effect. Other documents may point to it but
  should not restate it as a second source of truth.
- Listing is read-only, and capture changes only the one decision requested.
- The routing index is derived, non-authoritative, and limited to its owning ADR
  directory; it never indexes specifications, policies, or external owners.
- Work-item and review decisions remain owned by their respective systems.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
