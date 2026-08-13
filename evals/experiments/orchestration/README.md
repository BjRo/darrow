# Orchestration value benchmark

**TL;DR.** `darrow-goal-loop` is now an adaptive preflight around native goal
execution: it inspects each task, chooses an execution workflow, gives more
demanding work a stronger model/effort route, and independently gives
higher-consequence work deeper validation and verification. In the latest N=1
retrospective, the adaptive setup passed the same behavior contracts as raw
Sol/medium native goal at roughly the same wall time (+3.6%) while estimated
metered API cost fell 61% under current cached-input pricing. This suggests Darrow can retain
native-goal performance while making orchestration meaningfully tunable and
automatically using cheaper execution when the task allows it; N>=3 replication
is still needed.

This experiment compares four ways to complete the same engineering task:

1. a vanilla single-agent run;
2. the harness's native goal capability;
3. native goal mode after `darrow-goal-loop` preflight and route selection;
4. `darrow-ticket-pipeline`.

`darrow-ticket-pipeline` is the explicit, high-assurance alternative. It moves
one durable ticket through fresh refine, challenge, implementation, independent
review, bounded rework, QA, and codification agents. Persisted ticket state,
traceable handoffs, separate writers and approvers, and resumable execution make
it a credible end-to-end delivery setup when those controls matter. That rigor
has a heavy price: the initial benchmark averaged 4.0--6.3 child agents per task
and 3.4--5.1 times vanilla wall time. It also passed only 75% of Codex tasks and
50% of Claude tasks in this N=1 corpus, so the evidence supports it as a
deliberate heavyweight option, not a reliable default for every task.

Each mode runs independently on Claude Code and Codex. Comparisons should be
made primarily within a harness/model/effort block; the cross-harness view also
contains model and CLI differences.

## Results so far

All completed experiment cells are exploratory **N=1** calibrations. They are
useful for rejecting clearly expensive designs, checking that routing works,
and choosing what to evaluate next; they are not stable estimates of general
performance. Time and tokens below are means per task. `unknown` means the
harness could not report or reconcile the value, not zero. Quality is the
deterministic task-pass rate followed by the condition-blind 1--5 judge score
when a judge ran.

### API pricing basis

Codex does not report a monetary charge, so estimated Codex costs below apply
the following standard API list prices per million text tokens, read on
2026-08-09. Keeping the rates here makes the historical calculations auditable
without a separate pricing lookup.

| Model                                                                        | Input | Cached input | Output |
| ---------------------------------------------------------------------------- | ----: | -----------: | -----: |
| [GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5)             | $5.00 |        $0.50 | $30.00 |
| [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)     | $5.00 |        $0.50 | $30.00 |
| [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) | $2.00 |        $0.20 | $12.00 |
| [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)   | $0.20 |        $0.02 |  $1.20 |

Each estimate prices recorded uncached input, cached input, and output on the
model that handled that phase. It excludes enterprise discounts, regional
uplifts, Batch discounts, tool-call fees, and long-context multipliers. Older
raw bundles do not preserve per-call prompt lengths, so long-context eligibility
cannot be reconstructed. `>=` marks a parent-session lower bound where child
usage was not reconciled; it is not a complete orchestrator cost.

### Original four-way benchmark

The [initial benchmark](snapshots/2026-08-07-n1.md) used four tasks and held the
candidate model fixed within each harness. Its `darrow-goal-loop` rows describe
the retired child-controller implementation, not the current native-goal
preflight.

| Harness / model          | Variant                      | Quality: task pass / judge |     Time |    Tokens | Cost, four-task cell |
| ------------------------ | ---------------------------- | -------------------------: | -------: | --------: | -------------------: |
| Codex / GPT-5.5 medium   | Vanilla                      |                100% / 4.75 |   216.5s |   649,756 |     $2.979 estimated |
| Codex / GPT-5.5 medium   | Native goal                  |                100% / 4.75 |   223.0s |   759,672 |     $3.362 estimated |
| Codex / GPT-5.5 medium   | Retired goal-loop controller |                 75% / 3.75 |   702.5s |   924,361 |    >=$4.827 recorded |
| Codex / GPT-5.5 medium   | Ticket pipeline              |                 75% / 3.75 | 1,110.4s |   unknown |    >=$6.552 recorded |
| Claude / Sonnet 5 medium | Vanilla                      |                100% / 3.25 |   413.9s | 2,142,588 |        $4.644 actual |
| Claude / Sonnet 5 medium | Native goal                  |                100% / 3.50 |   393.7s | 2,345,405 |        $5.169 actual |
| Claude / Sonnet 5 medium | Retired goal-loop controller |                 75% / 3.50 |   877.4s | 2,576,961 |        $9.647 actual |
| Claude / Sonnet 5 medium | Ticket pipeline              |                 50% / 3.00 | 1,404.0s |   unknown |              unknown |

Vanilla and native goal passed every task. The retired adaptive controller and
ticket pipeline were slower and less reliable; model rounds and child sessions,
not Bash execution, dominated their overhead. This evidence motivated replacing
the controller with preflight in front of native goal.

The two Codex orchestrator costs are lower bounds from recorded parent usage.
Their separately launched child sessions did not report reconcilable token
usage, so the complete controller and pipeline costs are higher.

### Goal-loop redesign and profile application

The [native-preflight calibration](snapshots/2026-08-07-native-preflight-codex-n1.md)
reran the four original tasks on GPT-5.5/medium. The later
[profile-routing calibration](snapshots/2026-08-08-profile-routing-codex-n1.md)
verified that a Terra/low classifier could select and actually apply Sol/medium
or Sol/high. The routed row uses different GPT-5.6 models, so it is historical
context rather than a controlled performance comparison with the GPT-5.5 rows.

| Codex variant                     | Implementation route    | Quality: task pass / judge |   Time |  Tokens | Estimated cost/task |
| --------------------------------- | ----------------------- | -------------------------: | -----: | ------: | ------------------: |
| Raw native goal                   | GPT-5.5 medium          |                100% / 4.75 | 223.0s | 759,672 |              $0.840 |
| Retired goal-loop controller      | GPT-5.5 medium          |                 75% / 3.75 | 702.5s | 924,361 |            >=$1.207 |
| Native goal after fixed preflight | GPT-5.5 medium          |                100% / 4.75 | 266.1s | 939,926 |              $1.012 |
| Adaptive profile routing          | GPT-5.6 Sol medium/high |                100% / 3.75 | 240.3s | 627,552 |              $0.826 |

The redesign removed the retired controller's task failure and cut its wall
time by 62%, but fixed-route preflight was still 19% slower and used 24% more
tokens than raw native goal. Profile application was proven from execution
logs, but it did not establish a quality advantage: the judge found a plausible
Click stream-ordering defect despite all deterministic checks passing.

### Workflow and risk ablation

The [held-out ablation](snapshots/2026-08-08-workflow-risk-heldout-n1.md)
compared raw native goal, workflow-only preflight, and workflow plus risk on
three different tasks: a bug fix, a new feature, and a refactor. Implementation
routes were held equal within each task. No blind judge or provider-reported
monetary cost was available.

| Variant         | Quality: task pass |   Time |    Tokens | Delta vs raw: time / tokens | Estimated cost/task |
| --------------- | -----------------: | -----: | --------: | --------------------------: | ------------------: |
| Raw native goal |                3/3 | 322.6s | 1,340,257 |                    baseline |              $1.397 |
| Workflow only   |                3/3 | 327.8s | 1,291,222 |               +1.6% / -3.7% |              $1.363 |
| Workflow + risk |                3/3 | 429.0s | 1,623,755 |             +33.0% / +21.2% |              $1.696 |

Workflow-only preflight was approximately neutral. Adding risk gates changed
no observed task outcome and cost 30.9% more time and 25.8% more tokens than
workflow-only. The result does not prove that risk-sensitive verification lacks
value; these already-passing tasks did not expose a defect for it to prevent.
At current API rates, workflow-only cost 2.5% less than raw native, while
workflow plus risk cost 21.4% more than raw native and 24.5% more than
workflow-only.

### GPT-5.6 task-oriented routing

The [routing calibration](snapshots/2026-08-08-gpt-5.6-routing-router-n1.md)
compared raw Sol/medium native goal, the former policy, and the now-promoted
task-oriented policy on three tasks. All implementations passed. Cost is a
reconstructed list-price estimate, not a provider-reported charge; classifier
and execution tokens are priced on their effective models, including the
official cached-input discount.

| Routing variant               | Quality: implementation / routing |   Time |    Tokens | Estimated cost/task |
| ----------------------------- | --------------------------------: | -----: | --------: | ------------------: |
| Raw native Sol/medium         |                         3/3 / n/a | 283.3s | 1,029,850 |              $1.043 |
| Former policy                 |                         3/3 / 2/3 | 289.9s |   949,079 |              $1.079 |
| Promoted task-oriented policy |                         3/3 / 3/3 | 294.9s | 1,079,793 |              $0.338 |

The promoted policy was 4.1% slower and used 4.8% more tokens than raw native,
but under current cached-input pricing its estimated cost was 67.6% lower
because ordinary work ran on Luna/high or Terra/medium instead of Sol/medium.
It was 68.7% cheaper than the former policy, whose current-price estimate is
3.4% higher than raw native. This is the clearest observed value of the current
goal-loop design: task-specific workflow and verification remain available
while model routing can reduce cost. The quality and latency result still needs
N>=3 replication on matching routes before it should be treated as a general
performance claim.

### Latest adaptive result versus raw Sol native

The [verification-cadence retrospective](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.md),
with its [machine-readable companion](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.json),
reprices the last accepted raw Sol/medium controls and latest adaptive trials
using current cached-input rates. The same three case contracts are unchanged,
but the runs are non-contemporaneous and used Codex CLI 0.145.0 versus 0.147.0.

| Variant                | Reviewed behavior | Mean wall | Mean tokens | Estimated cost/task |
| ---------------------- | ----------------: | --------: | ----------: | ------------------: |
| Raw native Sol/medium  |               3/3 |    283.3s |   1,029,850 |              $1.043 |
| Latest adaptive policy |               3/3 |    293.6s |     842,059 |              $0.407 |
| **Adaptive delta**     |          **same** | **+3.6%** |  **-18.2%** |          **-61.0%** |

The unmodified adaptive suite reports 1/3 because Cobra and Express retain stale
dimension or route expectations; every repository behavior check passed. This
retrospective is the primary end-to-end value comparison. Prescribing the
expected lower route to native goal remains useful only as a secondary ablation
of preflight and verification overhead after model selection is supplied for
free.

Taken together, the experiments currently support native goal as the execution
mechanism, lightweight workflow preflight as roughly efficiency-neutral, and
task-oriented model selection as a promising cost lever. They do not show value
from restoring a multi-agent goal controller or from using the ticket pipeline
as the default, and they have not yet demonstrated that proportional risk gates
improve escaped-defect detection.

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

# Measure adaptive overhead against native execution on prescribed case routes.
bun evals/runner/suite.ts \
  --suite evals/experiments/orchestration/promoted-routing-suite.yaml \
  --harness codex --trials 1 --no-judge
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
The [GPT-5.6 routing calibration](snapshots/2026-08-08-gpt-5.6-routing-router-n1.md),
with its [machine-readable snapshot](snapshots/2026-08-08-gpt-5.6-routing-router-n1.json),
records the active-versus-candidate evidence that preceded promotion. The
task-oriented mappings now live in the single canonical
`plugins/orchestration/darrow-goal-loop/config/routes.json` policy; the snapshot
retains the historical comparison and subsequent promotion rationale.

The [latest Sol-baseline retrospective](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.md),
with its [machine-readable snapshot](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.json),
records the current verification-cadence result, cached-input cost reconstruction,
benchmark-role correction, and historical static-pipeline context.

The [review-composition snapshot](snapshots/2026-08-12-review-composition-n1.md),
with its [machine-readable companion](snapshots/2026-08-12-review-composition-n1.json),
adds `code-review` as an environment-mapped capability and compares the current
adaptive surface with clean raw Sol/medium controls. It records proportional
review selection, one independently corroborated blocking finding followed by
a different-target rereview, reconciled native review-reader usage, and an
adaptive Cobra completion stop despite passing repository behavior checks.

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
reported provider cost is recorded as actual cost. Codex reports tokens but not
a monetary amount through this adapter; the tables above reconstruct standard
API cost from model-specific uncached input, cached input, and output rates.
When separately launched child usage cannot be reconciled, cost is reported as
a parent-session lower bound or remains `unknown`, never as a complete estimate.

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
