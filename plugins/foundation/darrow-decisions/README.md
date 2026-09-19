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

### `darrow-decision`

A contained Python package shared by both skills. It discovers ADRs, validates
their structure and relationships, allocates collision-safe identifiers, and
supports deterministic inspection and filtering. A checked-in Markdown
`README.md` beside the ADRs catalogs every record's canonical Summary, status,
and lifecycle relationships for human-readable inventory and metadata filters.
Literal subject and full-text searches deliberately scan every canonical ADR
body. The facade is deliberately narrow: agents retain judgment about whether
something is a decision and where it belongs.

Build and verify the derived ADR-only catalog with:

```sh
uv run --quiet --frozen --no-dev --project backend darrow-decision catalog rebuild --repo /absolute/path/to/repository
uv run --quiet --frozen --no-dev --project backend darrow-decision catalog check --repo /absolute/path/to/repository
uv run --quiet --frozen --no-dev --project backend darrow-decision validate --repo /absolute/path/to/repository
```

Rebuilds are byte-deterministic and atomic. `validate` rejects a stale checked-in
catalog. Read-only listing instead warns and full-scans when the catalog is
missing, unreadable, malformed, or stale, preserving compatibility with
repositories that have not adopted the catalog and ensuring stale catalog data
cannot hide a decision.

Freshness fingerprints raw worktree bytes, so Git clean filters and index
refreshes cannot hide changed ADR metadata. Metadata filters still use the
catalog without parsing ADR bodies. Older v1 catalogs warn and fall back until
`catalog rebuild` upgrades them to v2. Historical supersession links remain valid
when an accepted replacement later becomes Deprecated or Superseded.

## Design boundaries

- `Accepted` always requires explicit user or repository authority; the plugin
  does not turn model confidence or code frequency into policy.
- One decision has one canonical effect. Other documents may point to it but
  should not restate it as a second source of truth.
- Listing is read-only, and capture changes only the one decision requested.
- The ADR catalog is derived, non-authoritative, and limited to its owning ADR
  directory; it never catalogs specifications, policies, or external owners.
- Work-item and review decisions remain owned by their respective systems.

## When to use

Capture one explicit decision or find existing decisions. Do not infer accepted policy from code frequency.

## Hosts and prerequisites

Codex and Claude Code;
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
Git, and access to authoritative decision records. The CLI runs natively on
Windows, Linux, and macOS. Runtime
dependencies are empty; quality tools are locked in the development group.
The plugin has no Bash runtime entrypoint or sibling-plugin dependency.

## Installation

Install `darrow-decisions@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> What have we decided about authentication?

To select it explicitly, choose `list-decisions` from Codex's `$` skill menu,
or use `/darrow-decisions:list-decisions` in Claude Code, followed by your request.

## Expected result

Listing returns evidence without changes. Capture writes the requested canonical decision; acceptance requires explicit authority.

## Troubleshooting

A stale ADR catalog fails validation. Use the catalog commands above for an authorized rebuild. Read-only listing warns and scans canonical records instead.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
