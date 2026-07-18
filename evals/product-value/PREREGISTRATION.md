# Darrow product-value evaluation preregistration

**Frozen:** 2026-07-18, before any confirmatory run. The machine-readable
counterpart is `protocol.yaml`. Changes after the first pilot run require a new
protocol version. Changes after opening the holdout require a new holdout and a
new preregistration.

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

Each task is run twice in every treatment for both Codex and Claude Code. The
frozen seed assigns one of six treatment permutations to each task/harness/
repeat block. This yields 72 pilot and 312 confirmatory runs. Repetition reduces
measurement noise but does not inflate inferential sample size.

## Sources, sanitization, and execution

The corpus pins full revisions of `mynab` and `credfolio2`; each task also pins
an oracle commit whose first parent is its base. The runner exports the base as
a tar archive, removes history and remotes, strips all known agent instructions,
skills, hooks/state, issue-agent files, demos, Darrow state, and non-example
`.env` files, rejects escaping symlinks, then initializes a new one-commit Git
repository. It records the removed paths and sanitized tree digest.

Dependencies are installed before treatment execution with the frozen lockfile.
The model sees neither source history nor the evaluator's oracle tests. After
execution, the runner captures the patch, overwrites every test changed by the
oracle commit with the oracle version, restores base tests and test-runner
manifests so participants cannot weaken verification, and executes the
preregistered repository verification command. Direct and native runs use
isolated harness state. CLI runs additionally use isolated Darrow and toolchain
state.

The recorded route is Codex `gpt-5.6-sol` at high effort and Claude
`claude-sonnet-4-6` at high effort. Exact executable, harness version,
permission mode, auth/configuration digest, source revision, runner revision,
and plugin digest are recorded per run. A route version change during one phase
is an operational stop; it is not pooled silently.

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
wall time, explicit human-attention minutes, intervention count, failures,
retries, recovery, rework, run-to-run variance inputs, and setup/operational
failure categories. Unknown cost and attention that has not yet been timed
remain null rather than zero; confirmatory analysis refuses incomplete
attention annotations.

## Exclusions, missingness, and stopping

Valid exclusions are limited to: source revision unavailable; lockfile setup
fails before treatment assignment; pinned harness/model unavailable for the
entire block; evaluator infrastructure corrupts the workspace; or an externally
documented provider outage. Agent failure, timeout, permission denial, Darrow
failure, retry, and waiting for human input are outcomes, not exclusions.

There is no efficacy stopping. A phase stops operationally if its cost ceiling
of USD 75 for pilot or USD 250 for confirmatory work is reached, its fallback
token ceiling of 5 million or 25 million respectively is reached, a harness
version changes, more than 10% of scheduled runs are blocked by the same
evaluator defect, or credentials are unavailable.
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
