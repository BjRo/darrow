# Darrow product-value evaluation preregistration

**Frozen:** 2026-07-18, before any admissible pilot or confirmatory run. The
machine-readable counterpart is `protocol.yaml`. Protocol v2 supersedes the
initial oversized design after infrastructure-only diagnostics showed that its
72-run, high-effort pilot could not fit its recorded time and token budgets.
Those diagnostic result roots are excluded. Changes after the first admissible
pilot run require another protocol version. Changes after opening the holdout
require a new holdout and a new preregistration.

## Question and estimands

The product question is whether Darrow's CLI orchestration adds enough value to
justify its incremental cost, latency, setup, and operational complexity.
Within each task and harness, three treatments are paired:

1. `native`: native harness, no Darrow plugins;
2. `plugins`: native harness, all current Darrow plugins mounted directly;
3. `cli`: the same harness route and plugins invoked by `darrow run
implement-change`.

The primary estimand is the task-level mean quality difference `cli - plugins`,
averaged across the two harnesses. `plugins - native` is a secondary estimand
that identifies plugin value. Repeats are averaged within a task/harness cell.
Tasks—not runs—are the generalization unit.

## Hypotheses and practical thresholds

The CLI first has to establish quality non-inferiority: the lower 95% task
bootstrap confidence bound for `cli - plugins` must exceed -0.05 on a 0–1
quality scale. A practically useful result additionally requires either a mean
quality gain of at least 0.10 or at least 20% less human-attention time. The CLI
must stay at or below 1.50× direct-plugin model cost (provider cost where
reported, tokens otherwise), 1.75× wall time, and 5% setup/operational failures.

The same effects are reported for `plugins - native`, by harness, repository,
and task stratum. Subgroups are descriptive and are not independently powered.

## Design and power

The corpus has 32 distinct historical product changes: 16 from each repository
and an equal split between simple overhead controls and orchestrated changes.
Six tasks are pilot/calibration tasks. The 26-task confirmatory holdout supplies
80% normal-approximation power at two-sided alpha 0.05 to detect a 0.10 paired
task-level quality difference when the paired standard deviation is 0.18:

```text
ceil(((1.959964 + 0.841621) * 0.18 / 0.10)^2) = 26 tasks
```

Before calibration, one simple pilot task (`mynab-flags-now`) runs once in every
treatment for both Codex and Claude Code. This six-run smoke uses medium effort
and a 15-minute per-observation deadline. It qualifies the execution machinery
and resource assumptions only and is excluded from all product estimates.

The six-task pilot then runs once in every treatment for both harnesses, which
yields 36 calibration runs. The 26-task confirmatory holdout remains high effort
and runs twice in every treatment for both harnesses, yielding 312 confirmatory
runs. The frozen seed assigns one of six treatment permutations to each task/
harness/repeat block. Repetition reduces measurement noise but does not inflate
inferential sample size.

After the excluded Codex smoke showed a large process mismatch, an auxiliary
matched-policy diagnostic was added before authenticated Claude or pilot work.
It runs the smoke task once in two Codex-only cells: `native-matched-policy` and
`plugins-matched-policy`. These evaluator-only diagnostic labels are not Darrow
treatments. Both direct cells receive the same evaluator-owned behavioral TDD
instructions without a helper script or structured output protocol, with fresh
`native` and `plugins` controls on the same Codex version.
The auxiliary cells are absent from the frozen three-treatment schedule and
excluded from every product estimate. The diagnostic attributes
each matched-policy cell minus its plain counterpart to policy. A successful
matched-plugin cell may be compared descriptively with CLI, but a failed cell
is not an overhead baseline. The diagnostic can motivate a later protocol
redesign, but cannot silently change the estimand.
The diagnostic records Codex CLI 0.144.6; the original excluded smoke used
0.144.4. Comparisons across that boundary are descriptive and the harness
version remains visible in every observation.

## Sources, sanitization, and execution

The corpus pins full revisions of `mynab` and `credfolio2`; each task also pins
an oracle commit whose first parent is its base. The runner exports the base as
a tar archive, removes history and remotes, strips all known agent instructions,
skills, hooks/state, issue-agent files, demos, Darrow state, and non-example
`.env` files, rejects escaping symlinks, then initializes a new one-commit Git
repository. It records the removed paths and sanitized tree digest.

The smoke task's deterministic-time request explicitly declares the historical
oracle's `{ readonly now?: Date }` options-object API. This clarification was
made during excluded smoke calibration after the original wording admitted a
different positional-argument implementation; no confirmatory prompt was
opened or changed.

The excluded `portable-implement-smoke-v1` repair smoke showed that Claude's
direct launcher bounded available tools while the CLI route could select the
native `Agent` tool. The CLI cell delegated this simple change, timed out, and
left its evaluator-started worker and Temporal service running. Before any
admissible pilot, the evaluator was amended to route both Claude treatments
through the same evaluator-owned bounded-tool, permission, settings-source,
and no-session-persistence launcher and pins Claude's supported
`CLAUDE_CODE_TMPDIR` inside the disposable run root. It now terminates attached
descendants plus recorded Darrow runtime processes after every CLI invocation
and recovers provider usage and cost from failed CLI transcripts. Claude's
adapter projects root JSON Schema dialect and identity annotations out of the
provider schema while retaining the complete snapshot for runtime validation;
Claude Code otherwise silently omits its structured result. Compact traces now
summarize Claude tool types and Bash outcomes as well as Codex command events.
This repairs PV-3 treatment parity, PV-12 measurement, and cleanup; it does not
change the task, model, effort, outcome rules, thresholds, or frozen schedule.
All result roots created before this repair remain excluded.

Dependencies are installed before treatment execution with the frozen lockfile.
Every treatment runs in that same prepared disposable checkout. Because the
evaluator already provides exclusive workspace ownership and the outer sandbox,
the CLI cell invokes Darrow with `--workspace current`; allocating another
managed worktree would discard ignored setup outputs such as workspace-local
`node_modules` and would measure dependency repair rather than orchestration.
The model sees neither source history nor the evaluator's oracle tests. After
execution, the runner captures the patch, overwrites every test changed by the
oracle commit with the oracle version, restores base tests and test-runner
manifests so participants cannot weaken verification, and executes the
preregistered repository verification command. Direct and native runs use
isolated harness state. CLI runs additionally use isolated Darrow and toolchain
state. Headless Claude trials require a dedicated long-lived setup token or API
key; rotating interactive-login credentials are never copied into disposable
state. Preflight performs one minimal inference per harness inside the trial
sandbox, rather than trusting local login metadata.

The recorded route is Codex `gpt-5.6-sol` and Claude
`claude-sonnet-4-6`. Smoke and pilot use medium effort with a 15-minute
deadline; confirmatory runs use high effort with a 60-minute deadline. Exact
executable, harness version, model, effort, timeout, permission mode,
auth/configuration digest, source revision, runner revision, and plugin digest
are recorded per run. A route version change during one phase is an operational
stop; it is not pooled silently.

## Outcomes and grading

The primary quality score combines deterministic verification and blinded
rubric grading. Deterministic verification is binary. A frozen four-item rubric
is scored 0, 0.5, or 1 per item; its mean is the blinded score. When a task is
fully determined by executable checks, deterministic quality is the final
quality. Otherwise final quality is 70% deterministic and 30% blinded rubric.
The result records which rule applied.

Blind bundles contain only an opaque sample ID, task prompt, sanitized patch,
and rubric. Treatment, harness, run order, timings, and Darrow artifacts are
excluded. Presentation order is seeded and randomized. Ten percent of bundles,
stratified by repository and stratum, are duplicated to estimate intra-grader
agreement. The grader calibrates on pilot examples; holdout outcomes are not
used to modify the rubric.

Every observation also records input/output tokens, provider-reported cost,
wall time, the configured timeout, explicit human-attention minutes,
intervention count, failures,
retries, recovery, rework, run-to-run variance inputs, and setup/operational
failure categories. Unknown cost and attention that has not yet been timed
remain null rather than zero; confirmatory analysis refuses incomplete
attention annotations.
Deterministic verification runs under the repository's declared runtime,
retains its output separately from model transcripts, and classifies failures
as timeout, runtime mismatch, missing dependency, test failure, or other command
failure.
The evaluator additionally retains a compact sanitized execution trace before
destroying a successful CLI workspace. It records model/runtime durations,
event counts, token accounting, and command/nonzero counts grouped into fixed
non-content categories, but no model messages, commands, paths, or tool output.
Trace schema `1.2.0` retains phase timestamps for legacy instrumented cells;
portable instruction-only cells record empty phases and a null timeline. This
explicit amendment removes obsolete evidence-protocol attribution without
changing outcomes, scheduling, or the decision rule. Participant patches
exclude Darrow control state and evidence directories.

## Exclusions, missingness, and stopping

Valid exclusions are limited to: source revision unavailable; lockfile setup
fails before treatment assignment; pinned harness/model unavailable for the
entire block; evaluator infrastructure corrupts the workspace; or an externally
documented provider outage. Agent failure, timeout, permission denial, Darrow
failure, retry, and waiting for human input are outcomes, not exclusions.

There is no efficacy stopping. The smoke stops at USD 15 or 3 million tokens.
The pilot and confirmatory phases stop at USD 75 or USD 250, or at fallback
token ceilings of 5 million or 25 million respectively. Every phase also stops
if a harness version changes, more than 10% of scheduled runs are blocked by the
same evaluator defect, or credentials are unavailable.
After repair, incomplete blocks resume using their existing assignments. The
fixed 26 distinct holdout tasks remain required; no task is substituted based
on observed performance. Missing cost prevents a `continue` decision unless a
token-based ratio is available.

## Analysis and decision rule

Effects are paired within task. Repeats and harnesses are averaged before
inference. Confidence intervals use 10,000 seeded task bootstrap samples;
two-sided p-values use 10,000 task-level sign-flip randomizations. Reports show
effect sizes and intervals even when p-values exceed alpha, plus raw run counts,
variance, failures, exclusions, and deviations.

The mechanical decision is:

- `continue`: overall quality non-inferiority, a practical quality or attention
  benefit, and all economic/reliability ceilings pass;
- `narrow`: those conditions pass only for orchestrated tasks, so investment is
  limited to that stratum;
- `stop`: the data rule out quality non-inferiority, or rule out the minimum
  useful benefit without an attention benefit;
- `redesign`: all other outcomes, including promising but inconclusive value or
  unacceptable overhead with recoverable benefit.

Interpretation follows the mechanical result and cannot change it. `continue`
or `narrow` explains the user and company tradeoff that earned further
investment; `redesign` or `stop` identifies the failed threshold.
