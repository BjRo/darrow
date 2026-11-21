---
name: principle-laziness-protocol
description: Load principle-laziness-protocol guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply laziness protocol

Choose the smallest complete solution for the accepted task. Before adding an
abstraction, layer, option or threaded signal, identify the concrete decision
it removes or the behavior it enables.

Consolidate repeated decisions instead of making every caller remember them.
Keep a direct implementation when a new layer would add more concepts than it
removes. Completeness includes the task's required behavior and verification,
not infrastructure for hypothetical future work.

Complete when: the accepted outcome is complete and repeated decisions live
in one suitable place without unnecessary layers.
