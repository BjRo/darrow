---
name: principle-migrate-callers-then-delete-legacy-apis
description: Load principle-migrate-callers-then-delete-legacy-apis guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply migrate callers then delete legacy apis

When an internal API can be removed without an old-API compatibility
obligation, migrate all its callers first. Include tests, examples and
documentation, then remove the legacy API and verify the originally intended
entrypoints still work.

Caller coverage alone does not remove an external compatibility obligation.
Preserve required public APIs and forwarding entrypoints, and use a compatible
transition where those obligations exist.

Complete when: internal callers use the intended API, removable legacy surface
is gone, and required external or forwarding compatibility remains verified.
