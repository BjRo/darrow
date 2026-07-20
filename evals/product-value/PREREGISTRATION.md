# Darrow product-value evaluation preregistration

**Frozen:** 2026-07-18, before any admissible pilot or confirmatory run. The
machine-readable counterpart is `protocol.yaml`. Protocol v5 retains v4's
two-command CLI treatment and supersedes its deterministic grading procedure
after the first 36-cell calibration run exposed repository-wide baseline test
failures in Credfolio. V5 changes no task prompt, treatment, harness route,
model output, threshold, or analysis rule. It runs only the oracle-changed tests
from their owning package and preflight reconstructs every selected historical
oracle change to prove that its exact verifier passes. The immutable v4 pilot
observations and patches remain frozen; v5 quality is a separately stored,
digest-bound deterministic re-verification of those patches. Original v4
quality fields are excluded. The confirmatory holdout has not been opened.
Changes after opening it require a new holdout and a new preregistration.

## Question and estimands

The product question is whether Darrow's CLI orchestration adds enough value to
justify its incremental cost, latency, setup, and operational complexity.
Within each task and harness, three treatments are paired:

1. `native`: native harness, no Darrow plugins;
2. `plugins`: native harness, all current Darrow plugins mounted directly;
3. `cli`: the same harness route and plugins invoked by `darrow run
implement-change`, which runs implementation and then fresh-context material
   review, targeted repair, and verification.

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

Excluded smoke diagnostics showed that the original design confounded Darrow
orchestration with a prescriptive delivery policy. Before pilot work, the core
estimand was amended so all three treatments receive this same minimal policy:
"Use Red/Green TDD to implement the requested change. Use an existing focused
behavioral test when it covers the requested behavior; otherwise add or adjust
one. Run that test before changing production code and confirm it fails because
the requested behavior is missing. Then make the smallest change that passes
the same test and run the relevant regression tests. If the normal test command
fails for an unrelated setup reason, run the focused test directly or through
another available command; an unrelated failure is not red." Direct `native`
and `plugins` cells receive it in the evaluator prompt; CLI receives it once
through the invoked implementation skill. The CLI then starts a second session
of the same locked harness route with the `verify-and-repair` command. It reviews
the current diff for material defects, repairs findings, and verifies the final
change. Direct treatments may choose to review during their native loop but are
not forced into a second invocation. The common top-level outcome and
implementation policy therefore remain controlled while the enforced fresh
perspective is the orchestration behavior under test. Every core observation
created before this amendment remains excluded and must not be mixed with the
v4 schedule.

The completed v3 six-cell smoke used the earlier one-command CLI treatment and
is retained as operational history only. Protocol v4 requires a new six-cell
smoke before pilot work. The CLI's two steps deliberately use the same
harness/model route within each block; cross-harness model diversity is not part
of this estimand.

The earlier matched-policy diagnostic and all of its result roots remain
excluded historical diagnostics. The optional Codex-only policy diagnostic now
runs `native-no-tdd` and `plugins-no-tdd` beside fresh core controls. These
evaluator-only cells omit the shared policy, remain outside the frozen
three-treatment schedule and every product estimate, and estimate the policy's
own process cost. A failed auxiliary cell is not an overhead baseline. Harness
version remains visible in every observation.

## Sources, sanitization, and execution

The corpus pins full revisions of `mynab` and `credfolio2`; each task also pins
an oracle commit whose first parent is its base. The runner exports the base as
a tar archive, removes history and remotes, strips all known agent instructions,
skills, hooks/state, issue-agent files, demos, Darrow state, and non-example
`.env` files, rejects escaping symlinks, then initializes a new one-commit Git
repository. It records the removed paths and sanitized tree digest.

Before the pilot, direct Claude execution was changed from terminal JSON to
verbose streaming JSON so its compact trace observes the same tool-use event
stream available to the CLI treatment. The terminal `result` event remains the
sole source of success, usage, and cost. This is a measurement-only repair to
PV-14: it exposes process counts for treatment comparison without changing the
prompt, tools, permissions, model, effort, timeout, outcomes, or decision rule.
The excluded smoke created before this repair remains an infrastructure
diagnostic and is not pooled with later process measurements.

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
preregistered oracle-focused command from its owning package. Direct and native
runs use isolated harness state. CLI runs additionally use isolated Darrow and
toolchain state. Headless Claude trials require a dedicated long-lived setup
token or API key; rotating interactive-login credentials are never copied into
disposable state. Preflight performs one minimal inference per harness inside
the trial sandbox, rather than trusting local login metadata. It also
reconstructs each selected historical oracle patch in a sanitized checkout and
requires its exact verifier to pass. Before the first v4 smoke, preflight was
amended to bundle the exact Darrow Temporal workflow with the pinned evaluator
Bun runtime. These checks fail before treatment assignment when evaluation
inputs are unusable; they change no treatment prompt or model behavior.

The first v4 smoke exposed two adapter-compatibility failures before the new
review step could execute. Claude Code rejected the command's complete output
schema because its structured-output surface forbids root combinators. Codex
automatically added the disposable project trust entry to its isolated config
after the implementation step, correctly tripping the immutable permission
digest before review. The evaluator now writes that exact trust entry before
compilation, so the locked file remains stable. A fresh smoke then showed Codex
also rejects a root combinator when the review command reaches its provider.
Both adapters now omit those provider-unsupported root keywords while Darrow
retains and validates the complete snapshotted contract, as required by WR-42.
A third targeted Codex diagnostic reached both model invocations but exposed an
ambiguous verification-result contract: a relevant focused check passed while
broader runner-incompatible checks failed, and the flat blocking flag could not
audit whether the passing check covered the same concern. Verdict checks are now
top-level and `diagnosticChecks` are nested under the successful verdict check
that covers their concern, with a required non-blocking reason. Skill evals assert
on the normalized final structured message and include the converse case where
an unavailable authoritative verifier must produce `verified: false`. The first
three v4 result roots are infrastructure or contract-calibration evidence only;
protocol v4 restarts in a fresh root. These repairs change no product-evaluation
prompts, tools, models, effort, task outcomes, thresholds, or schedule.

The first complete v4 pilot then exposed a grading defect before any
confirmatory run: all Credfolio tasks used the monorepo-wide `pnpm test`, whose
base revisions contain unrelated time-sensitive and service-environment
failures. That command forced otherwise passing oracle-focused patches to zero.
Protocol v5 replaces it with package-relative Vitest filters for frontend tasks
and explicit Go package checks for backend tasks. The historical oracle for
every pilot task passes the corrected verifier. Re-verification operates only
on the frozen participant patch and writes a separate identity-bound result;
the v4 observation, transcript, timing, usage, status, and patch are unchanged.

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
destroying a successful CLI workspace. Trace schema `1.3.0` records one bounded
entry per model invocation and aggregates model/runtime durations, event counts,
token accounting, and command/nonzero counts across the implementation and
verification sessions. It retains no model messages, commands, paths, or tool
output. Phase timestamps remain tied to the implementation result for legacy
instrumented cells; portable instruction-only cells record empty phases and a
null timeline. Participant patches exclude Darrow control state and evidence
directories.

## Exclusions, missingness, and stopping

Valid exclusions are limited to: source revision unavailable; lockfile setup
fails before treatment assignment; pinned harness/model unavailable for the
entire block; evaluator infrastructure corrupts the workspace; or an externally
documented provider outage. Agent failure, timeout, permission denial, Darrow
failure, retry, and waiting for human input are outcomes, not exclusions.

There is no efficacy stopping. The smoke stops at USD 15 or 4 million tokens.
The pilot and confirmatory phases stop at USD 75 or USD 250, or at fallback
token ceilings of 20 million or 175 million respectively. The token ceilings
were raised before pilot work using the observed roughly 0.34-million-token
one-command Codex cells and an explicit allowance for the CLI's second
invocation. These are operational limits rather than economic success
thresholds. Every phase also stops
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
