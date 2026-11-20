---
name: principle-build-the-lever
description: Load principle-build-the-lever guidance only when effective principles-first routing selects this leaf or the user explicitly names it. Never select independently for ordinary engineering.
---

# Apply build the lever

For repetitive, error prone work or correctness that must be rerunnable,
prefer an existing deterministic tool when it fits. If none fits, consider
the smallest script, codemod, generator or check that pays for its maintenance
through reduced repetition or error.

Validate representative output before broad use. A nontrivial task alone does
not justify building tooling, and a useful tool does not expand authority over
the files or external effects it changes.

Complete when: any chosen tool has a concrete benefit, justified maintenance
cost and representative validation before wider application.
