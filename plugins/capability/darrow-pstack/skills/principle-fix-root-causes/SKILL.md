---
name: principle-fix-root-causes
description: Load principle-fix-root-causes guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply fix root causes

Reproduce the defect and trace the first incorrect behavior before choosing
a repair. Distinguish a legitimate state that must be handled from an invalid
producer that should not have emitted it.

Check related cases that share the cause. Repair within the accepted scope,
report other findings, and expose a needed scope expansion as a decision
rather than silently taking it.

Complete when: the repaired behavior addresses the demonstrated cause and
related evidence, remaining findings and scope decisions are explicit.
