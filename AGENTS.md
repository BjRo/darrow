# darrow — Agent Instructions

Darrow is a marketplace of independently adoptable plugins for Claude Code and
Codex. Its product architecture separates intent-matched capabilities,
explicitly invoked task recipes, and explicit orchestration, with each plugin
serving as an optionality boundary.
Capabilities are model-invoked in response to matching user intent, though a
user may also name one explicitly. Orchestration starts only through explicit
user invocation; never infer it from task complexity or duration.
`darrow-goal-loop` is the core orchestration helper: it frames a bounded native
goal and then leaves execution to the host. `darrow-ticket-pipeline` is retained
only as a reference implementation of the former static phase approach and as a
benchmark baseline. Neither is a daemon, queue, general workflow runtime, or
license to restore the removed runtime experiments. Do not reconstruct other
runtime machinery from Git history unless the user explicitly requests it.

Before changing plugin boundaries, the orchestration model, or the relationship
between capabilities and orchestration, read [`docs/design.md`](docs/design.md).

## Layout

- `plugins/<kind>/<name>/` — self-contained plugins grouped as `foundation`,
  `capability`, `task_recipe`, or `orchestration`. Skills live in
  `skills/<skill>/SKILL.md` with colocated scripts and evals. Never reference
  files outside a plugin or assume a sibling plugin is installed.
- `docs/specs/` — normative capability invariants.
- `docs/decisions/` — accepted decisions for the surviving plugin/eval surface.
- `evals/runner/` — shared skill-evaluation runner. Results are gitignored.

## Skill development

For skill creation, revision, or validation, follow
[`author-agent-skill`](plugins/foundation/darrow-skill-authoring/skills/author-agent-skill/SKILL.md).
Add or adjust the applicable invariant under `docs/specs/` before implementation.
Keep contextual judgment in the skill. Put repeatable, error-prone command and
tool-protocol mechanics behind narrow bundled scripts so the model supplies
intent-level inputs instead of reproducing call details.

Review agents must not run Git or GitHub commands against this repository.

## Shell portability

- Write plugin-shipped executable mechanics in portable Bash, using baseline
  Unix utilities and the host CLIs the capability wraps. Do not add Python,
  JavaScript/TypeScript, Ruby, JVM, or compiled runtime dependencies. Shared
  repository development and eval infrastructure such as `evals/runner/` is
  outside this plugin-runtime boundary.
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

- Give every skill colocated eval cases that verify its public behavior and
  intent boundaries. Test deterministic scripts separately when present.
- Develop behavior-changing variants from comparative evidence. Run the
  candidate and relevant control against the same fixtures, prompts, checks,
  harness, model, and effort; report trial count, metrics, and limitations.
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
- Whenever a plugin changes, increment its semantic version in both manifests
  and keep the versions identical.
- Keep each plugin independently installable and self-contained.
