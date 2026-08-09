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
supports deterministic inspection and filtering. The facade is deliberately
narrow: agents retain judgment about whether something is a decision and where
it belongs.

## Design boundaries

- `Accepted` always requires explicit user or repository authority; the plugin
  does not turn model confidence or code frequency into policy.
- One decision has one canonical effect. Other documents may point to it but
  should not restate it as a second source of truth.
- Listing is read-only, and capture changes only the one decision requested.
- Work-item and review decisions remain owned by their respective systems.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
