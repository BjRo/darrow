# Darrow Explanation

Explain technical structure in a compact inline view grounded in inspected
sources. The skill chooses a tree, diagram, table or pseudocode to answer the question.

## What it provides

### `explain-visually`

Selects the smallest representation that exposes the relationship the user
needs to understand:

- responsibility or component trees for ownership and composition;
- call trees or sequence diagrams for runtime flow;
- state diagrams or transition tables for lifecycle behavior;
- structural diffs for a target change;
- pseudocode for algorithms;
- types and signatures for a proposed interface; and
- tables for repeated exact mappings.

Example: _"This explanation is too much prose. Show me the worker state
transitions."_

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
["show-me: a coding agent skill for compact visual representations"](https://www.linkedin.com/pulse/show-me-coding-agent-skill-compact-visual-dexter-horthy-w5yac/).
Darrow adapts the smallest-fitting-view idea with explicit evidence status,
read-only boundaries, cross-host fallback behavior, and colocated evals.

## When to use

Understand technical structure or a grounded proposed change. Use another capability for images, HTML, slides, mockups, or documentation artifacts.

## Hosts and prerequisites

Codex and Claude Code with access to the subject's sources. Plain text works when diagram rendering is unavailable.

## Installation

Install `darrow-explanation@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).

## Usage

Ask for the operation:

> Show me the worker state transitions.

To select it explicitly, choose `explain-visually` from Codex's `$` skill menu
or type `$darrow-explanation:explain-visually`; in Claude Code, use
`/darrow-explanation:explain-visually`, followed by your request.

### Implicit activation in Codex

Implicit selection can be inconsistent on Codex `gpt-6-luna`/medium. Invoke
`explain-visually` explicitly when its grounding and view-selection instructions
matter. A useful diagram alone does not establish that those instructions ran.

## Expected result

One compact inline visual answers the question first. Nearby sources and an
evidence-status label preserve what is observed, proposed, or conceptual. The
skill creates no artifact and does not edit the subject.

## Troubleshooting

Identify a missing subject and keep evidence gaps visible. If rendering fails, use plain text; do not invent structure to complete the view.
For a missing skill or host error, follow the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).
Report the plugin and host versions, invocation and error. Omit credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
