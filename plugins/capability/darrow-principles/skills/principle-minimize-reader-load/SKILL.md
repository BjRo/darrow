---
name: principle-minimize-reader-load
description: Load principle-minimize-reader-load guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply minimize reader load

Notice where understanding requires excessive tracing across files, following
indirection or remembering hidden state. Make the important relationship and
state visible near the decision that uses them.

Reduce indirection and remembered state when doing so clarifies the accepted
task. Preserve meaningful domain structure rather than flattening it merely
to reduce line count.

Complete when: a reader can follow the relevant decision with less tracing and
less state to remember, without losing its meaning.
