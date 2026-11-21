---
name: principle-type-system-discipline
description: Load principle-type-system-discipline guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply type system discipline

Choose the simplest adequate types and signatures that prevent meaningful
mistakes. Express important variants and noninterchangeable values directly;
derive types from an authoritative schema when appropriate.

Use branding or generics only when they prevent a concrete mistake or express
a real relationship. They are not blanket requirements. Static types do not
validate runtime input; retain the necessary boundary validation and invariants.

Complete when: the type surface expresses the task's meaningful distinctions
without unnecessary type machinery or missing runtime guarantees.
