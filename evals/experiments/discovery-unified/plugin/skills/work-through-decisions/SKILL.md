---
name: work-through-decisions
description: Plan how to implement an identifiable change, spec out what a product feature should do, or grill a named decision or idea. Use for natural requests such as "let's plan how to implement this," "spec out a feature," and "grill me on this decision." Exclude ordinary advice, coding, bug diagnosis, readiness checks, and ticket publication.
---

# Work through decisions

Guide one evidence-backed, read-only conversation toward the outcome the user
requested. Do not create files, implement, capture decisions, publish tickets,
invoke orchestration, commit, or publish from this skill.

Choose exactly one mode from the requested **outcome**, not words in the
subject. An implementation plan takes priority when the user asks how to build
an identifiable change, even if its product choices remain open. Feature
discovery applies when the user asks what a product feature should do or asks
to spec one out before implementation. Standalone grilling applies when the
user asks to grill, interview, or challenge a named idea or decision without
requesting either outcome. If none applies, leave this skill and answer through
the capability that matches the request. Do not treat a personal decision as a
product feature merely because the user asks to grill it.

Before taking a mode-specific action, directly read **only** that mode's
complete instruction file from this installed skill directory:

- [Feature discovery](references/feature-discovery.md)
- [Implementation planning](references/implementation-planning.md)
- [Standalone grilling](references/standalone-grilling.md)

When feature or planning mode encounters material unknowns, also read the
[decision frontier method](references/decision-frontier.md) before asking them.
Standalone grilling reads that method as directed by its own mode file.
If a required reference is unavailable or incomplete, stop and report the
missing file; do not improvise its workflow.

Preserve the chosen mode across follow-up turns until the user requests a
different outcome. Carry forward settled answers. A request for an outcome is
not permission to assume its missing material choices.

Complete when the selected mode's completion condition is met and no action
outside this conversational authority has occurred.
