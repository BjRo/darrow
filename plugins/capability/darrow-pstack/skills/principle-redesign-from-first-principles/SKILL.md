---
name: principle-redesign-from-first-principles
description: Load principle-redesign-from-first-principles guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply redesign from first principles

When a requirement conflicts with an abstraction or produces repeated special
cases, consider how the design would look if that requirement had existed
originally. Compare that coherent shape with the existing design and choose
the smallest change that properly accommodates the requirement.

Preserve accepted scope and compatibility obligations. This question does not
authorize a broad rewrite. If a broader redesign is necessary for the accepted
outcome, explain why and return that scope decision to the owner before
expanding implementation.

Complete when: the requirement fits a coherent design and any necessary scope
or compatibility decision remains explicit.
