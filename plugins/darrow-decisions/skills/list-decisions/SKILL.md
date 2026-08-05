---
name: list-decisions
description: List and find recorded decisions by subject, scope, status, owner, or supersession relationship without changing them. Use when the user asks "what did we decide", "list the architecture decisions", "find decisions about X", "which ADR superseded this", "show proposed decisions", or otherwise asks what authoritative repository, policy, work-item, or review choices exist.
---

# list-decisions

Answer decision questions read-only and identify each result's canonical scope.

Use the `decision` facade at `<skill-dir>/../../bin/decision`, where
`<skill-dir>` is the directory containing this `SKILL.md`. Run it with Bash.
The facade owns ADR discovery, validation, filtering, relationships, caps, and
compact output. Relay a facade refusal; never skip an unreadable or malformed
required record.

Every displayed repository path must be the exact absolute path returned by the
facade or `inspect`. Never shorten it to a repository-relative path, including
inside Markdown links or code spans.

## Workflow

1. Run `bash <skill-dir>/../../bin/decision inspect` to inventory ADR,
   specification, and policy discovery candidates. Follow repository routers,
   referenced guidance, and scoped instructions applicable to the query; root
   policy filenames are not an exhaustive policy map.
2. Derive the requested ADR filters and run:
   `bash <skill-dir>/../../bin/decision list [--dir <adr-dir>]
   [--status Proposed|Accepted|Rejected|Deprecated|Superseded]
   [--search <subject>] [--related-to <ADR-NNNN>] [--limit <n>]`.
   For a broad concept, follow aliases and references discovered in governing
   surfaces. If a literal search returns no ADRs, inspect the bounded
   unfiltered ADR inventory before concluding there is no semantic match; never
   expose the unrelated candidates used for filtering.
3. When the request is not explicitly ADR-only, search the reported
   specification and policy surfaces for the subject. Inspect matches closely:
   distinguish a governing decision from historical context, an unresolved
   proposal, or a reference to another canonical record.
4. When the requested scope includes work items or reviews, query
   an available read-only owner integration. If it is unavailable, name that
   exact inaccessible owner and say the inventory is incomplete; do not infer
   foreign-owned state from repository files. The facade inventories repository
   surfaces only.
5. Report each matching decision once. Use one compact result line per
   canonical record containing subject/effect, actual status (or explicitly
   `no recorded status`), scope, and canonical absolute path or external owner;
   add relevant supersession relationships on that same line. Do not split one
   record's fields across a table and later prose. State the filters, any cap or
   ambiguity, and any inaccessible owner separately. When any requested owner
   is inaccessible, explicitly call the overall inventory `incomplete`;
   listing only the accessible portion is not a complete result.

   Use scope values such as `repository architecture`, `normative capability
   behavior`, or `contributor policy`, not merely a surface name. Required
   result shape (one physical line per result; no multi-line table or
   continuation prose):

   `- <subject and effect> | status: <actual status or no recorded status> | scope: <scope> | path/owner: <absolute path or owner> | relationships: <value or none>`

   A specification that references an ADR can still own a different normative
   effect. Report that effect on its own result line and treat the ADR link only
   as a reference. Do not add an excluded-items section; filter silently.
   Before responding, verify each displayed repository path exists and matches
   the exact discovered absolute filename, then delete every mention of an
   excluded record, including bare identifiers in summaries.
6. Run a final response audit. For every displayed repository record, run
   `bash <skill-dir>/../../bin/decision canonical-path --path <record>` and copy
   its `path:` value verbatim; this verifies a regular in-repository record and
   rejects symlinked or escaping paths. Then scan the draft and remove each
   excluded identifier, title, path, effect, and “X was excluded” statement.
   Filter summaries may name criteria and inspected surfaces only.

## Judgment

- ADRs normally represent durable architecture. Specifications own normative
  product and capability behavior; policy and repository guidance own durable
  team rules; work items own local implementation choices.
- Do not infer `Accepted` from confident wording, code frequency, or a model
  recommendation. Preserve the record's actual status and authority.
- A document that merely links to a decision is not a second result. Prefer the
  canonical effect and mention useful references only as references.
- An empty result is an answer. State which subject, scope, status, and relation
  filters were applied and which canonical surfaces were inspected.

## Boundaries

- Read-only: never create, edit, accept, reject, deprecate, or supersede a
  decision while listing.
- Do not turn listing into a review of whether the choice is still good or
  whether implementation conforms.
- Do not silently restrict a general decision question to ADRs when a
  specification, scoped policy, work item, or review may be authoritative.
- Do not perform generic repository search unrelated to recorded decisions.
- Do not enumerate or name unrelated records, even as examples of what a filter
  excluded. Before responding, remove every excluded identifier, title, path,
  and effect; state only that the subject filter omitted unrelated records.
