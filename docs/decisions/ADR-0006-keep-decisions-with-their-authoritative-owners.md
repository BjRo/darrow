# ADR-0006: Keep decisions with their authoritative owners

Status: Accepted
Date: 2026-08-13

## Context

Decisions arise at different scopes and lifetimes. A ticket-local implementation
choice is consumed by one work item, a capability invariant governs product
behavior, a repository policy governs contributors, and a durable architecture
choice affects the repository beyond one implementation. External trackers and
review systems also own state that a repository file cannot faithfully replace.

A central Darrow decision database would make listing simple, but it would copy
effects away from the surfaces their consumers already obey. The copies could
drift, erase lifecycle status, or falsely claim authority over foreign-owned
state. Storing every explicit choice as an ADR would similarly elevate local or
normative product choices into repository architecture.

## Decision

Keep each decision at the narrowest durable authoritative owner whose consumers
must obey its effect.

- Ticket- or review-local implementation choices remain in the owning work item
  or review system.
- Normative product and capability behavior remains in the applicable
  specification.
- Durable team or repository policy remains in its authoritative policy or
  scoped guidance surface.
- Durable repository architecture is recorded in an existing related ADR or a
  new ADR when none exists.
- Unresolved alternatives remain proposals or open questions until explicit
  authority selects an outcome.
- One effect has one canonical sink. Other surfaces may reference it but do not
  become competing authorities, and Darrow does not create a generic decision
  database or file-backed substitute for a foreign owner.
- Read-only decision discovery may query several owner surfaces and deduplicate
  their effects. An inaccessible requested owner makes the inventory incomplete
  rather than absent.

The detailed classification, lifecycle, mutation, and listing behavior remains
normative in [Capability: Decision Management](../specs/decision-management.md).
This ADR owns the repository-architecture rationale for distributed canonical
ownership.

## Consequences

- Consumers find governing effects where they already obtain authority for that
  scope.
- Capturing a decision requires classifying its authority, scope, lifetime, and
  owner before writing.
- Repository-wide inventories require discovery across specifications,
  policies, ADRs, and available external owners instead of reading one database.
- Missing integrations and unreadable owners must be reported honestly; local
  search cannot prove foreign state absent.
- Material changes amend or supersede the existing canonical owner rather than
  create a duplicate record at a more convenient scope.
