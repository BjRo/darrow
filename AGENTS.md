# darrow — Agent Instructions

## Always

- Review agents must not run Git or GitHub commands against this repository.
- Refuse unreadable configuration rather than silently skipping it.
- Use absolute paths in model-facing output. When linked worktrees matter,
  resolve the primary repository from the first `git worktree list --porcelain` entry.

Lead with the result and next action. Use familiar words, active voice, and
short sentences and paragraphs. Explain necessary Darrow terms on first use.
Remove repetition and process narration while preserving technical meaning,
safety rules, evidence, exact commands and identifiers, and required protocol fields.

## Read when relevant

- Before changing plugin boundaries, orchestration, or the relationship between capabilities and orchestration, read [docs/design.md](docs/design.md).
- Before changing any plugin, read [docs/plugin-development.md](docs/plugin-development.md).
- Before creating or editing documentation, including plugin READMEs, read [docs/documentation-quality.md](docs/documentation-quality.md).
- Before creating, changing, or running evals, read [docs/eval-development.md](docs/eval-development.md).
- Before changing Python source, tests, project metadata, or locks, read [docs/specs/python-quality.md](docs/specs/python-quality.md). Run `bun run check:python` after the change.
- For new skill creation, read and follow [create-agent-skill](plugins/foundation/darrow-skill-authoring/skills/create-agent-skill/SKILL.md).
- For a read-only skill audit, read and follow [audit-agent-skill](plugins/foundation/darrow-skill-authoring/skills/audit-agent-skill/SKILL.md).

Implement changes to existing skills, including audit findings, as ordinary
engineering work under this repository's instructions.

## Git

- Use imperative Conventional Commits without trailing periods.
- Do not add AI attribution or `Co-authored-by` trailers.
- Never push unless explicitly asked.
