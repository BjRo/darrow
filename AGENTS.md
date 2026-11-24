# Darrow agent instructions

## Writing style

Lead with the result and next action. Use familiar words, active voice and short
sentences. Explain Darrow terms on first use. Cut repetition and process narration;
preserve technical meaning, safety rules, evidence, commands and protocol fields.

When writing or editing agent instructions, use both `darrow-pstack:unslop` and
`darrow-matt-pocock:writing-for-agents`.

## Read when relevant

For step-by-step troubleshooting and debugging, use
`darrow-matt-pocock:diagnosing-bugs` with `darrow-pstack:principles-first`.

- Before changing plugin boundaries or capability/orchestration ownership, read [docs/design.md](docs/design.md).
- Before changing any plugin, read [docs/plugin-development.md](docs/plugin-development.md).
- Before creating or editing documentation, including plugin READMEs, read [docs/documentation-quality.md](docs/documentation-quality.md).
- Before changing or running evals, read [docs/eval-development.md](docs/eval-development.md).
- Before changing Python source, tests, project metadata, or locks, read [docs/python-quality.md](docs/python-quality.md). Run `bun run check:python` after the change.
- For skill creation or audits, use `writing-for-agents` with the plugin, documentation and eval standards. Keep audits read-only.
- For ADRs and their catalog, use `domain-modeling` and ordinary document editing. Preserve status, authority, supersession links and history.

Implement changes to existing skills, including audit findings, as ordinary
engineering work under this repository's instructions.

## Git

- Use imperative Conventional Commits without trailing periods.
- Do not add AI attribution or `Co-authored-by` trailers.
