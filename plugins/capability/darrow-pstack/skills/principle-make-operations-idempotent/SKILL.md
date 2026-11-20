---
name: principle-make-operations-idempotent
description: Load principle-make-operations-idempotent guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply make operations idempotent

For operations that may repeat or resume after interruption, inspect existing
state and reconcile toward the intended result. Repetition should converge
instead of creating duplicate effects or assuming a pristine starting point.

Use the current state to distinguish work already complete from work still
needed. Keep the operation within its existing authority; idempotence does not
grant deletion, publication or recovery permissions.

Complete when: repeating or resuming the authorized operation converges on the
same intended state without duplicating its effects.
