# Darrow Skill Authoring

`darrow-skill-authoring` provides one workflow for creating, revising, and
validating focused agent skills that remain useful in both Claude Code and
Codex.

## Skill

- `author-agent-skill` defines an observable skill contract, tests discovery
  and workflow behavior, separates deterministic mechanics from judgment, and
  verifies the resulting package in fresh context.

See [`author-agent-skill`](skills/author-agent-skill/SKILL.md) for the
self-containment and validation boundaries.

## Development

Run the deterministic tests with both supported shells:

```sh
bash skills/author-agent-skill/scripts/inspect-skill.test.sh
/bin/bash skills/author-agent-skill/scripts/inspect-skill.test.sh
```

Run the judgment evals from the repository `evals` directory:

```sh
bun runner/run.ts --case author-agent-skill --harness claude --dry
bun runner/run.ts --case author-agent-skill --harness claude
```

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
