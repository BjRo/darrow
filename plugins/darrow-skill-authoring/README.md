# Darrow Skill Authoring

`darrow-skill-authoring` provides one workflow for creating, revising, and
validating focused agent skills that remain useful in both Claude Code and
Codex.

## Skill

- `author-agent-skill` defines an observable skill contract, tests discovery
  and workflow behavior, separates deterministic mechanics from judgment, and
  verifies the resulting package in fresh context.

The plugin is self-contained. It does not require another Darrow plugin, an MCP
server, or a workflow runtime. Its bundled inspector validates portable
metadata and containment for inline Markdown-linked local resources; the
workflow inspects other path forms, and native runtime validators remain
authoritative for their complete formats.

## Development

Run the deterministic tests with both supported shells:

```sh
bash skills/author-agent-skill/scripts/inspect-skill.test.sh
/bin/bash skills/author-agent-skill/scripts/inspect-skill.test.sh
```

Run the judgment evals from the repository `evals` directory:

```sh
bun runner/run.ts --case author-agent-skill --dry
bun runner/run.ts --case author-agent-skill
```
