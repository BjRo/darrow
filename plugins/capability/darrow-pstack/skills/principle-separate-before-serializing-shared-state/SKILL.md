---
name: principle-separate-before-serializing-shared-state
description: Load principle-separate-before-serializing-shared-state guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply separate before serializing shared state

When concurrent work mutates the same object, first ask whether that sharing
is necessary. Separate independent ownership and state before adding locks,
serialization or other coordination.

Keep coordination where the task truly requires shared mutable state.
Removing needless sharing simplifies the problem; it does not waive necessary
concurrency guarantees or the host's execution permissions.

Complete when: only necessary sharing remains and the retained shared behavior
has the coordination its contract requires.
