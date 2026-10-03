# Darrow Discovery

This plugin resolves material unknowns before implementation through one
read-only skill. It selects standalone grilling, feature discovery, or
implementation planning from the outcome you ask for. The three modes share a
dependency-aware decision method.

## What it provides

### Standalone grilling

Stress-tests a plan, decision, design, or idea through
dependency-aware question rounds. The skill investigates discoverable facts,
asks the user only for decisions or confirmation, and gives a recommendation
with every material question. You can request it in ordinary language or invoke
the skill explicitly.

Example: _“Grill me on this API design before I commit to it.”_

### Feature discovery

Explores a new feature's users, behavior, scope, constraints, non-goals, and
acceptance evidence. It uses the canonical grilling method while material
unknowns remain, then produces a concise discovery brief for confirmation.

Example: _“Help me discover what scheduled reporting should do.”_

### Implementation planning

Inspects the current repository and turns an understood outcome into ordered,
independently verifiable implementation slices. It uses the same grilling
method when technical or product unknowns would otherwise become hidden plan
assumptions.

Example: _“Plan the implementation of configurable request timeouts and work
through consequential choices with me first.”_

## Design boundaries

- The one skill and all three modes are conversational and read-only.
- The skill reads only the requested mode's instructions and loads the shared
  decision method when material unknowns require a human answer.
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

## When to use

Grill a decision, clarify a product feature, or develop an implementation
plan. Do not use this plugin for ordinary advice, implementation, readiness
gates, or publication.

## Hosts and prerequisites

Codex and Claude Code with repository read access. The planning frontier
renderer requires [UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers).

## Installation

Install `darrow-discovery@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Help me discover what scheduled reporting should do.

To select it explicitly, choose `work-through-decisions` from Codex's `$` skill
menu, or use `/darrow-discovery:work-through-decisions` in Claude Code, followed
by your request.

## Expected result

A focused read-only discussion leads with the current decision or outcome. A
confirmed brief or plan keeps its evidence, constraints, and verification
without writing artifacts, tickets, or code.

## Troubleshooting

Answer the current frontier when choices remain. A missing mode resource,
backend, lock, UV installation, or supported Python runtime blocks
progress; do not substitute an unrelated checkout's files.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
