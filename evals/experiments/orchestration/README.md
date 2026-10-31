# Orchestration value benchmark

`darrow-adaptive-goal` frames a bounded native goal and keeps acceptance,
continuation and completion in the main thread. Its current policy selects
direct implementation or bounded delegation. `darrow-ticket-to-pr` adds a
ticket-delivery envelope around that orchestration, including branch creation,
TDD, verification, publication and required CI.

Evaluate model routing separately from the value of the complete workflow.
The [October Codex first pass](snapshots/2026-10-30-codex-n1.md) measures the
current design against fresh vanilla controls. The
[medium-review follow-up](snapshots/2026-10-30-review-medium-n1.md) reuses those
controls to examine reviewer effort and completes both current tracks. The earlier
[adaptation and fidelity study](adaptation-fidelity.md) and its
[Codex suite](adaptation-fidelity-suite.yaml) compare direct execution with
matched preflight, separate passive native trials from eval enforcement, and
retain failed or unverified evidence.

The earlier matched N=3 localized-routing experiment found Luna equal to Terra
on deterministic task success, 14.6% faster at medium effort, and effectively
wall-time neutral at high effort while using fewer host-reported tokens. Those
two synthetic tasks support only the scoped model-routing choice; they do not
establish a benefit for the complete workflow or its adaptation behavior.

The historical four-way experiment compared the same engineering tasks under:

1. a vanilla single-agent run;
2. the harness's native goal capability;
3. the retired `darrow-goal-loop` child controller;
4. `darrow-ticket-pipeline`.

`darrow-ticket-pipeline` is retained as a reference implementation of the former
static phase approach and as a benchmark baseline. Its historical sequence
used refine, challenge, implementation, independent review, bounded rework, QA,
and codification agents. The initial benchmark averaged 4.0--6.3 child agents per task
and 3.4--5.1 times vanilla wall time. It also passed only 75% of Codex tasks and
50% of Claude tasks in this N=1 corpus, so the evidence supports it as a
historical baseline rather than a demonstrated reliable delivery default.

Those historical modes ran independently on Claude Code and Codex; October's
current-design comparison covers Codex only. Comparisons should be
made primarily within a harness/model/effort block; the cross-harness view also
contains model and CLI differences.

## Results so far

Most historical experiment cells are exploratory **N=1** calibrations. The
localized Terra-versus-Luna comparison is matched **N=3 per case** and is called
out separately below. None of these results is a stable estimate of general
performance. Time and tokens below are means per task. `unknown` means the
harness could not report or reconcile the value, not zero. Quality is the
deterministic task-pass rate followed by the condition-blind 1--5 judge score
when a judge ran.

### October current-design Codex comparison

The [October 30 snapshot](snapshots/2026-10-30-codex-n1.md), with its
[machine-readable results](snapshots/2026-10-30-codex-n1.json), uses the four
original OSS tasks with a `gpt-6.1-sol/medium` main thread and current Adaptive
Goal routing. Implementation and full ticket-to-PR delivery are separate
comparisons. This N=1 first pass recorded **16 attempts: 15 passed and one was
unassessed**. Two earlier completed attempts with CI-fixture defects were
excluded and retained separately.

This compares **two end-to-end delivery strategies with different assurance
processes**, not implementation efficiency at equal assurance. Both full-delivery
conditions require a ticket branch, TDD, verification, commits, push, a ready PR
and green CI. Vanilla performs that work in one context. Darrow can additionally
select explicit readiness and routing checks, native-goal coordination,
independent review and bounded finding-driven repair. The measured difference
includes that additional work; it cannot be attributed solely to orchestration
mechanics or treated as evidence that the assurance is unnecessary.

| Scope                               | Condition     | Passed | Mean wall | Mean tokens | Estimated API-equivalent cost/task |
| ----------------------------------- | ------------- | ------ | --------: | ----------: | ---------------------------------: |
| Implementation, four tasks          | Vanilla       | 4/4    |    132.2s |     413,975 |                             $0.187 |
| Implementation, four tasks          | Adaptive Goal | 4/4    |    561.8s |  ≥5,263,138 |                            ≥$0.958 |
| Full delivery, three assessed pairs | Vanilla       | 3/3    |    188.3s |     801,223 |                             $0.242 |
| Full delivery, three assessed pairs | Ticket to PR  | 3/3    |    607.0s |   6,230,027 |                             $1.263 |

Adaptive Goal took **4.25× the time, ≥12.71× the tokens and ≥5.12× the estimated
model cost** of its matched vanilla controls. On the three assessed delivery
pairs, Ticket to PR took **3.22× the time, 7.78× the tokens and 5.23× the
estimated model cost**. These are complete-workflow comparisons, including
coordination, routed implementation, independent assurance and repair where
selected; they do not isolate the price of review or implementation alone.

Vanilla completed all four delivery tasks, averaging 176.0s. Click delivery with
Ticket to PR was interrupted after 1389.5s by Sevro 1.1.1's fixed **8 MiB
cumulative app-server event-stream limit**. Sevro runs the isolated candidates,
observes Codex and grades the final state; this capture limit belongs to the
benchmark harness. It stopped that attempt before grading, leaving Click's code
and delivery outcomes unknown. The 3.22× ratio therefore covers Express, Ajv and
go-git only. Including the interrupted attempt, the recipe averaged 802.6s per
attempt; that is a separate measure of time spent, not completed delivery time.
Across all four delivery attempts, the recipe also recorded at least 8,225,009
tokens and $1.506 estimated API-equivalent cost per attempt. That includes work
spent on the interrupted Click attempt and remains a lower bound.

**Acceptance correctness tied; assurance differed.** Both vanilla conditions
instructed the same agent to implement, test and self-review; it could fix failures
found by those checks. They prohibited subagents, so there was no independent
review or structured review-finding repair cycle. Darrow adds independent review
and bounded repair when selected; this additional assurance is part of its
measured cost. It is not universal: the Ajv implementation trial omitted optional
independent assurance, while the assessed recipe trials selected verification.
Equal acceptance pass rates do not establish equal review coverage or confidence.

Every assessed condition passed the current acceptance checks. The Click implementation
candidate reported finding and repairing a defect during verification, and host
receipts confirm implementation and verification delegates, but this does not
establish a better final artifact than vanilla's passing implementation. No blind
judge ran, so comparative maintainability and test quality remain unmeasured.
The later targeted Click probe below identifies a behavioral difference beyond
these original acceptance checks.

The original Sevro reports left usage fields null. The
[native-usage retrospective](snapshots/2026-10-30-codex-n1-usage.json) recovers
parent and delegated-session counters from the retained transcripts, counting
each distinct session's final cumulative counters once. Tokens are input plus
output: input includes cached tokens and output includes reasoning. Both Click workflow
captures are partial, so their usage and the affected aggregates are lower
bounds. The Click implementation passed; its partial transcript capture affects
usage completeness, separately from the delivery execution interruption.

Costs use [official OpenAI Standard API prices](https://developers.openai.com/api/docs/pricing)
read on 2026-10-30. Per million uncached input / cached input / output tokens,
GPT-6.1 Sol is $2 / $0.10 / $10 and GPT-6 Luna is $0.10 / $0.01 / $0.50. Each
session is priced on its observed model. Recovered prompts were at most 100,787
input tokens, below the 272K long-context threshold, and recorded no cache writes.
These are normalized API-equivalent estimates, not actual Codex subscription
charges or provider-reported costs. Cached input dominates these runs, so raw
token growth does not translate directly into dollar growth. Actual charges
remain unknown; historical estimates below retain their own dated pricing basis.

For the three assessed recipe deliveries, observed mean estimated spend breaks
down as follows. The session roles follow the retained native delegation paths.

| Session work                                                  | Mean API-equivalent cost/task |
| ------------------------------------------------------------- | ----------------------------: |
| Main thread: implementation and delivery coordination         |                        $0.636 |
| Verification and review coordinators                          |                        $0.452 |
| Two independent review readers                                |                        $0.167 |
| Luna implementation delegate, averaged across all three tasks |                        $0.008 |
| Total                                                         |                        $1.263 |

Only go-git used a Luna implementation delegate; Express and Ajv used Sol
throughout their captured sessions. Sol therefore accounts for over 99% of the
estimated spend in these three recipe trials. The main thread averaged 52 model
requests with 66.2K input tokens per request, versus vanilla's 20.3 requests with
39.1K input tokens. Repeated context is mostly cached, but still contributes
usage and estimated cost. Additional assurance and coordination both contribute;
these figures do not establish that either coordinator layer can be removed
without losing useful work. A comparison with the same assurance requirements
and routes is needed to isolate orchestration overhead.

The old Codex ticket pipeline took **5.1× its contemporary vanilla baseline**
(1110.4s / 216.5s) and passed 3/4 tasks. The current recipe's smaller observed
3.22× multiplier is an encouraging historical signal, especially with publication
and CI now in scope. It is not a controlled estimate of improvement: models,
host versions and checks changed, the old pipeline excluded publication, and
the current delivery comparison is missing Click. The original prompts and
upstream revisions are preserved; the snapshot records the changed checks.

Host receipts establish main-thread native-goal completion in all seven assessed
Adaptive Goal or recipe trials, and no goal events or accepted subagent spawns
in any vanilla control. These observations validate the execution conditions;
they do not prove every capability's internal protocol or a quality benefit.
The medium-review follow-up uses an isolated capture-budget patch to complete
Click. Broader blind assessment of final code and tests remains unmeasured.

### Sol 6.1/medium reviewer follow-up

The [follow-up snapshot](snapshots/2026-10-30-review-medium-n1.md) records
**eight completed cells: 8/8 original acceptance passes, 8/8 completed native
goals and 8/8 complete usage captures**. All 15 observed independent reader
sessions used `gpt-6.1-sol/medium`. The main thread remained Sol 6.1/medium;
implementation routing stayed under the current policy. Vanilla controls are
reused from the first pass.

| Four-task scope | Condition                     | Mean wall | Mean tokens | Estimated API-equivalent cost/task |
| --------------- | ----------------------------- | --------: | ----------: | ---------------------------------: |
| Implementation  | Adaptive Goal, medium readers |    485.9s |   4,645,859 |                             $0.829 |
| Full delivery   | Ticket to PR, medium readers  |    649.3s |   6,094,186 |                             $1.205 |

Against the archived four-task vanilla controls, these are **3.68× and 3.69×
the time**, **11.22× and 7.97× the tokens**, and **4.43× and 5.11× the estimated
cost**, respectively. The different assurance processes described above still
apply; these are not equal-assurance efficiency ratios.

The old Click captures prevent a complete four-task usage comparison between
reviewer efforts. Express, Ajv and go-git have complete captures in both:

| Three complete pairs | Xhigh mean wall | Medium mean wall | Xhigh mean tokens | Medium mean tokens | Xhigh estimated cost | Medium estimated cost |
| -------------------- | --------------: | ---------------: | ----------------: | -----------------: | -------------------: | --------------------: |
| Implementation       |          384.3s |           473.1s |         3,467,775 |          4,173,253 |               $0.656 |                $0.802 |
| Full delivery        |          607.0s |           533.1s |         6,230,027 |          4,731,521 |               $1.263 |                $1.024 |

On those three delivery pairs, medium was **12% faster, used 24% fewer tokens
and cost 19% less**. Its time ratio to the same vanilla controls is **2.83×**,
versus 3.22× previously. The new four-task 3.69× ratio includes Click, which
the old assessed comparison omitted; those two headline ratios cover different
task sets.

Across all four implementation tasks, medium was 13% faster. The aggregate
improvement comes from Click, where the medium implementation missed a real
defect that the earlier xhigh workflow discovered and repaired. The other three
pairs were **23% slower and 22% costlier**. Ajv implementation selected no
independent review in either run, so reviewer effort cannot explain that pair's
change.

Independent-reader cost across five complete pairs with readers in both
conditions averaged **$0.143 at xhigh versus $0.086 at medium: 40% lower**.
Whole-workflow savings varied. On the three complete implementation pairs,
main-thread requests rose from 29 to 40 per task. Main and coordinator costs
increased while reader cost fell slightly. Both efforts use the same unit
prices; the estimates vary with observed usage. The
[usage record](snapshots/2026-10-30-review-medium-n1-usage.json) and
[results JSON](snapshots/2026-10-30-review-medium-n1.json) retain the counters,
role attribution, actual routes and complete-pair comparisons.

Sevro's copied stream limit was raised from 8 to 128 MiB, with compatible larger
transcript capture and view budgets. The installed package and shipped reviewer
catalog remain unchanged. Click delivery completed, and its retained native
transcripts exceeded the former 5 MiB capture budget. A separate deterministic
transport probe confirmed that the patched source and executable accept a valid
stream over 8 MiB that the original rejects; the public run artifacts do not
report the live cumulative stream byte counter.

One additional Click implementation attempt passed code checks but its goal was
blocked because fixture-created review storage had mode `0755`. No readers
launched. A fresh snapshot enforced `0700` before its replacement. The excluded
attempt's **443.8s, 5,109,566 tokens and $0.632 estimated cost** remain separate
from valid-cell means. The eight valid cells total $8.139 API-equivalent cost,
or $8.770 including that attempt; actual Codex charges remain unknown.

These are **N=1** observations. Implementation choices, assurance work, findings
and repair can vary even under the same routing policy. The temporary observer
patch removes a previous stopping condition. These results do not isolate a
causal reviewer-effort effect or establish equal review quality.

### Consequence risk, reasoning profiles and actual implementors

The retained root-thread messages, goal objectives and route-helper arguments
record two separate classifications. **Consequence risk** controls required
checks and assurance: `routine` covers localized, reversible work with limited
blast radius; `elevated` covers compatibility, affected consumers or persisted
formats; `high` covers security, authorization or similarly serious consequences.
The **reasoning profile** controls the implementation route: `routine` means
clear localized work, `routine-plus` adds meaningful implementation tradeoffs or
an explicit first-pass boundary-correctness priority, and `scaled` means
straightforward multi-component work. Neither batch selected `repo-wide` or
`judgment`. Risk and reasoning demand are independent; high risk does not by
itself require a stronger implementation model.

The latest medium-review batch selected:

| Task                    | Adaptive Goal risk | Adaptive Goal profile | Ticket to PR risk | Ticket to PR profile |
| ----------------------- | ------------------ | --------------------- | ----------------- | -------------------- |
| Express header escaping | High               | `routine`             | High              | `routine`            |
| Click stream capture    | Elevated           | `routine-plus`        | Elevated          | `routine-plus`       |
| Ajv instance paths      | Routine            | `routine`             | Elevated          | `scaled`             |
| Go-git `insteadOf`      | Elevated           | `routine`             | Elevated          | `routine`            |

Express's header-injection boundary justified high consequence risk, while its
explicit localized transformation qualified as routine implementation. Click's
public API compatibility raised risk, and buffering and chronological write
ordering supplied the implementation tradeoff for `routine-plus`. Go-git's
public field and configuration compatibility raised risk despite a localized,
specified implementation. Both tracks selected independent review for these
three tasks.

Ajv shows a material classification difference. Adaptive Goal selected routine
risk and omitted independent assurance; Ticket to PR selected elevated
compatibility risk, a scaled implementation profile and independent acceptance
review. This contributes different work to their totals. It is an observed
decision difference, not evidence that either classification is the uniquely
correct one.

Profiles also changed between the xhigh and medium batches: Adaptive Goal's Ajv
changed from `routine-plus` to `routine`, and Ticket to PR's Click changed from
`routine` to `routine-plus`. The other six selected profiles stayed the same.
Under the benchmark's Codex catalog, `routine` selects Luna 6/medium,
`routine-plus` selects Luna 6/high, and `scaled` selects Sol 6.1/medium.

A selected route does not establish which model authored the implementation.
The Sol 6.1/medium main thread may implement directly when a lower-cost handoff
does not repay its coordination cost. Actual implementation placement was:

| Task    | Adaptive Goal, xhigh batch | Adaptive Goal, medium batch | Ticket to PR, xhigh batch | Ticket to PR, medium batch |
| ------- | -------------------------- | --------------------------- | ------------------------- | -------------------------- |
| Express | Direct Sol 6.1/medium      | Direct Sol 6.1/medium       | Direct Sol 6.1/medium     | Direct Sol 6.1/medium      |
| Click   | Delegated Luna 6/high      | Delegated Luna 6/high       | Delegated Luna 6/medium   | Delegated Luna 6/high      |
| Ajv     | Delegated Luna 6/high      | Delegated Luna 6/medium     | Direct Sol 6.1/medium     | Direct Sol 6.1/medium      |
| Go-git  | Direct Sol 6.1/medium      | Direct Sol 6.1/medium       | Delegated Luna 6/medium   | Direct Sol 6.1/medium      |

The old Click delivery route describes an interrupted attempt, not a completed
delivery. The [first-pass usage](snapshots/2026-10-30-codex-n1-usage.json) and
[follow-up usage](snapshots/2026-10-30-review-medium-n1-usage.json) retain actual
session models; the corresponding result snapshots reference the native
transcripts containing classification and placement decisions.

Classification and placement are additional variables in this comparison.
Keeping the main thread and routing policy fixed did not hold the selected
profile, implementor model or assurance work constant. These runs therefore
cannot isolate the effect of changing independent readers from xhigh to medium.

### Why full delivery takes longer than implementation

In the medium batch, Ticket to PR averaged **649.3s versus Adaptive Goal's
485.9s: 34% longer**. It builds on Adaptive Goal but has a broader completion
condition: ticket retrieval and readiness, branch preparation, commit, push,
PR publication, required CI and handover, alongside selected assurance. The
implementation track ends after implementation and its selected verification.

| Task    | Adaptive Goal wall | Ticket to PR wall | Delivery minus implementation |
| ------- | ------------------ | ----------------- | ----------------------------- |
| Express | 534.2s             | 481.9s            | -52.3s                        |
| Click   | 524.5s             | 998.0s            | +473.5s                       |
| Ajv     | 355.3s             | 606.2s            | +250.9s                       |
| Go-git  | 529.9s             | 511.1s            | -18.7s                        |

Click accounts for about **72% of the net time difference**. Delivery review
found a defect that the implementation review missed, triggering repair and
fresh verification. Ajv delivery selected independent review where the
implementation trial omitted it, and used direct Sol implementation rather
than a Luna delegate. Express and go-git deliveries finished faster despite
their broader scope. These independently authored N=1 candidates do not measure
a fixed wrapper overhead; the gap includes different implementation, assurance,
finding and repair decisions as well as the additional delivery work.

### Reviewer effort: Click exposes a quality boundary

The [supplemental Click probe](snapshots/2026-10-30-review-medium-n1-click-probe.json)
shows that the original acceptance tie missed a real boundary. The earlier
xhigh Spec reader found that inheriting `io.BytesIO.writelines` bypassed the
capture class's `write` override. Binary writes reached the separate stream but
were absent from combined output. The author repaired that finding. In the
medium-review implementation trial, both independent readers approved an
implementation with the same defect class. In the medium-review delivery trial,
the Spec reader caught it, and a fresh medium reader verified the repair.

The same public `CliRunner` probe exercises binary `write` and `writelines` on
stdout and stderr, interleaved with text without explicit flushing:

| Retained Click source                         | Probe checks passed |
| --------------------------------------------- | ------------------: |
| Vanilla implementation                        |                 2/4 |
| Vanilla full delivery                         |                 2/4 |
| Adaptive Goal with xhigh review, after repair |                 4/4 |
| Adaptive Goal with medium review              |                 2/4 |
| Ticket to PR with medium review, after repair |                 4/4 |

Every source passes the two ordinary `write` checks. Both vanilla sources and
the medium-reviewed implementation lose the `writelines` content from combined
output. Both repaired sources preserve it. Independent review contributed useful
defect discovery beyond same-context self-review and the original hidden checks.
Medium detected the defect in one trial and missed it in another; this small
sample does not establish a reliable quality ranking between efforts. A shorter
workflow can omit useful discovery and repair, so latency savings alone do not
establish equal quality.

This is a post hoc probe selected from the earlier finding, not a blind judge
or a detection-rate estimate. Source files were reconstructed from retained
native diffs against pinned Click 8.0.0; reconstructed Git blob identities match
the diff indexes. The probe record retains artifact hashes, source identities,
the executable probe and observed results. Original benchmark verdicts and
acceptance checks remain unchanged. Old xhigh Click delivery was unassessed,
so it supplies no completed delivery comparator.

### What the retained implementations teach us

The [source comparison](snapshots/2026-10-30-implementation-comparison.md), with
[machine-readable evidence](snapshots/2026-10-30-implementation-comparison.json),
contrasts the October variants across 24 attempts, 23 assessed. It verifies 78
retained file identities and adds targeted characterization without changing
original task verdicts or running new model trials.

| Task    | Observed distinction                                                                                                                                       | Learning                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Express | Vanilla delivery and medium Adaptive Goal have byte-identical handler code; their tests differ.                                                            | Additional assurance can increase confidence without changing the algorithm. |
| Click   | Similar buffer-copy designs differ on inherited `writelines`; latest Ticket to PR also preserves the two-stream `isolation()` return shape.                | Exercise alternate entrypoints and account for public API changes.           |
| Ajv     | Some extend existing specs; the latest Ticket to PR adds a `.test.js` file outside upstream's `.spec.{ts,js}` discovery pattern, though it ran explicitly. | Test creation and direct execution do not establish normal CI discovery.     |
| Go-git  | Earlier xhigh Ticket to PR uses `SetOption`; the other retained serializers preserve edits to prefix order and multiplicity.                               | Verify helper semantics with stateful edit-and-round-trip checks.            |

The new Go probe runs the same public `Config` sequence against all six retained
go-git sources: unmarshal, edit `URL.InsteadOf`, marshal, then unmarshal again.
The xhigh Ticket to PR source passes 2/4 checks: it preserves the old order after
reordering the public slice, and loses an added duplicate of an existing value.
The other five sources pass 4/4. Both xhigh readers had cleared that source. This
is a supplemental observation beyond the original hidden checks, which do not
exercise these mutations.

Together with Click, this supports independent review's ability to find useful
defects, but does not establish a dependable quality ordering by reviewer effort.
Vanilla also produced competent implementations and substantial regressions.
The useful assurance targets here are alternate API paths, mutable-state
sequences, and repository test integration. A reviewer-effort comparison on the
same frozen patch would isolate review behavior more clearly than these separate
whole-workflow trials.

All eight vanilla controls authored regression tests and ran checks. They also
self-reviewed and could repair failures found in that context. Their retained
test changes include:

| Task    | Vanilla implementation                                                          | Vanilla full delivery                                                           |
| ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Express | `test/res.links.js`                                                             | `test/res.links.js`                                                             |
| Click   | `tests/test_testing.py`, with affected-caller changes in `tests/test_termui.py` | `tests/test_testing.py`, with affected-caller changes in `tests/test_termui.py` |
| Ajv     | New `spec/jtd-parser.spec.js`                                                   | New `spec/jtd-parser-instance-path.spec.js`                                     |
| Go-git  | `config/url_test.go` and `config/config_test.go`                                | `config/url_test.go` and `config/config_test.go`                                |

The Ajv files were initially untracked and absent from ordinary tracked-file
diffs; retained file-writing commands and test runs establish their creation.
Passing suite totals include existing tests and must not be reported as counts
of newly authored regressions. Vanilla's assurance limitation is the absence of
independent review and a structured review-finding repair cycle, not an absence
of tests or self-correction.

The comparison uses identified retained source snapshots, which can precede
later edits not accompanied by another full diff. It is not a blind final-code
ranking; the linked record states the scope and reconstruction limits.

### Historical API pricing basis

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
candidate model fixed within each harness. Its historical `darrow-goal-loop`
rows describe the retired child-controller implementation, not the current
Adaptive Goal preflight.

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
At the recorded API rates, workflow-only cost 2.5% less than raw native, while
workflow plus risk cost 21.4% more than raw native and 24.5% more than
workflow-only.

### GPT-5.6 task-oriented routing

The [routing calibration](snapshots/2026-08-08-gpt-5.6-routing-router-n1.md)
compared raw Sol/medium native goal, the former policy, and the then-promoted
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
but under the recorded cached-input pricing its estimated cost was 67.6% lower
because ordinary work ran on Luna/high or Terra/medium instead of Sol/medium.
It was 68.7% cheaper than the former policy, whose current-price estimate is
3.4% higher than raw native. This is the clearest cost signal in those routing
conditions: task-specific workflow and verification remain available
while model routing can reduce cost. The quality and latency result still needs
N>=3 replication on matching routes in that OSS corpus before it should be
treated as a general performance claim.

### Localized Terra versus Luna routing

The [matched N=3 snapshot](snapshots/2026-08-19-localized-luna-routing-n3.md),
with its [machine-readable companion](snapshots/2026-08-19-localized-luna-routing-n3.json),
compares Terra and Luna at medium and high effort on the same two localized
tasks. Every one of the 24 trials passed all hidden behavior checks.

| Effort | Terra pass / wall | Luna pass / wall | Luna wall delta | Luna token delta |
| ------ | ----------------: | ---------------: | --------------: | ---------------: |
| medium |      6/6 / 452.2s |     6/6 / 386.3s |          -14.6% |           -53.6% |
| high   |      6/6 / 524.6s |     6/6 / 524.3s |          -0.05% |           -47.1% |

This promotes Luna/medium for `routine` and Luna/high for `routine-plus`.
Because the corpus is small and synthetic, it does not change the untested
Terra routes for `scaled` or `repo-wide`, or the Sol route for `judgment`.

### August adaptive result versus raw Sol native

The [verification-cadence retrospective](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.md),
with its [machine-readable companion](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.json),
reprices the then-accepted raw Sol/medium controls and adaptive trials
using the recorded cached-input rates. The same three case contracts are unchanged,
but the runs are non-contemporaneous and used Codex CLI 0.145.0 versus 0.147.0.

| Variant                | Reviewed behavior | Mean wall | Mean tokens | Estimated cost/task |
| ---------------------- | ----------------: | --------: | ----------: | ------------------: |
| Raw native Sol/medium  |               3/3 |    283.3s |   1,029,850 |              $1.043 |
| August adaptive policy |               3/3 |    293.6s |     842,059 |              $0.407 |
| **Adaptive delta**     |          **same** | **+3.6%** |  **-18.2%** |          **-61.0%** |

The unmodified adaptive suite reports 1/3 because Cobra and Express retain stale
dimension or route expectations; every repository behavior check passed. This
retrospective was the August end-to-end value comparison. Prescribing the
expected lower route to native goal remains useful only as a secondary ablation
of preflight and verification overhead after model selection is supplied for
free.

The earlier experiments supported native goal as the execution mechanism,
lightweight workflow preflight as roughly efficiency-neutral in those conditions,
and task-oriented model selection as a promising cost lever. October confirms
the current main-thread execution model, but measures substantially more wall
time than fresh vanilla without an observed acceptance advantage. The recovered
usage also shows higher Standard API-equivalent model cost than fresh vanilla;
historical routing savings do not establish current workflow savings. The extra
cost buys a different assurance process, whose incremental defect-detection value
has not been isolated by this corpus. These measurements establish the price of
the observed delivery strategies, not their relative efficiency at equal
assurance. They do not establish that the additional assurance is unnecessary,
or justify restoring the retired controller or making the static ticket pipeline
the default.

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

For current main-thread Adaptive Goal and ticket-to-PR comparisons on Codex,
use the [current value calibration](CURRENT-VALUE.md).
The [October Codex first pass](snapshots/2026-10-30-codex-n1.md) records its results
and the unassessed host-limited cell.

The default is five trials for all four modes on both harnesses, followed by a
fixed Codex quality judge:

```sh
bun run eval:orchestration -- --trials 5
```

The three canonical profile-impact, localized-routing, and promoted-routing
suites now compare task outcomes and independently observed native owner
model/effort routes on Codex. They retain historical experiment/mode names and
condition text, while retiring private profile, workflow, risk, and goal-contract
assertions. Parent case routes remain separate. Their enforced defaults remain
explicit: the Sevro route can prepare dry cells, but its bundled hosts reject
enforced execution. This does not establish a live comparison or convert the
condition to passive. See
[benchmark migration validation](../../../docs/research/sevro-extraction.md#benchmark-migration-validation).

Useful scoped and calibration runs:

```sh
# Validate fixtures without a paid model call.
bun evals/runner/suite.ts --harness codex --mode vanilla --case oss-go-git --trials 1 --dry

# Run one within-harness matrix with a chosen candidate and judge model.
bun evals/runner/suite.ts --harness claude --trials 3 \
  --claude-model claude-sonnet-5 \
  --judge-harness codex --judge-model gpt-5.6-sol

# Omit advisory judging during a cheap calibration pass.
bun evals/runner/suite.ts --trials 1 --no-judge

# Compare historical condition variants by task and native owner route on Codex.
bun evals/runner/suite.ts \
  --suite evals/experiments/orchestration/profile-impact-suite.yaml \
  --harness codex --trials 3

# Measure adaptive overhead against native execution on prescribed case routes.
bun evals/runner/suite.ts \
  --suite evals/experiments/orchestration/promoted-routing-suite.yaml \
  --harness codex --trials 1 --no-judge
```

The suite writes one Sevro JSON result per cell, `suite-run.json`, and reports
under its printed absolute results directory. Read the per-cell `cells[].result`
from the manifest to report a retained run without rerunning candidates:

```sh
bunx --no-install sevro report --json --result-file /absolute/path/to/cell-result.json
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
`plugins/orchestration/darrow-adaptive-goal/config/routes.json` policy; the snapshot
retains the historical comparison and subsequent promotion rationale.

The [August Sol-baseline retrospective](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.md),
with its [machine-readable snapshot](snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.json),
records the August verification-cadence result, cached-input cost reconstruction,
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
  failure. This is a historical metric; the October conditions use observed
  native-goal and delegation evidence without requiring those legacy records.
- **Full delivery completion:** the final checkout, pushed branch and open PR
  agree, required CI genuinely passed on that commit, and the handover identifies
  its commit and PR. This is measured separately from code acceptance.
- **Blind quality score:** an advisory LLM judgment of correctness,
  maintainability, test quality, and scope discipline. The judge sees the task,
  check outcomes, and final diff, but not the orchestration condition. October's
  first pass omitted this judge.
- **Candidate efficiency:** wall time, input/output tokens, and actual provider
  cost when the harness supplies it.
- **Delegation and interventions:** child model invocations and explicit human
  interventions. An intervention is a stop for a person's decision or missing
  authority, not routine autonomous reasoning.
- **Judge overhead:** judge tokens and cost, reported separately from the
  candidate run.

Setup and dependency installation happen before candidate timing. Claude Code's
reported provider cost is recorded as actual cost. Historical Codex adapters
reported tokens without a monetary amount; the historical tables reconstruct
standard API cost from model-specific uncached input, cached input, and output
rates. October's app-server headline results report neither token usage nor monetary cost;
the linked retrospective separately recovers retained native counters and estimates
Standard API-equivalent model cost. Actual October charges remain unknown.
When separately launched child usage cannot be reconciled, cost is reported as
a parent-session lower bound or remains `unknown`, never as a complete estimate.

## Fairness and interpretation

The following controls describe the historical suites. The October first pass
uses the separately documented [current comparison conditions](CURRENT-VALUE.md):
matching engineering requirements within each track, fresh vanilla controls,
current capability mounts, passive native observation and separate delivery
authority. Its single-cell runs do not establish the historical suite's shuffled
multi-cell order, and its implementation and delivery tracks have different scopes.

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
  whether extra workflow and assurance cost is justified.
