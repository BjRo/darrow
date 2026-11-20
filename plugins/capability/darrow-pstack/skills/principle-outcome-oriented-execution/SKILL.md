---
name: principle-outcome-oriented-execution
description: Load principle-outcome-oriented-execution guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply outcome oriented execution

For an agreed rewrite or migration, work toward its defined target and phases.
Do not add temporary compatibility solely to keep intermediate edits looking
like the old design when the agreed transition does not require it.

Before a phase, state its permitted intermediate breakage and its phase checks.
Keep changes scoped and reversible, preserve external compatibility
obligations, and pass the phase's agreed checks before advancing. Expected
intermediate failures belong inside the agreed unit; they are not permission
to leave required behavior broken or skip final checks.

Complete when: each completed phase meets its declared checks and the agreed
target converges within existing scope and compatibility obligations.
