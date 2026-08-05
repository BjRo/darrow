---
name: capture-decision
description: Capture or maintain one explicit decision at its authoritative scope without duplicating another canonical record. Use when the user says "record this decision", "capture what we decided", "write an ADR", "document this architecture choice", "correct ADR metadata", "supersede this ADR", or otherwise asks to preserve or maintain a settled repository, product, policy, or work-item choice.
---

# capture-decision

Capture one explicit choice in the canonical surface its consumers must follow.

Use the `decision` facade at `<skill-dir>/../../bin/decision`, where
`<skill-dir>` is the directory containing this `SKILL.md`. Run it with Bash.
It owns ADR discovery, inventory, numbering, structural validation, lifecycle
checks, and relationship integrity. A facade refusal is authoritative: relay it
and stop or correct the proposed record. Do not reimplement those mechanics.

## Final response contract

End every capture attempt with this compact record, including refusals and
metadata-only corrections:

`Decision: <effect> | status: <status> | scope: <scope> | authority: <evidence> (<provenance class>) | path/owner: <absolute path or external owner> | relationships: <relationships or none> | persistence: <confirmed or exact gap>`

For a refusal or unresolved choice, use truthful values such as `unresolved`,
`not established`, or `no canonical sink selected`; never fill a field by
inference merely to complete the record. The `persistence` field must state the
exact refusal or gap.

For a repository record, resolve and copy its absolute canonical path before
responding. A repository-relative path, bare ADR identifier, or Markdown link
with relative destination does not satisfy this contract, even when the user
named that shorthand. Keep the decision effect and metadata correction, when
applicable, explicit in the same record.

## Ownership stops

Apply these before any repository write:

- A work-item-local choice stays in that work item. If its integration is
  available, inspect the exact work item and attempt the authorized persistence
  operation there. Never infer integration absence from repository contents:
  try the appropriate installed owner integration first. The facade's
  repository-surface inventory does not inventory external integrations. When
  the request names GitHub, probe the installed `gh` owner interface even if
  `inspect` reports no work-item surface. Establish the canonical `owner/repo`
  plus issue or pull-request number from the request, work-item URL, repository
  remote, or owner integration before mutation. Invoke the exact target with
  `--repo <owner/repo>` or its full URL (for example,
  `gh issue view <id> --repo <owner/repo>` or an authorized
  `gh issue comment <id> --repo <owner/repo>`), not `gh --version`, a bare issue
  number, or another generic availability probe. If the repository identity is
  not discoverable, report it as not established and ask rather than guessing.
  A failed generic probe does not establish that the exact owner target is
  unavailable. If that target-specific attempt is
  unavailable, report the exact work-item identifier, owning system, intended
  persistence operation, and gap, then stop instead of promoting it to
  repository architecture. A backend error may support that report but must
  not replace this context.
- Normative product or capability behavior belongs in the governing
  specification only. Do not add an ADR by default. Add one only when the user
  separately asks to preserve architectural rationale and the rationale comes
  from explicit evidence; never invent rationale to justify a second record.
- A semantically equivalent accepted canonical record is already captured. Do
  not create a duplicate or rewrite it merely for freshness. A specifically
  requested non-semantic correction to spelling, formatting, links, or metadata
  may still update that record after its authority and unchanged effect are
  verified.

## Workflow

1. Run `bash <skill-dir>/../../bin/decision inspect`. Its reported policy and
   specification surfaces are discovery candidates, not an exhaustive map.
   Follow repository routers, referenced guidance, and scoped instructions for
   the target path. Inspect conversation and repository evidence before asking
   for facts that are locally discoverable.
2. Search before writing:
   `bash <skill-dir>/../../bin/decision list --search <distinctive-subject>`.
   Also search the specification and policy surfaces reported by `inspect`, plus
   relevant work-item context through an installed owner integration. A named
   backend determines which owner integration to try; do not treat its omission
   from facade output as proof that it is unavailable. Resolve a plausible
   canonical match first.
3. Classify the content as a settled decision, observation, preference,
   assumption, recommendation, or open question. A model inference is never an
   accepted decision.
4. Establish the selected choice, explicit authority, scope, lifetime, status,
   and one canonical sink. Label the provenance of supporting material as a
   repository fact, user statement, model inference, or assumption. Ask only
   when one of those would materially change what is recorded.
5. Route the effect:
   - Ticket- or PR-local choice → keep it in that work item. Use an available
     integration only when the requested mutation is authorized; otherwise name
     the target and content still needing persistence.
   - Durable repository architecture → update the related ADR or create one.
   - Normative product or capability behavior → update only the governing
     specification unless the separately authorized rationale exception applies.
   - Durable policy → update its existing authoritative guidance surface.
   - Unresolved architecture proposal → `Proposed` only, and only when the user
     wants a proposal recorded.
6. For a new ADR, run
   `bash <skill-dir>/../../bin/decision next-id --dir <adr-dir> --title <title>`.
   Use the returned identifier and absolute path verbatim—do not remove the
   `ADR-` prefix or normalize the filename. Every file created in an ADR
   directory, including a `Proposed` record, is an ADR and must preserve the
   compact structure `Status`, `Date`, `Context`, `Decision`, and
   `Consequences`; add
   `Supersedes`, `Superseded by`, or `Revisit when` only when applicable.
7. Before a status change, run
   `bash <skill-dir>/../../bin/decision check-transition --from <old> --to <new>`.
   An accepted decision's meaning is immutable: spelling, formatting, links,
   and metadata may be corrected, but a material replacement requires a new
   accepted ADR plus reciprocal supersession metadata on the old record.
8. After an ADR edit, run
   `bash <skill-dir>/../../bin/decision validate --dir <adr-dir>`. For a
   specification or policy edit, reread the exact changed surface and its
   routing context before reporting success. Never report a created or updated
   ADR as successful unless validation prints `valid`; correct a validation
   failure and rerun it first.
9. For a repository sink, make the final tool action before responding
   `bash <skill-dir>/../../bin/decision canonical-path --path <record>` and copy
   its `path:` value verbatim into the final response. Do not shorten it after
   that command. Then report the decision, status, scope, authority evidence and
   its provenance class, canonical absolute path or external owner,
   relationships, and any unresolved persistence gap. The report is incomplete
   unless it explicitly names the authorizing user or repository authority and
   labels that evidence's provenance class.

## Judgment

- `Accepted` requires an explicit current user choice or existing repository
  authority. Frequency, recency, an agent recommendation, and apparent
  consensus do not qualify.
- Search related ADRs, specifications, policies, and work-item context. A
  reference to a decision is not a second authority. Follow scoped repository
  guidance rather than assuming root policy filenames are exhaustive.
- Keep the narrowest supported scope. A temporary implementation choice does
  not become architecture or policy by default.
- `Rejected` means a proposal never took effect. `Deprecated` once applied but
  is no longer recommended without a named replacement. `Superseded` requires a
  reciprocal named replacement.
- `Revisit when` is an observable trigger for future review, not an automatic
  status change.

## Boundaries

- Capture exactly one requested decision. Do not reorganize documentation,
  review implementation drift, or update unrelated work items.
- Never silently replace accepted meaning or accept an unresolved alternative.
- Never rewrite an observation, model inference, or assumption as user-provided
  rationale or repository authority.
- Never commit, push, or install another plugin as part of capture.
