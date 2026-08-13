# ADR-0003: Treat plugins as optionality boundaries

Status: Accepted
Date: 2026-08-13
Summary: Treat each plugin as a self-contained unit of adoption, compatibility, and ownership that composes through host-visible contracts rather than sibling dependencies.

## Context

Darrow is a marketplace whose plugins can be adopted independently. Consumers
sometimes benefit from behavior another plugin can provide, such as ticket
operations, independent review, or Git publication. Directly naming a sibling
plugin's files or assuming its installation would turn those useful
combinations into hidden package dependencies and make partial marketplace
adoption unreliable.

A monolithic bundle or mandatory dependency graph would simplify some internal
calls, but it would remove user choice and couple each capability's release and
compatibility surface to the rest of Darrow. The alternative already expressed
through the capability specifications and [design principles](../design.md) is
semantic composition through facilities the host exposes at runtime.

## Decision

Treat each plugin as Darrow's unit of adoption, compatibility, and ownership.

- Every plugin is self-contained and independently installable. It must not
  reference files outside itself, name a sibling implementation as a runtime
  prerequisite, or assume another Darrow plugin is installed.
- Plugins cooperate through host-visible intent and, where deterministic
  compatibility is required, runtime-discovered capability contracts.
- A consumer requests the behavior it needs without prescribing the provider's
  plugin path, command, result serialization, or internal workflow.
- When an optional capability is unavailable, the consumer follows its own
  documented stop or fallback contract instead of reaching into another plugin
  or silently inventing a substitute.
- Shared repository development infrastructure may support plugin development,
  but it is not a runtime dependency shipped across plugin boundaries.

Normative provider and consumer behavior remains in each applicable capability
specification. This ADR owns the architectural reason those contracts cannot
be implemented as sibling-plugin dependencies.

## Consequences

- Users can install one focused capability without accepting the rest of the
  marketplace or an implicit control plane.
- Plugins can evolve and release independently as long as their public intent
  and declared capability contracts remain compatible.
- Composition depends on honest runtime discovery and explicit unavailable
  behavior rather than compile-time certainty.
- Some small mechanics or explanatory context may be repeated inside separate
  plugins because sharing a private helper would violate the adoption boundary.
- New cross-plugin integrations must define a semantic contract or remain an
  optional host-level composition.
