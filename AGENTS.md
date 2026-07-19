# darrow — Agent Instructions

Local-first agentic workflow runtime plus directly authored plugins for Claude
Code and Codex. Read `docs/product-spec.md` for product direction and follow its
direct links to the applicable runtime specification or ADR before changing a
contract.

## Layout

- `cli/` — global TypeScript/Bun workflow CLI and Temporal worker (M1 onward),
  versioned independently from plugins.
- `plugins/<name>/` — independently adoptable plugins. Canonical skills live in
  `source/<skill>/SKILL.md` with colocated `scripts/` and `evals/`; optional
  harness overlays live under `overlays/<harness>/`. `claude-skills/` and
  `codex-skills/` are generated, committed projections and must never be edited
  directly. Plugins are self-contained: never reference files outside the
  plugin directory or assume a sibling plugin is installed. Workflows invoke
  command skills by canonical `<plugin>:<skill>` ID; capability composition uses
  intent and portable contracts.
- `docs/specs/` — normative invariants. Runtime contracts live in
  `workflow-runtime.md`, `workspaces-artifacts.md`, `compatibility.md`, and
  `observability.md`; capability contracts live in their named files. Tests and
  evals trace to stable invariant IDs (for example, WR-20 or GW-C1).
- `docs/decisions/` — accepted architecture choices. Read the directly linked
  ADR before revisiting a selected technology or distribution boundary.
- `evals/` — shared runner (`runner/`) and results (`results/`, gitignored).
  The runner discovers cases via `plugins/*/source/*/evals/*.yaml`.

## Skill development loop (mandatory, in order)

1. Add/adjust the invariant in `docs/specs/<capability>.md`.
2. Enforce every checkable part in the skill's bundled script; the prompt
   (SKILL.md) keeps judgment only. Scripts print compact, decision-relevant
   output for a model — mode-aware, no raw git dumps.
3. Cover script behavior in the colocated deterministic test
   (`scripts/<name>.test.sh`) — run with bash 5 AND /bin/bash (3.2).
4. Add an eval case for the judgment part in the skill's `evals/` dir.
5. Fresh-context adversarial review of skill + script; fix ALL findings.
6. Re-run tests + evals, then commit.

Review agents must never run git/gh against this repo — temp dirs via
`mktemp -d` only; this repo is read-only for them.

## Shell portability (recurring bug classes — check before shipping any script)

- Never `printf "$var" | grep -q …` or awk-with-early-exit in a pipe under
  pipefail: SIGPIPE (141) silently discards matches past ~64KB. Use `<<<`.
- Never `${var//pat/}` on unbounded input: O(n²), 10KB ≈ 1 min. Use `[[ =~ ]]`.
- Never `awk -v x="$v"`: mangles backslashes. Pass via `X="$v" awk '…ENVIRON["X"]…'`.
- Old BSD awk: no interval regexes (`{1,6}`) — substr loops. Markdown: fences
  ``` or ~~~ indented ≤3 spaces; ATX heading = 1–6 `#` + space or tab; strip
  UTF-8 BOM on line 1.
- Unreadable config/template file → refuse with a clear error; never skip
  (skipping silently disables the invariant; unguarded awk dies raw under set -e).
- Paths in model-facing output must be absolute (cwd may be a subdir).
- Resolve the repo root via the first `git worktree list --porcelain` entry,
  not `--show-toplevel` (linked worktrees).

## Tests & evals

- Script tests: `bash plugins/darrow-git/source/<skill>/scripts/<name>.test.sh`
  (also with `/bin/bash`).
- Evals: `cd evals && bun runner/run.ts --case <substring> [--dry]`.
  5 trials/case, pass-rate threshold 0.8, ~$0.5/case — use `--case` to scope.
- Fixtures: mock external bins via the case's `bin:` field (lands in
  `.git/fixture-bin`); remotes are bare repos inside `.git/`; skill mounts are
  hidden via `.git/info/exclude` and never include the skill's `evals/` dir
  (the model under eval must not see its own pass criteria).
- Case prompts: quote any prompt containing `#` (plain YAML scalars
  comment-strip it — "Close ticket #12." silently became "Close ticket");
  anchor the capability's domain in the prompt ("in the issue tracker",
  "the open bug tickets") — headless skill routing is unreliable for
  oblique references; keep the judgment under test ambiguous, never the
  domain. Mock bins must exit 0 on empty state (`cat file || :`) — a
  missing state file otherwise fails the whole CLI, and the skill's
  correct stop-on-refusal behavior fails the eval.

## Git

- Conventional Commits, imperative, no trailing period (commit.sh enforces).
- No AI attribution anywhere — commits, PRs, code comments. No AI
  Co-authored-by trailers. Script-enforced; never bypass with raw git.
- Never push unless explicitly asked.

## Plugin format (dual runtime)

- Marketplace manifest: `.claude-plugin/marketplace.json` (Codex reads it too).
- Each plugin needs BOTH `.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json`; they declare `"skills": "./claude-skills/"` and
  `"skills": "./codex-skills/"` respectively and share identity and version.
- Each skill that participates in the Darrow workflow runtime (M1 onward) needs
  `source/<skill>/darrow.json`, validated against
  `docs/specs/darrow-skill-metadata.schema.json`. Native plugin manifests retain
  plugin identity and package version; never add arbitrary Darrow fields to
  them.
- Run `bun run plugins:generate` after canonical or overlay changes, or
  `bun run plugins:generate -- <plugin>` for one plugin. `bun run plugins:check`
  validates deterministic provenance without mutation. The pre-commit hook
  performs the same check from the staged index for affected plugins only.
- A command skill is invoked explicitly by canonical name. A capability skill is
  loaded by harness intent and advertises portable contracts in `darrow.json`.
