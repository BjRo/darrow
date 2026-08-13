---
name: capture-decision
description: Capture one explicit decision or maintain its lifecycle at the canonical scope. Use for recording a settled choice, recording an architecture proposal, correcting decision metadata, or superseding an accepted decision.
---

# Capture a decision

Persist exactly one explicit choice where its consumers must follow it.

Use the `decision` facade at `<skill-dir>/../../bin/decision`, where
`<skill-dir>` contains this file. Run it with Bash. The facade owns ADR
discovery, numbering, structural validation, lifecycle transitions, and
relationship integrity. Treat a facade refusal as authoritative: correct the
candidate or report the refusal.

## Working model

- **Authority gate:** `Accepted` requires an explicit current user choice or
  existing repository authority. An observation, preference, assumption,
  recommendation, open question, model inference, frequency, or apparent
  consensus does not pass the gate.
- **Canonical sink:** record the effect once, at the narrowest durable scope
  whose consumers must obey it. A reference to that effect is not another
  authority.
- **Provenance:** label supporting material as `user statement`, `repository
  fact`, `assumption`, or `model inference`. Preserve those distinctions in the
  record and report.
- **Accepted meaning:** spelling, formatting, links, and metadata may be
  corrected in place. A material replacement requires a new accepted ADR and
  reciprocal supersession metadata.

## Workflow

### 1. Select the canonical sink

Run:

```sh
bash <skill-dir>/../../bin/decision inspect
```

Treat reported policy and specification surfaces as discovery candidates.
Follow repository routers, referenced guidance, and scoped instructions for the
target path. Use conversation and repository evidence before asking for facts
that are locally discoverable.

Route the effect:

| Scope | Canonical sink |
| --- | --- |
| Ticket- or PR-local implementation choice | Existing work item |
| Durable repository architecture | Existing related ADR, or a new ADR |
| Normative product or capability behavior | Governing specification |
| Durable policy | Existing authoritative policy or guidance surface |
| Unresolved architecture proposal | `Proposed` ADR, only when requested |

For a work-item sink, read
[`references/work-item-ownership.md`](references/work-item-ownership.md)
completely before accessing its owner integration.

A governing specification receives normative behavior directly. Create an ADR
for that behavior only when the user separately requests durable architectural
rationale and explicit evidence supplies that rationale.

**Complete when:** exactly one supported scope and canonical sink are identified,
or the exact ownership gap is known before any write.

### 2. Resolve existing authority

Search before writing:

```sh
bash <skill-dir>/../../bin/decision list --search <distinctive-subject>
```

Also search the applicable specification, policy, scoped guidance, and—when
relevant—the work item. Resolve every plausible canonical match. A semantically
equivalent accepted record is already captured; leave it unchanged unless the
user requested a verified non-semantic correction.

Classify the requested content and establish its selected choice, authority,
scope, expected lifetime, status, provenance, and relationships. Ask only when
an unknown value would materially change the effect or sink. Preserve an
unselected alternative as unresolved rather than accepting it.

**Complete when:** no plausible canonical match remains unexamined and every
field that could change the recorded effect has explicit evidence.

### 3. Persist one effect

- **Existing work item:** use its owner integration as specified in the work-item
  reference.
- **Specification or policy:** edit only the existing authoritative surface at
  the selected scope.
- **New ADR:** obtain its identifier and absolute path verbatim:

  ```sh
  bash <skill-dir>/../../bin/decision next-id --dir <adr-dir> --title <title>
  ```

  Keep the returned `ADR-` filename. Write `Status`, `Date`, `Context`,
  `Decision`, and `Consequences`; add `Supersedes`, `Superseded by`, or `Revisit
  when` only when applicable. `Revisit when` is an observable review trigger,
  never an automatic transition.
- **Lifecycle change:** validate it first:

  ```sh
  bash <skill-dir>/../../bin/decision check-transition --from <old> --to <new>
  ```

  `Rejected` never took effect. `Deprecated` once applied but has no named
  replacement. `Superseded` requires reciprocal links to the named replacement.

Keep the mutation to the requested decision. Leave implementation drift,
unrelated documentation, commits, pushes, and plugin installation outside this
capture.

After any ADR creation or edit, refresh its directory's derived routing data
with the same operation used for a manual rebuild:

```sh
bash <skill-dir>/../../bin/decision index rebuild --dir <adr-dir>
```

This creates or replaces only `.darrow-adr-index` beside the ADRs. Do not build
an index for specifications, policies, work items, review state, or another
owner surface. Treat an unreadable index or ADR input as a refusal rather than
silently leaving stale routing data.

**Complete when:** one canonical effect is persisted without changing unrelated
state, every ADR mutation has refreshed its local routing index, or a truthful
unresolved/refusal result is ready.

### 4. Prove persistence

For ADR changes, require both:

```sh
bash <skill-dir>/../../bin/decision index check --dir <adr-dir>
bash <skill-dir>/../../bin/decision validate --dir <adr-dir>
```

Success requires the literal `valid` result. For a specification or policy,
reread the exact changed surface and its routing context. For a work item,
refetch and compare the owner state as described in its reference.

For a repository sink, make this the final tool action before responding:

```sh
bash <skill-dir>/../../bin/decision canonical-path --path <record>
```

Copy the emitted `path:` value verbatim; keep it absolute.

End every attempt—including refusals and metadata-only corrections—with:

`Decision: <effect> | status: <status> | scope: <scope> | authority: <evidence> (<provenance class>) | path/owner: <absolute path or external owner> | relationships: <relationships or none> | persistence: <confirmed or exact gap>`

Use truthful placeholders such as `unresolved`, `not established`, or `no
canonical sink selected`. Name the authorizing user or repository authority.
For a refusal, put the exact refusal or persistence gap in `persistence`.

**Complete when:** the report accounts for the effect, status, scope, authority
and provenance, canonical path or owner, relationships, and proven persistence
without inferred filler.
