# Orchestration value benchmark

This experiment compares four ways to complete the same engineering task:

1. a vanilla single-agent run;
2. the harness's native goal capability;
3. native goal mode after `darrow-goal-loop` preflight and route selection;
4. `darrow-ticket-pipeline`.

Each mode runs independently on Claude Code and Codex. Comparisons should be
made primarily within a harness/model/effort block; the cross-harness view also
contains model and CLI differences.

## Corpus

The corpus uses real, non-trivial open-source repositories rather than generated
fixtures. [`manifest.yaml`](../../corpus/orchestration/manifest.yaml) records the
upstream repository, exact commit, commit date, license, license file, and
provenance statement. Every selected revision predates the public availability
of GitHub Copilot and retains named human authors in upstream Git history. The
repositories and task shapes are intentionally different:

| Case                                  | Upstream snapshot | Task shape                                         | Primary seam               |
| ------------------------------------- | ----------------- | -------------------------------------------------- | -------------------------- |
| `orchestration-oss-click-streams`     | Click 8.0.0       | stream lifecycle and public API migration          | Python CLI test harness    |
| `orchestration-oss-ajv-instance-path` | Ajv 8.5.0         | generated diagnostics across nested schemas        | TypeScript code generation |
| `orchestration-oss-go-git-insteadof`  | go-git 5.4.2      | repeated config values and longest-match semantics | Go public config model     |
| `orchestration-oss-express-links`     | Express 4.17.1    | header serialization and injection hardening       | Node HTTP response API     |
| `orchestration-oss-requests-proxy`    | Requests 2.25.1   | held-out bug fix for direct-send proxy resolution  | Python session transport   |
| `orchestration-oss-commander-env`     | Commander 7.2.0   | held-out environment-backed option feature         | Node CLI option API        |
| `orchestration-oss-cobra-lifecycle`   | Cobra 1.1.3       | held-out behavior-preserving lifecycle refactor    | Go command execution       |

The task prompts are custom evaluation contracts, not copied from a public
benchmark or issue tracker. That reduces direct benchmark contamination, but no
evaluation on famous open-source repositories can prove absence from model
training data. The deterministic hidden checks therefore exercise combinations
and edge cases not disclosed to the candidate.

The workflow/risk ablation uses all seven cases. The last three were selected
only after the workflow playbooks were written and cover the required held-out
bug-fix, new-feature, and refactor shapes.

Prepare or verify the reusable local checkouts:

```sh
bun run eval:orchestration:prepare
```

Preparation refuses dirty caches. Before every trial, the runner also requires
the exact manifest revision, a clean worktree, and the declared license file.
It clones the cache into an isolated temporary repository and removes its
remote. Evaluation guidance is committed before the candidate starts; hidden
checks and case YAML never enter the model workspace.

## Running the matrix

The default is five trials for all four modes on both harnesses, followed by a
fixed Codex quality judge:

```sh
bun run eval:orchestration -- --trials 5
```

Useful scoped and calibration runs:

```sh
# Validate fixtures without a paid model call.
bun evals/runner/suite.ts --harness codex --mode vanilla --case oss-go-git --trials 1 --dry

# Run one within-harness matrix with a chosen candidate and judge model.
bun evals/runner/suite.ts --harness claude --trials 3 \
  --claude-model claude-sonnet-5 \
  --judge-harness codex --judge-model gpt-5.5

# Omit advisory judging during a cheap calibration pass.
bun evals/runner/suite.ts --trials 1 --no-judge

# Compare raw native goal, workflow only, and workflow plus risk on Codex.
bun evals/runner/suite.ts \
  --suite evals/experiments/orchestration/profile-impact-suite.yaml \
  --harness codex --trials 3
```

The suite writes one JSON result per cell, `suite-run.json`, and `report.md`
under `evals/results/orchestration-value/<timestamp>/`. A report can be rebuilt
without rerunning candidates:

```sh
bun evals/runner/report.ts evals/results/orchestration-value/<timestamp>/suite-run.json
```

Raw run bundles are gitignored because candidate and judge payloads are large.
When a run materially informs product direction, preserve a reviewed,
redacted snapshot under [`snapshots/`](snapshots/). The first such record is
the [2026-08-07 one-trial benchmark](snapshots/2026-08-07-n1.md), with a
[machine-readable aggregate](snapshots/2026-08-07-n1.json). A snapshot must
state its trial count, runner provenance, reruns, missing metrics, limitations,
and whether its conclusions are exploratory or accepted elsewhere. The
2026-08-07 snapshot evaluates the retired child-controller implementation. The
[native-goal preflight calibration](snapshots/2026-08-07-native-preflight-codex-n1.md),
with its [machine-readable snapshot](snapshots/2026-08-07-native-preflight-codex-n1.json),
compares the redesign against that historical record.

## What is measured

- **Task pass rate:** the primary binary outcome, from hidden behavior checks
  plus focused upstream tests. Evaluator bookkeeping records are excluded.
- **Protocol pass rate:** task checks plus required child-invocation and
  human-intervention records. A protocol-only failure is not a codebase-contract
  failure.
- **Blind quality score:** an advisory LLM judgment of correctness,
  maintainability, test quality, and scope discipline. The judge sees the task,
  check outcomes, and final diff, but not the orchestration condition.
- **Candidate efficiency:** wall time, input/output tokens, and actual provider
  cost when the harness supplies it.
- **Orchestration overhead:** child model invocations and explicit human
  interventions. An intervention is a stop for a person's decision or missing
  authority, not routine autonomous reasoning.
- **Judge overhead:** judge tokens and cost, reported separately from the
  candidate run.

Setup and dependency installation happen before candidate timing. Claude Code's
reported provider cost is recorded as actual cost. Codex currently reports
tokens but not a monetary amount through this adapter, so its cost remains
`unknown`; the report does not invent a conversion. When an orchestrator routes
children through a foreign harness and complete usage cannot be reconciled,
candidate token totals are also reported as unknown.

## Fairness and interpretation

- Within a harness, every mode receives byte-identical task text, fixture,
  setup, and checks. Only the condition preamble and mounted orchestration skill
  differ.
- Candidate model, effort, trial count, and pass threshold are held constant
  across modes in a suite invocation.
- Cell order is shuffled with a recorded seed to avoid always favoring the same
  condition through service-time or warm-cache order effects. Pass `--seed` to
  reproduce an exact order.
- Native-goal conditions use the harness's own goal surface. Darrow goal
  conditions explicitly invoke the preflight skill, hold the prior candidate
  route fixed, and then use the same native goal surface. Other Darrow
  conditions mount all self-contained sibling skills they require.
- The ticket pipeline receives one isolated open ticket whose body is the same
  task text. Its local `ticketctl` supports only fetch and description replace.
- Results quantify this corpus and toolchain, not all engineering work. Use
  multiple trials and inspect the qualitative observations before deciding
  whether extra orchestration cost is justified.
