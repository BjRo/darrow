---
name: principle-model-the-domain
description: Load principle-model-the-domain guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply model the domain

When logic repeatedly branches on state or assumes the same data shape,
encode the underlying rule in a suitable structure. Make valid states,
relationships and transitions easier to express directly.

Replace scattered conditions with a model that serves the current task.
Keep the model proportionate to the domain facts rather than introducing a
general domain framework for possible future work.

Complete when: the relevant domain rules are visible in the structure and
callers no longer need to reconstruct them from scattered branching.
