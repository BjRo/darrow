# Darrow Discovery

This plugin resolves material unknowns before implementation without turning
the conversation into another orchestrator. It provides one reusable grilling
method and two outcome-oriented skills that apply the same method to product
discovery and implementation planning.

## What it provides

### `grilling`

When explicitly invoked, stress-tests a plan, decision, design, or idea through
dependency-aware question rounds. The skill investigates discoverable facts,
asks the user only for decisions or confirmation, and gives a recommendation
with every material question. It never activates from natural-language intent.

Example: explicitly invoke the installed `grilling` skill with _“Grill me on
this API design before I commit to it.”_

### `discover-feature`

Explores a new feature's users, behavior, scope, constraints, non-goals, and
acceptance evidence. It uses the canonical grilling method while material
unknowns remain, then produces a concise discovery brief for confirmation.

Example: _“Help me discover what scheduled reporting should do.”_

### `plan-implementation`

Inspects the current repository and turns an understood outcome into ordered,
independently verifiable implementation slices. It uses the same grilling
method when technical or product unknowns would otherwise become hidden plan
assumptions.

Example: _“Plan the implementation of configurable request timeouts and work
through consequential choices with me first.”_

## Design boundaries

- All three skills are conversational and read-only.
- Grilling is manual-only. The two outcome skills read its installed sibling
  file as their shared method without selecting it as the primary skill.
- Feature discovery does not become implementation planning, and planning does
  not invent unresolved feature behavior.
- The plugin does not write specifications or plans, record decisions, create
  tickets, assess readiness, start orchestration, implement, commit, or
  publish.
- Confirmed outputs may be handed to separately installed capabilities by
  intent; this plugin neither requires nor references another Darrow plugin.

## Attribution

The grilling method is adapted from Matt Pocock's open-source
[`grilling`](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md)
skill: decision trees, dependency-aware frontiers, recommendations with each
question, and the division between agent-owned fact finding and user-owned
decisions.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
