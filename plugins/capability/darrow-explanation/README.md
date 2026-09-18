# Darrow Explanation

This plugin turns an existing technical subject into a compact visual
explanation without turning visual polish into an excuse to invent structure.

## What it provides

### `explain-visually`

Selects the smallest representation that exposes the relationship the user
needs to understand:

- responsibility or component trees for ownership and composition;
- call trees or sequence diagrams for runtime flow;
- state diagrams or transition tables for lifecycle behavior;
- structural diffs for a target change;
- pseudocode for algorithms;
- types and signatures for a proposed code surface; and
- tables for repeated exact mappings.

Example: _“This explanation is too much prose. Show me the worker state
transitions.”_

## Design boundaries

- The skill is conversational, inline, and read-only.
- Concrete nodes and edges come from supplied or inspected evidence.
- Observed, proposed, and conceptual views are distinguished when they could be
  confused.
- Missing evidence remains unknown rather than becoming plausible
  architecture.
- The skill does not create HTML, image, slide, mockup, or documentation files.
- It does not implement, review, plan, or document the subject being explained.

## Attribution

The capability is inspired by HumanLayer's open-source
[`show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)
skill and Dexter Horthy's article
[“show-me: a coding agent skill for compact visual representations”](https://www.linkedin.com/pulse/show-me-coding-agent-skill-compact-visual-dexter-horthy-w5yac/).
Darrow adapts the smallest-fitting-view idea with explicit evidence status,
read-only boundaries, cross-host fallback behavior, and colocated evals.

## When to use

Understand technical structure or a grounded proposed change. Use another capability for images, HTML, slides, mockups, or documentation artifacts.

## Hosts and prerequisites

Codex and Claude Code with access to the subject's sources, on Linux, macOS,
or native Windows. Plain text works when diagram rendering is unavailable.

This is a skill-only plugin: the packaging audit found no Bash mechanics,
executable helpers, or runtime dependencies to migrate. Python, UV, Bash, and
Mermaid are not prerequisites added by this plugin; the host's own prerequisites
still apply. Its skill, metadata, examples, and eval fixtures are contained in
the plugin. This intentionally differs from the Python + UV mechanics blueprint:
there is no package, lockfile, or entry in `python-packages.txt` because there is
no deterministic runtime code to package.

## Installation

Install `darrow-explanation@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

On native Windows, run the guide's shell commands in PowerShell and slash
commands inside the relevant host session. Use the per-plugin commands directly;
the optional marketplace-wide Bash installer is not needed for this plugin.

## Usage

An ordinary request can select the appropriate capability:

> Show me the worker state transitions.

To select it explicitly, choose `explain-visually` from Codex's `$` skill menu,
or use `/darrow-explanation:explain-visually` in Claude Code, followed by your request.

For an installation smoke check, invoke the skill with this self-contained
subject: “Observed flow: receive calls validate, then save. Show this as a
compact text call tree using only those three calls.” Expect an inline tree
with those calls in that order, without file changes. This check needs neither
a renderer nor repository-specific tools.

## Portability evidence

The repository's `Explanation portability` workflow installs a fresh copy into
isolated Claude Code and Codex configuration directories on Linux, macOS, and
native Windows, using paths containing spaces and Unicode. It checks matching
manifest versions, the installed skill bytes, Claude's skill discovery, and
portable eval assertions. It does not use account credentials or make model
calls; installation checks alone do not certify live invocation.

The nine colocated eval cases cover activation, supported visual forms,
source grounding, read-only behavior, and intent exclusions. Their checks use
declarative output assertions and Git commands, with no POSIX utility or
fixture-setup dependency. The shared live eval runner still requires a POSIX
host; its results must not be presented as native-Windows invocation evidence.
Use the explicit smoke check above in each authenticated host to verify that
platform's live invocation separately.

## Expected result

One compact inline visual with nearby sources and appropriate evidence status. No artifact creation or subject edits.

## Troubleshooting

Identify a missing subject and keep evidence gaps visible. If rendering fails, use plain text; do not invent structure to complete the view.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
