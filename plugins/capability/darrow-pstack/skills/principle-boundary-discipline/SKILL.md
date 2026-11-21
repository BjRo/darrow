---
name: principle-boundary-discipline
description: Load principle-boundary-discipline guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply boundary discipline

Validate data at trust boundaries and at state boundaries where prior
guarantees can become invalid. Pass validated domain values inward, keep
adapters thin, and make business logic independently testable.

Avoid repeated validation when an existing guarantee still holds. Retain
domain invariants and checks after state changes invalidate earlier
guarantees. Removing redundant checks does not authorize trusting unvalidated
external input or ignoring legitimate invalid states.

Complete when: each relevant boundary establishes its guarantee and inner
logic can rely on it without losing necessary invariants.
