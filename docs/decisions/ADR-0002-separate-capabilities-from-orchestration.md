# ADR-0002: Separate capabilities from orchestration

Status: Accepted
Date: 2026-08-13

## Context

Darrow packages both focused agent procedures and longer-running delivery
helpers as independently adoptable plugins. Those surfaces have different
effects on a session. A focused procedure can satisfy matching user intent
without taking ownership of unrelated work, while orchestration establishes a
continuation and completion contract that can extend the session, consume
material model budget, and coordinate later actions.

Treating both kinds of plugin as implicitly selectable would make installing a
capability an implicit opt-in to a control plane. Treating every capability as
a required orchestration phase would also couple focused procedures to one
delivery model. The repository's capability specifications and
[design principles](../design.md) already rely on a stable activation boundary.

## Decision

Separate intent-matched capabilities from explicitly invoked orchestration.

- A capability owns one coherent kind of work and its invariants. The model may
  select it from matching user intent, the user may name it directly, and an
  explicitly invoked workflow may compose it through its public intent or
  contract.
- Orchestration owns continuation and completion around work. It starts only
  through explicit user invocation and is never inferred merely from task
  complexity, duration, or number of steps.
- Orchestration may use compatible installed capabilities, but it does not make
  every capability a mandatory phase or transfer its own activation model to
  them.
- `foundation`, `capability`, and `orchestration` are marketplace and repository
  ownership roles. `foundation` is not a third activation model; foundation
  skills remain intent-matched capabilities.

Normative behavior remains in the applicable capability specification. This
ADR owns the cross-cutting product-architecture rationale for the activation
and ownership split.

## Consequences

- Installing a review, Git, ticket, or foundation plugin does not opt the user
  into a long-running controller.
- Focused capabilities remain directly useful and independently evolvable.
- Orchestration can evolve without absorbing capability implementations into a
  monolithic workflow.
- Users must explicitly request orchestration even when a task appears complex
  enough that orchestration might help.
- New Darrow surfaces must be classified by the ownership they assume and use
  the corresponding activation model.
