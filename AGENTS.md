# darrow — Agent Instructions

Reusable agentic delivery factory: kernel → generator → marketplace of plugins
for Claude Code and Codex. Read `docs/product-spec.md` for architecture,
`docs/specs/<capability>.md` for capability invariants, `docs/decisions/` for ADRs.

## Layout

- `plugins/<name>/` — one plugin per capability (currently `darrow-git`). Skills
  in `skills/<skill>/SKILL.md` + `scripts/` + `evals/` (case yamls colocated
  with the skill they test). Plugins are self-contained: never reference files
  outside the plugin dir; cross-plugin references go through intent, never
  assume a sibling plugin is installed.
- `docs/specs/<capability>.md` — invariants (e.g. GW-C1…) that scripts, tests
  and evals trace to.
- `evals/` — shared runner (`runner/`) and results (`results/`, gitignored).
  The runner discovers cases via `plugins/*/skills/*/evals/*.yaml`.

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

- Script tests: `bash plugins/darrow-git/skills/<skill>/scripts/<name>.test.sh`
  (also with `/bin/bash`).
- Evals: `cd evals && bun runner/run.ts --case <substring> [--dry]`.
  5 trials/case, pass-rate threshold 0.8, ~$0.5/case — use `--case` to scope.
- Fixtures: mock external bins via the case's `bin:` field (lands in
  `.git/fixture-bin`); remotes are bare repos inside `.git/`; skill mounts are
  hidden via `.git/info/exclude` and never include the skill's `evals/` dir
  (the model under eval must not see its own pass criteria).

## Git

- Conventional Commits, imperative, no trailing period (commit.sh enforces).
- No AI attribution anywhere — commits, PRs, code comments. No AI
  Co-authored-by trailers. Script-enforced; never bypass with raw git.
- Never push unless explicitly asked.

## Plugin format (dual runtime)

- Marketplace manifest: `.claude-plugin/marketplace.json` (Codex reads it too).
- Each plugin needs BOTH `.claude-plugin/plugin.json` and
  `.codex-plugin/plugin.json` (Codex variant adds `"skills": "./skills/"`).
