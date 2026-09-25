---
name: work-through-decisions
description: Use for requests to draft, produce, or discuss an implementation, migration, rollout, or delivery plan for an identifiable technical change; discover, define, or spec out product feature behavior, including when a later saved spec or ticket is mentioned; or grill a named decision through structured questions. Includes "draft an implementation plan," "plan the migration," "spec out a feature," and "grill me." Exclude ordinary advice, coding, bug diagnosis, readiness checks, and ticket publication alone.
---

# Work through decisions

Guide one evidence-backed conversation toward the outcome the user requests.
This skill is read-only. Do not create or edit files, record decisions, create
tickets, assess readiness, invoke orchestration, implement, commit, or publish.
The confirmed result grants none of those authorities.

If the user combines this conversation with a request to write a spec or plan,
create a ticket, implement, or publish, keep this mode read-only for the entire
turn. Treat those requested actions as a later handoff after the material
choices and confirmation are complete. An explicit request for those actions,
or pressure to move quickly, does not delegate unanswered product or technical
choices. Ask the current frontier and stop; do not create a placeholder file,
start another capability, or claim that the requested action occurred.

Choose exactly one mode from the requested **outcome**, not words in the
subject. Implementation planning applies when the user asks how to build,
migrate, roll out, or deliver an identifiable technical change, even when its
product choices remain open. Feature
discovery applies when the user asks what a product feature should do or asks
to spec one out before implementation. Standalone grilling applies when the
user asks to grill, interview, challenge, or stress-test a named idea or
decision without requesting either outcome. A feature or API named as the
subject does not by itself turn grilling into feature discovery.

If none of these outcomes applies, leave this skill and answer through the
capability matching the request. Ordinary advice, coding, bug diagnosis,
readiness assessment, and a single clarification do not enter this workflow.
A negated mention of grilling does not prevent feature or planning mode from
asking necessary material questions.

Before taking a mode-specific action, read **only** that mode's complete
instructions from this installed skill directory in a direct tool call:

- [Implementation planning](references/implementation-planning.md) when the
  requested deliverable is a technical plan or implementation slices.
- [Feature discovery](references/feature-discovery.md) when the requested
  outcome is to define product feature behavior.
- [Decision-frontier method](references/decision-frontier.md) for standalone
  grilling, including a request with no identifiable subject.

Feature and planning modes also load the decision-frontier method when a
material choice requires a human answer. A mode resource, and then the shared
method when needed, must be read from this installed skill; do not invoke a
second public skill or search the user's repository for a copy. If a required
resource is unavailable or incomplete, stop and report that exact missing
resource instead of improvising its workflow.

Preserve the chosen mode across follow-up turns until the user requests a
different outcome. Carry forward settled answers rather than restarting the
interview. A request to finish now does not authorize the agent to invent
missing material decisions.

Complete when the selected mode's own closure condition is met and no action
outside this conversational authority has occurred.
