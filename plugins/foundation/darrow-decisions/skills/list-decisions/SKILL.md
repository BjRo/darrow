---
name: list-decisions
description: Find recorded decisions read-only across ADRs, specifications, policies, work items, and review state. Use for decision inventories, subject or status filters, and supersession queries.
---

# List decisions

Answer the requested decision question from canonical records without changing
repository or external state.

Use the `decision` facade at `<skill-dir>/../../bin/decision`, where
`<skill-dir>` contains this file. Run it with Bash. The facade owns ADR
discovery, catalog freshness, validation, filtering, relationships, and output
caps. Treat an unreadable or malformed required record as a refusal rather than
a skippable result. The catalog is derived metadata, never a canonical decision
surface.

## Working model

- **Canonical effect:** report the authoritative effect once. A document that
  merely links to it is a reference, not another result. A specification may
  still own a different normative effect beside its ADR reference.
- **Silent filter:** inspect candidates as needed, but expose only matches.
  Excluded identifiers, titles, paths, and effects stay out of the response.
- **Complete inventory:** a requested foreign owner that cannot be queried makes
  the overall result `incomplete`, even when repository results are available.
- **Actual status:** preserve the record's status. Confident language, code
  frequency, or a model recommendation does not imply `Accepted`.

## Workflow

### 1. Bound the question

Derive the requested subject, scope, status, owner, relationship, and result
limit. Treat an explicitly ADR-only request as ADR-only; otherwise include every
canonical surface that could own the requested scope.

**Complete when:** each requested dimension has a value or is explicitly
unfiltered, and the intended owner set is known.

### 2. Discover canonical surfaces

Run:

```sh
bash <skill-dir>/../../bin/decision inspect
bash <skill-dir>/../../bin/decision list [--dir <adr-dir>] \
  [--status Proposed|Accepted|Rejected|Deprecated|Superseded] \
  [--search <subject>] [--related-to <ADR-NNNN>] [--limit <n>]
```

For an inventory, status filter, or relationship filter, the facade may answer
from a fresh `README.md` ADR catalog without reading ADR bodies. A literal
subject or full-text filter always scans every ADR body, including when the term
is absent from every Summary. A missing, unreadable, malformed, or stale catalog
warns and safely falls back to a full ADR scan. Do not suppress that warning,
treat catalog rows as decision authority, or report the catalog as the canonical
record.

Follow repository routers, referenced guidance, aliases, and scoped
instructions relevant to the query. Reported root policy files are discovery
candidates, not an exhaustive map. For a broad concept, follow semantic aliases
and references. If literal ADR search is empty, inspect the bounded unfiltered
ADR inventory before concluding there is no semantic match.

Unless the request is ADR-only, search applicable specification and policy
surfaces and classify each match as a governing effect, unresolved proposal,
historical context, or reference. Query requested work-item and review owners
through their read-only integration. Name an inaccessible exact owner and mark
the inventory incomplete; repository search cannot substitute for foreign-owned
state.

**Complete when:** every requested canonical surface is inspected or named as
inaccessible, every literal subject result comes from the facade's full-body
scan, and every plausible semantic ADR match is resolved.

### 3. Build a deduplicated result set

Keep one entry per canonical effect. Use these scope classes where applicable:
`repository architecture`, `normative capability behavior`, `contributor
policy`, or the exact external owner scope. Preserve supersession direction and
place relevant relationships on the owning result.

An empty set is valid. Retain the applied filters and inspected surfaces so the
response can explain its coverage without naming excluded records.

**Complete when:** each matching effect has exactly one owner, actual status,
scope, and relationship set, with no excluded record in the draft.

### 4. Verify paths and report

For every repository result, run:

```sh
bash <skill-dir>/../../bin/decision canonical-path --path <record>
```

Copy each emitted `path:` value verbatim. Every displayed repository path must
be that existing absolute filename, including paths inside Markdown.

Render each result as one physical line:

`- <subject and effect> | status: <actual status or no recorded status> | scope: <scope> | path/owner: <absolute path or owner> | relationships: <value or none>`

State filters, caps, ambiguity, and inaccessible owners separately. Call the
overall inventory `incomplete` whenever a requested owner was inaccessible.
For an empty result, state the filters and canonical surfaces inspected.

Finish with a **silent-filter audit**: remove every excluded identifier, title,
path, effect, and exclusion explanation. Keep only criteria and surface names in
the coverage summary.

**Complete when:** every result occupies one line, every repository path is
facade-verified and absolute, the requested coverage is explicit, and excluded
records are absent from the entire response.

Keep this operation read-only and scoped to recorded decisions. Evaluation of
decision quality, implementation conformance, and unrelated repository content
belongs to separate work.
