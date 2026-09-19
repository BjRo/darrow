# darrow — Agent Instructions

Darrow is a marketplace of independently adoptable plugins for Claude Code and
Codex. Its product architecture separates intent-matched capabilities from
explicit orchestration, with each plugin serving as an optionality boundary.
Capabilities are model-invoked in response to matching user intent, though a
user may also name one explicitly. Orchestration starts only through explicit
user invocation; never infer it from task complexity or duration.
`darrow-adaptive-delivery` is the core orchestration helper: it frames a bounded native
goal and then leaves execution to the host. `darrow-ticket-pipeline` is retained
only as a reference implementation of the former static phase approach and as a
benchmark baseline. Neither is a daemon, queue, general workflow runtime, or
license to restore the removed runtime experiments. Do not reconstruct other
runtime machinery from Git history unless the user explicitly requests it.

## Writing style

- Lead with the result and the next action.
- Use familiar words, active voice, and short sentences and paragraphs.
- Explain a necessary Darrow term the first time it appears.
- Remove repetition and unnecessary process narration.
- Preserve technical meaning, safety rules, evidence, exact commands and
  identifiers, and required protocol fields while simplifying prose.

Before changing plugin boundaries, the orchestration model, or the relationship
between capabilities and orchestration, read [`docs/design.md`](docs/design.md).

## Layout

- `plugins/<kind>/<name>/` — self-contained plugins grouped as `foundation`,
  `capability`, `orchestration`, `task-recipe`, or `automation`. Skills live in `skills/<skill>/SKILL.md`
  with colocated scripts and evals. Never reference files outside a plugin or
  assume a sibling plugin is installed.
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

## Plugin mechanics

- Use a contained Python package managed by UV for substantial deterministic
  plugin mechanics when Python materially improves clarity or native Windows
  support. Commit `pyproject.toml` and `uv.lock`, keep runtime and development
  dependencies separate, invoke runtime entrypoints with frozen resolution, and
  register the package in `python-packages.txt`.
- For Python conversions, preserve required public behavior rather than
  translating Bash verbatim. Simplify the design with idiomatic Python,
  standard-library operations, and focused reuse within the owning package.
  Remove unnecessary Bash shims, obsolete aliases, and compatibility branches;
  update callers and tests to invoke the frozen package entrypoints directly.
  Retain an adapter only for an explicitly required external contract or an
  actual host protocol, not merely because the old script path existed.
- Keep genuinely small host-specific launchers and command glue in portable
  Bash, using baseline Unix utilities and the host CLIs the capability wraps.
  Do not introduce JavaScript/TypeScript, Ruby, JVM, compiled, or shared Darrow
  runtime dependencies inside a plugin.
- Avoid early-exit pipelines under `pipefail`; use here-strings for bounded
  matching.
- Avoid `${var//pat/}` on unbounded input and `awk -v` for backslash-bearing
  values.
- Support old BSD awk and Bash 3.2 in plugin shell scripts.
- Refuse unreadable configuration rather than silently skipping it.
- Use absolute paths in model-facing output.
- Resolve the primary repository via the first `git worktree list --porcelain`
  entry when linked worktrees matter.

## Tests and evals

Before creating, changing, or running evals,
read [`docs/eval-development.md`](docs/eval-development.md).

All Python packages follow [`docs/specs/python-quality.md`](docs/specs/python-quality.md).
Run `bun run check:python` after changing Python source, tests, project metadata,
or locks.

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
