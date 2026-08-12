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

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
