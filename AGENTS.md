# darrow — Agent Instructions

Darrow is a marketplace of independently adoptable plugins for Claude Code and
Codex. There is no active workflow runtime, delivery orchestrator, goal loop, or
software-factory implementation in this repository. Do not reconstruct one from
Git history or old experiment results unless the user explicitly requests it.

## Layout

- `plugins/<name>/` — self-contained plugins. Skills live in
  `skills/<skill>/SKILL.md` with colocated scripts and evals. Never reference
  files outside a plugin or assume a sibling plugin is installed.
- `docs/specs/` — normative capability invariants.
- `docs/decisions/` — accepted decisions for the surviving plugin/eval surface.
- `evals/runner/` — shared skill-evaluation runner. Results are gitignored.

## Skill development loop

1. Add or adjust the capability invariant.
2. Put checkable mechanics in the bundled script; keep judgment in `SKILL.md`.
3. Test scripts with Bash 5 and `/bin/bash` 3.2.
4. Add an eval case for judgment behavior.
5. Run a fresh-context adversarial review.
6. Re-run tests and scoped evals before committing.

Review agents must not run Git or GitHub commands against this repository.

## Shell portability

- Avoid early-exit pipelines under `pipefail`; use here-strings for bounded
  matching.
- Avoid `${var//pat/}` on unbounded input and `awk -v` for backslash-bearing
  values.
- Support old BSD awk and Bash 3.2 in plugin scripts.
- Refuse unreadable configuration rather than silently skipping it.
- Use absolute paths in model-facing output.
- Resolve the primary repository via the first `git worktree list --porcelain`
  entry when linked worktrees matter.

## Tests and evals

- Run relevant script tests with both `bash` and `/bin/bash`.
- Run evals with `cd evals && bun runner/run.ts --case <substring> [--dry]`.
- Keep eval prompts participant-visible and hide their pass criteria.
- Quote YAML prompts containing `#` and make fixture binaries succeed on valid
  empty state.

## Git

- Use imperative Conventional Commits without trailing periods.
- Do not add AI attribution or `Co-authored-by` trailers.
- Never push unless explicitly asked.

## Plugin format

- Marketplace: `.claude-plugin/marketplace.json`.
- Every plugin has `.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json`; the Codex manifest points at `./skills/`.
- Keep each plugin independently installable and self-contained.
