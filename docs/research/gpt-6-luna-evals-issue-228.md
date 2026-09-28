# GPT-6 Luna eval results for issue #228

Run date: 2026-09-24. Codex CLI 0.156.1. The direct runner used `gpt-6-luna` at `medium`, one live trial per case, and a 100% single-trial threshold. Its normal semantic-output grader remained `gpt-5.6-luna` at `low`. Six shards covered 361 unique cases with no missing or duplicate case: **275 passed, 86 failed**. Every shard wrote a complete result file; exit code 1 reflects failed cases.

This is one observation per case, not a stability estimate. “Skill likely” means the retained answer, activation, or fixture state missed an observable requirement. “Eval likely” means the check appears to contradict the retained answer or its own proposition. “Mixed / uncertain” needs a deterministic checker audit and a fresh trial before changing product policy. “Candidate (no skill)” names the skill-less experiments, where no skill defect can be assigned. Four Claude-native cases were run by the unfiltered Codex runner; their recorded failures are host-route mismatches, not valid Luna behavior evidence. The baseline counts remain fixed; updated rows below record later repairs and reruns separately.

The sweep covers the runner's 361 discovered cases and the 22-question repository-guide driver. Explicit comparative experiment suites still name their historical Terra, Sol, and Luna routes; their multi-mode comparisons and frozen snapshots were outside this candidate-default sweep. In the tables, “What failed” names the failed assertion when the trace does not establish a more specific observed cause.

A broad runner unit run exposed review-oracle failures on both Bash variants. The focused model-default, adapter, suite, compatibility, typecheck, lint, and docs checks passed after the route change. Review rows are therefore marked mixed until the deterministic oracle is repaired and the live case is rerun.

Raw result arrays are local and gitignored under `evals/results/issue-228-gpt-6-luna-medium/`. The `evals/results/issue-228-gpt-6-luna-medium/summary.json` confirms complete coverage. Each case ID below links to its YAML source; search the ID in the six shard files for its response, checks, and transcript evidence.

## Plugin overview

| Owner                           | Cases | Passed | Failed |
| ------------------------------- | ----: | -----: | -----: |
| Repository guide                |    22 |     14 |      8 |
| Skill-less experiments          |    16 |     10 |      6 |
| darrow-adaptive-delivery        |    62 |     39 |     23 |
| darrow-artificer                |     7 |      7 |      0 |
| darrow-decisions                |    16 |     15 |      1 |
| darrow-discovery                |    19 |     17 |      2 |
| darrow-explanation              |     9 |      4 |      5 |
| darrow-git                      |    48 |     47 |      1 |
| darrow-information-architecture |    23 |     18 |      5 |
| darrow-observability-langfuse   |     8 |      6 |      2 |
| darrow-readiness-gate           |    16 |     13 |      3 |
| darrow-review                   |    30 |     21 |      9 |
| darrow-skill-authoring          |     9 |      8 |      1 |
| darrow-tdd                      |    11 |      6 |      5 |
| darrow-ticket-pipeline          |    10 |      8 |      2 |
| darrow-ticket-to-pr             |    12 |      6 |      6 |
| darrow-tickets                  |    27 |     24 |      3 |
| darrow-verification             |    16 |     12 |      4 |

## Failed direct-runner cases

### Repository guide

| Case                                                                                        | What failed                                                                                                                                                                                           | Assessment         | Recommended next step                                                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| [guide-follow-up](../../.agents/skills/darrow-guide/evals/guide-follow-up.yaml)             | It recommends a read-only readiness assessment and explains that non-ready verdicts can still succeed, but it does not clearly state that this is the first workflow.                                 | Skill likely       | Identify the readiness assessment as the first workflow; rerun.                                     |
| [guide-incomplete](../../.agents/skills/darrow-guide/evals/guide-incomplete.yaml)           | Activation missed darrow-guide; observed none.                                                                                                                                                        | Skill activation   | Check trigger and mounted-skill discovery; rerun this case with a matched control.                  |
| [guide-mutation](../../.agents/skills/darrow-guide/evals/guide-mutation.yaml)               | The guide refused installation and made no changes; the grader treated a warning about possible project installation effects as a current effect.                                                     | Eval likely        | Calibrate the semantic proposition with this response and a counterexample, then run a fresh trial. |
| [guide-rationale](../../.agents/skills/darrow-guide/evals/guide-rationale.yaml)             | It establishes native ownership and explicit orchestration, and describes the ticket pipeline as a retained reference, but it does not clearly establish that the pipeline is the benchmark baseline. | Skill likely       | State that the ticket pipeline is the retained benchmark baseline; rerun.                           |
| [guide-recipes](../../.agents/skills/darrow-guide/evals/guide-recipes.yaml)                 | The answer described the saved-grant entry and one delegation, but the semantic grader rejected that point.                                                                                           | Eval likely        | Calibrate the semantic proposition with this response and a counterexample, then run a fresh trial. |
| [guide-selection](../../.agents/skills/darrow-guide/evals/guide-selection.yaml)             | It supports selection by intent and independent adoption, and makes no forbidden installation/testing/diagnosis claims, but it does not establish that no mandatory orchestrator is required.         | Skill likely       | State that Review can be adopted without an orchestrator; rerun.                                    |
| [guide-troubleshooting](../../.agents/skills/darrow-guide/evals/guide-troubleshooting.yaml) | Nearby repository evidence failed. Activation missed darrow-guide; observed none.                                                                                                                     | Skill + activation | Repair the failed behavior and trigger; rerun this case and its matched control.                    |
| [guide-visual-present](../../.agents/skills/darrow-guide/evals/guide-visual-present.yaml)   | It provides a compact layer diagram and makes no forbidden claims, but it does not identify automation as bounded grant-authorized admission or distinguish it from engineering ownership.            | Skill likely       | Label automation as grant-authorized admission distinct from engineering ownership; rerun.          |

### Skill-less experiments

| Case                                                                                                                        | What failed                                                                                                                                                | Assessment           | Recommended next step                                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| [orchestration-oss-click-streams](../../evals/experiments/orchestration/cases/oss-click-streams.yaml)                       | Hidden stream interleaving contract failed.                                                                                                                | Candidate (no skill) | Inspect the candidate trace and failing task check; repair the task outcome or fixture, then rerun. |
| [orchestration-oss-go-git-insteadof](../../evals/experiments/orchestration/cases/oss-go-git-insteadof.yaml)                 | Hidden multiple insteadOf contract failed.                                                                                                                 | Candidate (no skill) | Inspect the candidate trace and failing task check; repair the task outcome or fixture, then rerun. |
| [skill-composition-explicit-child-claude](../../evals/experiments/skill-composition-probe/cases/explicit-child-claude.yaml) | Child body created its private observation failed. Also: child observation is the only untracked product, child reports successful invocation (+1 checks). | Eval route mismatch  | Exclude from the Luna result claim; run this case on its native Claude harness.                     |
| [skill-composition-explicit-child-codex](../../evals/experiments/skill-composition-probe/cases/explicit-child.yaml)         | Child body created its private observation failed. Also: child observation is the only untracked product, child reports successful invocation (+1 checks). | Candidate (no skill) | Inspect the candidate trace and failing task check; repair the task outcome or fixture, then rerun. |
| [skill-composition-open-child-claude](../../evals/experiments/skill-composition-probe/cases/open-child-claude.yaml)         | Child body created its private observation failed. Also: child observation is the only untracked product, child reports successful invocation (+1 checks). | Eval route mismatch  | Exclude from the Luna result claim; run this case on its native Claude harness.                     |
| [skill-composition-open-child-codex](../../evals/experiments/skill-composition-probe/cases/open-child-codex.yaml)           | Child body created its private observation failed. Also: child observation is the only untracked product, child reports successful invocation (+1 checks). | Candidate (no skill) | Inspect the candidate trace and failing task check; repair the task outcome or fixture, then rerun. |

### darrow-adaptive-delivery

| Case                                                                                                                                                                                   | What failed                                                                                                                                                                                                      | Assessment          | Recommended next step                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| [claude-readiness-nonready-stops](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/claude-readiness-nonready-stops.yaml)                            | Claude returns the complete readiness result failed. Also: Claude invokes the readiness skill exactly once.                                                                                                      | Eval route mismatch | Exclude from the Luna result claim; run this case on its native Claude harness.           |
| [doctor-adaptive-delivery-counterexample-depth](../../plugins/orchestration/darrow-adaptive-delivery/skills/doctor-adaptive-delivery/evals/counterexample-depth.yaml)                  | The response says the full path is supported with five slots, contradicting the proposition's claim of only three slots and unsupported capacity.                                                                | Skill likely        | Use the fixture’s effective three-slot limit rather than the inherited host value; rerun. |
| [doctor-adaptive-delivery-effective-project](../../plugins/orchestration/darrow-adaptive-delivery/skills/doctor-adaptive-delivery/evals/effective-project.yaml)                        | It reports concurrency 5 as adequate and identifies the checkout source, but does not clearly state that the checkout value is an effective project override.                                                    | Skill likely        | Repair project precedence is effective; rerun this focused orchestration case.            |
| [goal-budgeted-repair-invocation-limit](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/budgeted-repair-invocation-limit.yaml)                     | The response authorizes one more repair attempt and says the contract allows four, rather than stopping because the stricter limit is exhausted; it also does not explicitly withhold completion or publication. | Skill likely        | Enforce the shared repair budget and stop boundary; rerun this case.                      |
| [goal-failed-check-blocks-publication](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/failed-check-blocks-publication.yaml)                       | No parent repository or external work occurs after owner acceptance failed.                                                                                                                                      | Skill likely        | Stop parent repository work after owner acceptance; rerun the case.                       |
| [goal-intent-capability-bindings](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/file-backed-capability-routing.yaml)                             | Requested behavior is implemented failed. Also: selected independent review remains composed before publication, commit capability creates the one intended commit (+5 checks).                                  | Skill likely        | Bind the selected review and commit capabilities through the owner; rerun.                |
| [goal-preflight-bounded-native-goal](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/bounded-native-goal.yaml)                                     | Behavior is implemented failed. Also: focused tests are durable, verification evidence is returned (+3 checks).                                                                                                  | Skill likely        | Repair preflight, owner route, and required behavior; rerun the focused case.             |
| [goal-preflight-high-risk-routine](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/high-risk-routine.yaml)                                         | Cookie behavior is changed and preserved failed. Also: focused evidence covers the strict value, clear independent review returns control to the goal (+6 checks).                                               | Skill likely        | Repair preflight, owner route, and required behavior; rerun the focused case.             |
| [goal-preflight-intent-change-vs-migration](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/intent-change-vs-migration.yaml)                       | Sequenced persisted-format transition works failed. Also: migration compatibility receives one independent review, independent review covers the migrated final target (+5 checks).                              | Skill likely        | Repair preflight, owner route, and required behavior; rerun the focused case.             |
| [goal-preflight-routing-difficult-routine-diagnosis](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/routing-difficult-routine-diagnosis.yaml)     | Trailing delimiter regression is fixed failed. Also: diagnosis and verification evidence are returned, judgment policy route is applied to the owner (+1 checks).                                                | Skill likely        | Repair preflight, owner route, and required behavior; rerun the focused case.             |
| [goal-readiness-prior-assessed-omitted](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/readiness-prior-assessed-omitted.yaml)                     | No parent repository or external work occurs after owner acceptance failed.                                                                                                                                      | Skill likely        | Stop parent repository work after owner acceptance; rerun the case.                       |
| [goal-readiness-scope-changed](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/readiness-scope-changed.yaml)                                       | Changed-scope plan is implemented failed. Also: material scope change reruns readiness, changed scope launches one separate owner after readiness (+1 checks).                                                   | Skill likely        | Reassess readiness after the material scope change before implementation; rerun.          |
| [goal-real-create-commit-composition](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/real-create-commit-composition.yaml)                         | One pull request publishes the exact committed branch failed. Also: checks and review precede publication, owner reports completion.                                                                             | Skill likely        | Complete the checked commit-to-PR handoff on the exact branch; rerun.                     |
| [goal-review-high-selected-claude](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/review-high-selected-claude.yaml)                               | Cookie behavior is changed and preserved failed. Also: focused evidence covers the strict value, high risk invokes one matching independent review (+6 checks).                                                  | Eval route mismatch | Exclude from the Luna result claim; run this case on its native Claude harness.           |
| [goal-review-repair-verification](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/review-repair-rereview.yaml)                                     | Authorized repair reaches the approved outcome failed. Also: blocking target is repaired and fix verified, invalidated checks run before each review (+7 checks).                                                | Skill likely        | Repair the review handoff and final evidence sequence; rerun this case.                   |
| [goal-ticket-branch-ambiguity](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/ticket-branch-ambiguity.yaml)                                       | It mentions the two existing branches but also presents the new suffix as an option, so it does not restrict selection to exactly one existing match.                                                            | Skill likely        | Use the exact bound branch choice and capability; rerun the branch case.                  |
| [goal-ticket-branch-create](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/ticket-branch-create.yaml)                                             | Creates the bound branch for the exact opaque token failed. Also: only one branch is added, requested work is implemented. Activation contract failed; observed adaptive-delivery.                               | Skill + activation  | Repair the failed behavior and trigger; rerun this case and its matched control.          |
| [goal-ticket-branch-reuse](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/ticket-branch-reuse.yaml)                                               | Activation contract failed; observed adaptive-delivery, create-branch, prepare-task-branch.                                                                                                                      | Skill activation    | Check trigger and mounted-skill discovery; rerun this case with a matched control.        |
| [goal-verification-existing-review](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-existing-review.yaml)                             | Real provider returns a closed clear repair assessment failed. Also: no parent repository or external work occurs after owner acceptance.                                                                        | Skill likely        | Repair the review handoff and final evidence sequence; rerun this case.                   |
| [goal-verification-incomplete-blocks-publication](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-incomplete-blocks-publication.yaml) | Current checks and review precede incomplete verification failed.                                                                                                                                                | Skill likely        | Require current combined verification before continuation; rerun this case.               |
| [goal-verification-oscillation](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-oscillation.yaml)                                     | The response permits another materially different repair attempt if identified, so it does not require stopping as blocked solely because the remaining attempt lacks authority.                                 | Skill likely        | Stop blocked when no authorized distinct repair remains; rerun.                           |
| [goal-verification-shared-exhausted](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-shared-exhausted.yaml)                           | The response authorizes one more repair attempt rather than stopping as blocked under the exhausted shared budget.                                                                                               | Skill likely        | Stop when the shared repair budget is exhausted; rerun.                                   |
| [goal-verification-stale-evidence](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/verification-stale-evidence.yaml)                               | It requires fresh QA and a clear combined result before completion, but does not address or reject provider pass or remaining budget as substitutes for current QA evidence.                                     | Skill likely        | Reject stale or provider-only evidence; require current combined QA, then rerun.          |

### darrow-decisions

| Case                                                                                                                                     | What failed                                                                                                                      | Assessment            | Recommended next step                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| [capture-decision-proposed-provenance](../../plugins/foundation/darrow-decisions/skills/capture-decision/evals/proposed-provenance.yaml) | The saved ADR distinguished a user statement from an assumption, but the artifact check required the literal word “observation.” | Eval defect, repaired | Grade the saved ADR semantically; the focused retest passed 5/5. |

Follow-up: The persisted ADR now has a semantic provenance gate alongside its deterministic status, catalog, and validation checks. The retained valid ADR passed calibration, while a counterexample that promoted both claims to established facts failed. A fresh Codex `gpt-6-luna/medium` run passed **5/5 trials**, with artifact grading and skill activation passing in every trial: focused result (`evals/results/decision-provenance-luna-n5.json`). A separate post-version smoke trial (`evals/results/decision-provenance-luna-post-version-smoke.json`) also passed after the plugin manifests moved to 0.2.5. The overview counts above remain the original sweep.

### darrow-discovery

| Case                                                                                                                                                                        | What failed                                            | Assessment       | Recommended next step                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------- |
| [discover-feature-negated-grilling-unknowns](../../plugins/capability/darrow-discovery/skills/work-through-decisions/evals/discover-feature-negated-grilling-unknowns.yaml) | Activation contract failed; observed discover-feature. | Skill activation | Check trigger and mounted-skill discovery; rerun this case with a matched control. |
| [former grilling-no-trigger-natural-language](../../plugins/capability/darrow-discovery/skills/work-through-decisions/evals/work-through-decisions-natural-grilling.yaml)   | Unexpected activation: discover-feature, grilling.     | Skill activation | Check trigger and mounted-skill discovery; rerun this case with a matched control. |

Follow-up: `discover-feature` now has a shorter, product-feature-only discovery description and requires a standalone complete read of its sibling `grilling` method. The personal-decision eval also excludes the wrong `discover-feature` route. Fresh Codex `gpt-6-luna/medium` runs at a 100% threshold passed **5/5** for the negated-grilling feature case (`evals/results/discovery-feature-negated-luna-n5.json`) and **4/5** for the personal-decision routing case (`evals/results/discovery-grilling-natural-luna-n5.json`). The remaining miss loaded `discover-feature` for a personal decision, although the task checks passed. Five neighboring feature, planning, and direct-invocation controls each passed one trial. The overview counts above remain the original sweep, and the routing boundary is not yet stable.

Second follow-up: Plugin-wide outcome descriptions and stricter negative activation checks preserve natural positive routing but do not close the negative boundary. On fresh Codex `gpt-6-luna/medium` runs with five trials per case and a 100% threshold, "spec out a feature" (`evals/results/discovery-spec-out-luna-n5.json`) and "let's plan how to implement this" (`evals/results/discovery-plan-this-luna-n5.json`) each passed **5/5** for behavior and activation. Personal-decision grilling (`evals/results/discovery-personal-routing-luna-n5-v2.json`) and generic API stress-testing (`evals/results/discovery-stress-routing-luna-n5.json`) each passed **4/5**; each remaining miss loaded `discover-feature` with no requested feature-discovery outcome. Negative task checks establish only a nonempty response and read-only repository state, not answer quality. An explicit `grilling` control passed one fresh trial. The strict skill-selection goal remains unmet.

Third follow-up: An [isolated unified-skill prototype](../../evals/experiments/discovery-unified/snapshots/2026-09-24.md) routed feature discovery, implementation planning, and natural-language grilling through one entry skill. Four representative Codex `gpt-6-luna/medium` cases each passed **5/5** first-turn behavior checks. Candidate skill-read evidence showed **15/15** positive selections and **5/5** ordinary-advice nonselections. This changes the manual-only grilling contract, and the retained trace does not prove mode-reference reads. Full workflow parity and Claude Code behavior remain untested; no shipped plugin was replaced.

Fourth follow-up: The shipped `darrow-discovery` plugin now has one public `work-through-decisions` skill. It loads the requested planning, feature-discovery, or standalone-grilling instructions from local references. The original 23 colocated cases each passed a fresh Codex `gpt-6-luna/medium` trial after focused repairs. Seven boundary and workflow cases then passed **5/5** for both task and activation: natural planning (`evals/results/discovery-unified-final-plan-v2-n5.json`), feature discovery (`evals/results/discovery-unified-final-feature-n5.json`), natural grilling (`evals/results/discovery-unified-final-grill-n5.json`), ordinary-advice exclusion (`evals/results/discovery-unified-final-advice-n5.json`), migration planning (`evals/results/discovery-unified-final-migration-n5.json`), complete plan (`evals/results/discovery-unified-final-complete-plan-n5.json`), and generic stress-testing (`evals/results/discovery-unified-final-stress-n5.json`). The tests confirm entry-skill selection and task behavior; retained traces still do not prove which mode-reference file was read. The initial sweep counts above remain historical.

Claude Code `claude-sonnet-5/medium` smoke trials also passed task and activation checks for grilling (`evals/results/discovery-unified-final-claude-grill-n1.json`), feature discovery (`evals/results/discovery-unified-final-claude-discover-feature-spec-out-natural-language-n1.json`), and implementation planning (`evals/results/discovery-unified-final-claude-plan-implementation-lets-plan-this-n1.json`), one trial per mode. These single trials establish basic host compatibility, not a reliability rate.

Fifth follow-up: An added [combined discovery and writing pressure case](../../plugins/capability/darrow-discovery/skills/work-through-decisions/evals/work-through-decisions-write-pressure.yaml) exposed a Codex response that wrote a spec while product choices remained open. The skill now states the read-only handoff boundary at entry and in feature mode. The original prompt's “make sensible calls for me” also made delegation ambiguous; the final case explicitly reserves those choices for the user. That final case passed Codex 5/5 (`evals/results/discovery-unified-final-codex-write-pressure-v4-n5.json`) and Claude Code 1/1 (`evals/results/discovery-unified-final-claude-write-pressure-v5-n1.json`), including activation and untouched repository state. A Codex post-metadata trial (`evals/results/discovery-unified-final-codex-write-pressure-v5-n1.json`) also passed. Claude Code initially treated the combined request as a writing task and missed the skill; updated discovery metadata corrected the focused retest (`evals/results/discovery-unified-final-claude-write-pressure-v5-n1.json`). Matched one-trial Claude Code controls for direct grilling (`evals/results/discovery-unified-final-claude-grilling-direct-frontier-n1.json`), ordinary-advice exclusion (`evals/results/discovery-unified-final-claude-work-through-decisions-ordinary-advice-n1.json`), and feature-discovery pressure (`evals/results/discovery-unified-final-claude-discover-feature-pressure-premature-brief-n1.json`) also passed. Internal mode-reference reads remain unobservable in the retained runner trace; behavior checks cannot prove they occurred.

The [final shipped-skill snapshot](../../evals/experiments/discovery/snapshots/2026-09-24-unified-shipped.md) records matched one-trial Codex and Claude Code results on the exact final skill content for direct grilling, feature discovery, implementation planning, ordinary-advice exclusion, and pressure with independent product choices. All ten trials passed task and activation checks. It also records the remaining mode-read and external ticket-state evidence limits.

### darrow-explanation

| Case                                                                                                                                                             | What failed                                                                                                      | Assessment                | Recommended next step                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| [explain-visually-algorithm-pseudocode](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/algorithm-pseudocode.yaml)                     | Activation missed explain-visually; observed none.                                                               | Skill activation          | Check trigger and mounted-skill discovery; rerun this case with a matched control. |
| [explain-visually-file-responsibility](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/file-responsibility.yaml)                       | Response is a shallow visual rather than a prose tour failed. Activation missed explain-visually; observed none. | Skill + activation        | Repair the failed behavior and trigger; rerun this case and its matched control.   |
| [explain-visually-indirect-state-transitions](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/indirect-state-transitions.yaml)         | Response uses a state-oriented visual shape failed. Activation missed explain-visually; observed none.           | Skill + activation        | Repair the failed behavior and trigger; rerun this case and its matched control.   |
| [explain-visually-no-trigger-implementation](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/no-trigger-implementation.yaml)           | Implementation request changes the requested code failed.                                                        | Agent / harness uncertain | Inspect write and fixture evidence; the visual skill was correctly avoided.        |
| [explain-visually-pressure-insufficient-evidence](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/pressure-insufficient-evidence.yaml) | Activation missed explain-visually; observed none.                                                               | Skill activation          | Check trigger and mounted-skill discovery; rerun this case with a matched control. |

Follow-up: The public contract now names indirect responsibility, state, and
pseudocode intents explicitly. The skill has a shorter discovery description and
directs ownership views to start at the owning directory rather than a barrel
file. The state-shape check now accepts `▶` arrows; it accepts all five retained
valid state answers from a matched pre-change run. The responsibility case now
grades one compact ownership tree semantically, accepting a fresh valid answer
and rejecting bullet-list, duplicate-tour, and table variants in fresh trials.
The implementation-exclusion check now prints the resulting fixture source on
a failed code-state assertion. A fresh single trial passed both task and skill
exclusion. A later [five-trial run](../../evals/results/2026-09-26T14-12-34-885Z-codex-gpt-6-luna-medium.json)
passed task **3/5** and skill exclusion **5/5**: in the two failed trials the
answer claimed `src/math.js` was updated, but the fixture still contained the
original function. The retained result does not establish whether the edit was
attempted or lost, so this needs candidate tool and fixture investigation
outside the visual skill. The HTML-artifact exclusion passed one fresh trial.

Codex `gpt-6-luna`/medium five-trial controls on the old skill content
showed [responsibility](../../evals/results/2026-09-26T13-52-26-780Z-codex-gpt-6-luna-medium.json)
at **0/5 task, 2/5 activation** and [state transitions](../../evals/results/2026-09-26T13-54-07-166Z-codex-gpt-6-luna-medium.json)
at **2/5 task, 2/5 activation** under the original assertions. On the final
description and revised checks, [responsibility](../../evals/results/2026-09-26T14-02-25-570Z-codex-gpt-6-luna-medium.json)
passed **2/5 task and 2/5 activation**; both activated trials produced the
required view. [State transitions](../../evals/results/2026-09-26T14-01-00-788Z-codex-gpt-6-luna-medium.json)
passed **5/5 task and 4/5 activation**. [Pseudocode](../../evals/results/2026-09-26T14-05-15-682Z-codex-gpt-6-luna-medium.json)
passed **4/5 task and 1/5 activation**; the task miss omitted randomization.
[Insufficient-evidence pressure](../../evals/results/2026-09-26T14-07-21-642Z-codex-gpt-6-luna-medium.json)
passed **5/5 task and 3/5 activation**. The before and after runs used the same
fixtures, prompts, model, effort, trial count, and threshold, but the task
checks changed; task percentages are not a like-for-like behavior comparison.
These are distinct samples, not a single full-suite result or proof of long-run
stability. The output repairs accept valid views, and the skill's ownership
guidance produced the required view in both activated responsibility trials.
Implicit activation remains intermittent; wording alone has not met the 5/5
selection goal. The overview counts remain the historical sweep.

Further eval-design follow-up: The visual-explanation contract now centers on
requests to explain or show technical relationships visually, including natural
paraphrases rather than exact keywords. A pseudocode-only format request no
longer requires implicit selection. The pseudocode and insufficient-evidence
pressure cases now invoke the skill explicitly to test their task behavior;
the responsibility prompt now asks for a visual view. A new
[canonical implicit case](../../plugins/capability/darrow-explanation/skills/explain-visually/evals/implicit-visual-explanation.yaml)
asks to explain a code path visually without naming the skill. This changes the
active suite from nine to ten cases; the historical overview remains unchanged.

The new canonical case passed a first Codex `gpt-6-luna`/medium trial for task
and activation. A subsequent [five-trial run](../../evals/results/2026-09-26T14-51-44-936Z-codex-gpt-6-luna-medium.json)
recorded **0/5 activation** despite the direct visual-explanation wording.
Its original helper-name assertion rejected one otherwise correct answer.
A semantic draft also proved ambiguous, so the final check uses bounded
deterministic evidence for the named source, visual form, validation, storage,
and queue steps. [Regrading all five retained answers](../../evals/results/explanation-canonical-deterministic-regrade.json)
accepted **5/5**, while a missing-step counterexample failed. A
[fresh trial](../../evals/results/2026-09-26T15-00-16-341Z-codex-gpt-6-luna-medium.json)
passed task and activation under that final check. The retained five-trial
activation result is unchanged. This rules out the missing words “explain
visually” as the sole explanation for missed selection, and the new suite has
not passed a full n:5 run.

A metadata-only probe compared the current description with the user-supplied
original wording and a short hybrid. The skill body, prompts, fixtures,
Codex `gpt-6-luna`/medium route, and checks stayed fixed. Activation results:

| Request                              |                                                                           Current |                                                                          Original |                                                                            Hybrid |
| ------------------------------------ | --------------------------------------------------------------------------------: | --------------------------------------------------------------------------------: | --------------------------------------------------------------------------------: |
| Simple visual code flow              | [4/10](../../evals/results/2026-09-26T15-16-21-242Z-codex-gpt-6-luna-medium.json) | [8/10](../../evals/results/2026-09-26T15-30-49-793Z-codex-gpt-6-luna-medium.json) | [8/10](../../evals/results/2026-09-26T15-42-26-963Z-codex-gpt-6-luna-medium.json) |
| Complex visual code flow             | [6/10](../../evals/results/2026-09-26T15-17-44-332Z-codex-gpt-6-luna-medium.json) | [7/10](../../evals/results/2026-09-26T15-32-06-180Z-codex-gpt-6-luna-medium.json) | [4/10](../../evals/results/2026-09-26T15-43-39-578Z-codex-gpt-6-luna-medium.json) |
| HTML artifact request: skill avoided |  [5/5](../../evals/results/2026-09-26T15-27-25-597Z-codex-gpt-6-luna-medium.json) |  [4/5](../../evals/results/2026-09-26T15-33-36-446Z-codex-gpt-6-luna-medium.json) |  [5/5](../../evals/results/2026-09-26T15-45-16-536Z-codex-gpt-6-luna-medium.json) |

All task checks passed, but the positive probes checked only basic visual
form, not full explanation quality. The original wording selected the skill
once for an HTML artifact request, though the artifact was still created.
These small samples do not establish a reliable improvement or meet the 5/5
goal. The hybrid was reverted; the probe fixtures and results are gitignored.

A follow-up used the exact original sentence with only “and focused HTML
artifacts” removed. It activated [8/10 on the simple flow](../../evals/results/2026-09-26T15-50-41-707Z-codex-gpt-6-luna-medium.json)
and [3/10 on the complex flow](../../evals/results/2026-09-26T15-52-22-539Z-codex-gpt-6-luna-medium.json),
and avoided the skill in [5/5 HTML requests](../../evals/results/2026-09-26T15-53-47-998Z-codex-gpt-6-luna-medium.json).
The HTML run's apparent task miss was an eval defect: “only inline HTML”
matched a refusal regex despite the artifact being created. Removing that
overbroad phrase accepted all five retained answers and rejected a refusal
counterexample. A fresh trial then [passed](../../evals/results/2026-09-26T15-58-06-206Z-codex-gpt-6-luna-medium.json);
an earlier fresh trial avoided the skill but [claimed to create an absent
artifact](../../evals/results/2026-09-26T15-57-40-211Z-codex-gpt-6-luna-medium.json),
which is separate from the regex defect. The description variant was reverted
because its visual-request activation was only 11/20.

A follow-up separated task value from activation, using Codex
`gpt-6-luna`/medium and five trials per completed condition. For the same
responsibility fixture, an [unmounted control](../../evals/results/2026-09-26T16-24-58-683Z-codex-gpt-6-luna-medium-without-skill.json)
passed the task checks **2/5**; answers sometimes centered `src/index.ts`
instead of the owning directories or repeated the map. An
[explicitly invoked variant](../../evals/results/2026-09-26T16-24-09-558Z-codex-gpt-6-luna-medium.json)
passed task and activation **5/5**. The normal
[implicit responsibility case](../../evals/results/2026-09-26T16-28-42-024Z-codex-gpt-6-luna-medium.json)
also passed task and activation **5/5**. The explicit variant added the
host-native skill token to the same task, so its prompt was not byte-identical
to the control; the result supports task value but does not isolate the skill
body's causal effect from that token.

For the insufficient-evidence fixture, both the
[unmounted control](../../evals/results/2026-09-26T16-27-04-239Z-codex-gpt-6-luna-medium-without-skill.json)
and the [explicit skill case](../../evals/results/2026-09-26T16-27-52-550Z-codex-gpt-6-luna-medium.json)
passed **5/5**; this fixture does not show added value from loading the skill.
The [generic `submitJob` visual request](../../evals/results/2026-09-26T16-29-52-326Z-codex-gpt-6-luna-medium.json)
passed the task checks **5/5** but implicitly loaded the skill **3/5**.
These small samples show stronger selection when the request specifies the
skill's distinctive responsibility view and source anchors; they do not
establish a stable implicit activation rate.

An isolated Codex App Server
[catalog preflight](../../evals/results/explanation-catalog-probe.json) using
the runner's fixture, home, and plugin-install functions listed the enabled
`darrow-explanation:explain-visually` skill with its complete description,
six system skills, and no catalog errors. This checks installation and catalog
discovery in a replicated setup, not the exact model-facing initial prompt in
each retained trial. The two temporary research cases were removed after the
comparison. A serial baseline attempt hit the shell tool's 120-second limit
after four retained trials; only the completed five-trial result above is
counted.

A relationship-first description probe replaced only the frontmatter
description with: “Use when the user asks to explain visually how a technical
subject fits together—what calls what, who owns what, how state changes, or
what changed. Show one source-grounded inline view. Do not use for
implementation or requests to create HTML, images, slides, or documentation.”
Codex `gpt-6-luna`/medium results, five trials per completed condition:

| Case                                                  | Current description                                                                    | Relationship-first description                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Generic `submitJob` visual request: task / activation | [5/5 / 3/5](../../evals/results/2026-09-26T16-29-52-326Z-codex-gpt-6-luna-medium.json) | [5/5 / 3/5](../../evals/results/2026-09-26T16-54-47-700Z-codex-gpt-6-luna-medium.json) |
| Responsibility view: task / activation                | [5/5 / 5/5](../../evals/results/2026-09-26T16-28-42-024Z-codex-gpt-6-luna-medium.json) | [5/5 / 5/5](../../evals/results/2026-09-26T16-55-33-145Z-codex-gpt-6-luna-medium.json) |
| State transitions: task / activation                  | [5/5 / 1/5](../../evals/results/2026-09-26T17-01-58-746Z-codex-gpt-6-luna-medium.json) | [5/5 / 1/5](../../evals/results/2026-09-26T17-00-48-182Z-codex-gpt-6-luna-medium.json) |
| HTML artifact: task / skill avoided                   | [5/5 / 5/5](../../evals/results/2026-09-26T15-27-25-597Z-codex-gpt-6-luna-medium.json) | [5/5 / 5/5](../../evals/results/2026-09-26T16-58-55-416Z-codex-gpt-6-luna-medium.json) |

The state-transition control was rerun after restoring the current
description because its older 4/5 activation result might have been sampling
variation. The fresh control also loaded only 1/5, so that result cannot be
attributed to the description variant. In the generic request, the two misses
had complete activation observations and valid visual answers. The candidate
showed no measured improvement on these probes; it was reverted byte-for-byte
to the pre-probe skill file. A first HTML candidate run was interrupted by the
shell tool's 120-second limit after three passing trials; only the completed
five-trial rerun above is counted. Five trials per condition remain too small
to establish equal long-run activation rates.

A second probe used the distinct prose-to-view description: “Use when the user
wants a technical explanation turned into a visual view, especially when prose
obscures a flow, structure, or state transition. Keep the view compact and
source-grounded.” Only the frontmatter description changed. Codex
`gpt-6-luna`/medium results, five trials per completed condition:

| Case                                                  | Current description                                                                    | Prose-to-view description                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Generic `submitJob` visual request: task / activation | [5/5 / 3/5](../../evals/results/2026-09-26T16-29-52-326Z-codex-gpt-6-luna-medium.json) | [5/5 / 4/5](../../evals/results/2026-09-26T17-05-55-053Z-codex-gpt-6-luna-medium.json) |
| Responsibility view: task / activation                | [5/5 / 5/5](../../evals/results/2026-09-26T16-28-42-024Z-codex-gpt-6-luna-medium.json) | [5/5 / 5/5](../../evals/results/2026-09-26T17-06-45-832Z-codex-gpt-6-luna-medium.json) |
| State transitions: task / activation                  | [5/5 / 1/5](../../evals/results/2026-09-26T17-01-58-746Z-codex-gpt-6-luna-medium.json) | [5/5 / 1/5](../../evals/results/2026-09-26T17-07-45-110Z-codex-gpt-6-luna-medium.json) |
| HTML artifact: task / skill avoided                   | [5/5 / 5/5](../../evals/results/2026-09-26T16-58-55-416Z-codex-gpt-6-luna-medium.json) | [5/5 / 4/5](../../evals/results/2026-09-26T17-08-24-611Z-codex-gpt-6-luna-medium.json) |

The candidate's generic improvement is one trial in a small sample and still
misses the 5/5 selection goal. Its HTML miss is a complete observed skill read,
not an instrumentation gap; the agent still created the artifact. The
prose-to-view description was restored to the pre-probe wording. These results
do not establish a reliable gain and show a possible exclusion regression.
The selected `0.1.4` state keeps that restored description, the grounded
ownership guidance, and the corrected intent and behavior evals. The plugin
README documents the observed Codex implicit-activation limit and the explicit
invocation path. No description variant established reliable 5/5 implicit
selection across the visual cases.

### darrow-git

| Case                                                                                                                           | What failed                                                                                                                           | Assessment                  | Recommended next step                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [create-pr-template-choice-required](../../plugins/capability/darrow-git/skills/create-pr/evals/template-choice-required.yaml) | The original case told the agent to choose a template, but expected it to stop; the agent pushed and created a PR in two Luna trials. | Contract mismatch, repaired | GW-P8 now allows explicit delegation. The delegated and no-choice cases each passed 5/5; all 12 create-pr cases passed a fresh single-trial regression run. |

### darrow-information-architecture

| Case                                                                                                                                                                                                                      | What failed                                                                                                                                                                 | Assessment                                | Recommended next step                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [doctor-information-architecture-confirm-before-mutation](../../plugins/foundation/darrow-information-architecture/skills/doctor-information-architecture/evals/confirm-before-mutation.yaml)                             | The doctor kept the manifest-derived package-manager fact despite `package.json` being available, then asked for confirmation.                                              | Skill behavior                            | Reinforce derived-fact classification and the source-backed proposal.                          |
| [doctor-information-architecture-preserve-settled-abandoned-experiment](../../plugins/foundation/darrow-information-architecture/skills/doctor-information-architecture/evals/preserve-settled-abandoned-experiment.yaml) | The settled ORM guidance and its route survived unchanged, but the response did not repeat the decision; only the semantic output check failed.                             | Eval expectation                          | Grade preservation and reachability; require a decision recap only when relevant to a finding. |
| [doctor-information-architecture-trim-derived-keep-contracts](../../plugins/foundation/darrow-information-architecture/skills/doctor-information-architecture/evals/trim-derived-keep-contracts.yaml)                     | The doctor identified the correct rewrite but stopped because the eval mount omitted the plugin's required `references/file-updates.md`; no edit or after-metrics followed. | Eval runner package mount                 | Mount plugin-local references, then rerun before judging the rewrite.                          |
| [setup-information-architecture-move-procedure-to-skill](../../plugins/foundation/darrow-information-architecture/skills/setup-information-architecture/evals/move-procedure-to-skill.yaml)                               | The new skill preserved the release steps, but the full procedure also remained in `AGENTS.md`; the eval mount also lacked the required writer reference.                   | Incomplete eval mount; task miss observed | Restore the complete plugin mount, then check the post-edit root comparison.                   |
| [setup-information-architecture-scoped-router](../../plugins/foundation/darrow-information-architecture/skills/setup-information-architecture/evals/scoped-router.yaml)                                                   | Root kept “Agents must never merge their own pull requests” once and scoped files held the domain rules; both failed checks missed this valid paraphrase.                   | Eval regex                                | Accept this universal-rule wording in both checks.                                             |

All five historical runs loaded the intended skill. The two failed cases that
mentioned a missing atomic writer reflect the eval runner's filtered plugin
mount: it copied skills and selected mechanics but omitted the tracked
plugin-local `references/` directory. The initial sweep's blanket “Skill likely”
assessment therefore overstated the skill failures.

Follow-up on Codex `gpt-6-luna`/medium: the runner now mounts plugin-local
references for project, Claude, and Codex fixtures. The settled-decision case
grades policy preservation and reachability without requiring an unprompted
decision recap. The scoped-router checks accept the observed prohibited
“merge their own pull requests” wording while rejecting a positive permission.
All five formerly failed cases passed a fresh single trial. The
[procedure-move case](../../evals/results/2026-09-26T17-44-41-164Z-codex-gpt-6-luna-medium.json)
then passed **5/5 task and 5/5 activation** with the complete mount, so its
historical miss does not justify a setup-skill change on this evidence.

The doctor proposal case still kept the manifest-derived package-manager fact
in a fresh trial after the mount repair. Its classification step now explicitly
separates derived manifest facts from adjacent behavioral rules. A first
five-trial [run](../../evals/results/2026-09-26T17-37-04-610Z-codex-gpt-6-luna-medium.json)
passed **4/5 task and 5/5 activation**: the remaining answer
made the right removal proposal but gave only a directional, nonnumeric size
estimate. After clarifying the numeric proposal requirement, the
[fresh five-trial run](../../evals/results/2026-09-26T17-40-47-766Z-codex-gpt-6-luna-medium.json)
passed **5/5 task and 5/5 activation**. These targeted runs do not constitute
a new full-plugin sweep or establish long-run reliability.

### darrow-observability-langfuse

| Case                                                                                                                                                                              | What failed                                                                                                                                       | Assessment            | Recommended next step                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| [langfuse-observability-in-session-attribution](../../plugins/capability/darrow-observability-langfuse/skills/configure-langfuse-observability/evals/in-session-attribution.yaml) | The original answer formatted all three directives as inline code, so the standalone-line checks failed.                                          | Skill gap, repaired   | Retain standalone syntax and epoch explanation; 5/5. |
| [langfuse-observability-unrelated-monitoring](../../plugins/capability/darrow-observability-langfuse/skills/configure-langfuse-observability/evals/unrelated-monitoring.yaml)     | The answer correctly avoided the skill and identified the empty service shell, but the grader demanded a fuller Datadog implementation interview. | Eval defect, repaired | Keep the negative boundary check scoped; 5/5.        |

Follow-up: The in-session case activated the skill and explained the attribution modes, but rendered all three directives as inline code rather than standalone prompt lines. The plugin's spec and skill now require copyable standalone directives. An initial five-trial run exposed a separate omission: one response named the epoch and thread fields without saying each directive starts a new epoch. The skill's final `Session policy` instruction now includes that transition. A fresh Codex `gpt-6-luna`/medium run passed in-session attribution 5/5 (`evals/results/langfuse-attribution-luna-n5-v2.json`), including activation and every task check.

The unrelated Datadog case correctly avoided the Langfuse skill in the original run. Its semantic assertion required an implementation interview beyond the prompt's request to assess repository context, so the check now asks only for a grounded insufficient-context answer and no Codex/Langfuse redirection. It accepted the retained valid answer and rejected a counterexample claiming the empty shell was sufficient. A fresh 5/5 negative-boundary run (`evals/results/langfuse-unrelated-luna-n5.json`) passed task and activation checks. A neighboring work-item-precedence control (`evals/results/langfuse-work-item-precedence-luna-control.json`) passed one fresh trial. These samples do not establish cross-host or long-run stability; the overview counts remain the historical sweep.

### darrow-readiness-gate

| Case                                                                                                                                                                                  | What failed                                                                                                                                       | Assessment                           | Recommended next step                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| [readiness-contradictory-authoritative-sources](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/contradictory-authoritative-sources.yaml) | The original answer chose `needs-decision` although no permitted authority could reconcile the conflicting policies before the governance review. | Skill gap, repaired                  | Retain the current-action verdict check; focused rerun 5/5.            |
| [readiness-needs-decision](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/needs-decision.yaml)                                           | The original answer preserved both alternatives but did not identify an authorized party as the required decision maker.                          | Skill gap, repaired                  | Keep authority explicit in the next action; focused rerun 5/5.         |
| [readiness-needs-discovery](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/needs-discovery.yaml)                                         | The original answer had two complete quality-bar items, but the regex required a blank line between them.                                         | Eval repaired; activation unresolved | Preserve the spacing fix; investigate intermittent implicit selection. |

The readiness spec and skill now distinguish a decision available now from a prerequisite awaiting future authority. The eight cases sharing the quality-bar regex now accept one or two newlines between complete typed items. The retained discovery answer passes the revised check; a counterexample with a missing oracle fails. Fresh Codex `gpt-6-luna`/medium runs at a 100% threshold passed task and activation **5/5 each** for [contradictory authority](../../evals/results/2026-09-26T08-06-06-256Z-codex-gpt-6-luna-medium.json), [needs decision](../../evals/results/2026-09-26T08-08-49-065Z-codex-gpt-6-luna-medium.json), and [needs discovery](../../evals/results/2026-09-26T08-12-28-623Z-codex-gpt-6-luna-medium.json). Neighboring [quality-bar gap](../../evals/results/2026-09-26T08-17-35-373Z-codex-gpt-6-luna-medium.json) and [rubber-stamp pressure](../../evals/results/2026-09-26T08-18-15-383Z-codex-gpt-6-luna-medium.json) controls passed 1/1 each. An earlier single contradiction trial passed every task check but failed activation because the complete skill body was not observed; a second single trial and the later 5/5 run passed activation. These samples do not establish long-run activation stability or cross-host behavior. The overview counts remain the historical sweep.

The subsequent full Codex n:5 pass ran all 16 cases sequentially at `gpt-6-luna`/medium and a 100% threshold, stopping to inspect failed cases before resuming. Twelve cases passed 5/5 on their first full-pass run. Four cases exposed additional intermittent failures:

| Case                                                                                                                                                 | Observed failure                                                                                                                                                                                                                                                                                       | Follow-up                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Caller resolution](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/caller-resolution-continuation.yaml) | [First n:5](../../evals/results/2026-09-26T08-28-33-745Z-codex-gpt-6-luna-medium.json): task 4/5, activation 5/5. The fifth trial completed the change but stored malformed JSON in one of two caller-owned readiness artifacts. The fixture had been cleaned up, so which artifact failed is unknown. | The check now reports which stage is invalid on a future failure without changing acceptance. [Rerun](../../evals/results/2026-09-26T08-37-19-074Z-codex-gpt-6-luna-medium.json): task and activation 5/5. The original cause remains unresolved.                                                                                                                                                   |
| [Composed non-ready stop](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/goal-contract-stop.yaml)       | [First n:5](../../evals/results/2026-09-26T08-50-11-526Z-codex-gpt-6-luna-medium.json): task 5/5, activation 4/5; one native trace lacked a complete mounted-skill read.                                                                                                                               | [Rerun](../../evals/results/2026-09-26T08-53-31-472Z-codex-gpt-6-luna-medium.json): task and activation 5/5. The intermittent activation miss remains evidence.                                                                                                                                                                                                                                     |
| [Needs discovery](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/needs-discovery.yaml)                  | [Full-pass n:5](../../evals/results/2026-09-26T09-09-07-384Z-codex-gpt-6-luna-medium.json): task and activation 3/5; two replies gave ordinary prose without loading the skill. A later single trial loaded the skill but incorrectly treated an in-gate benchmark as an already recorded baseline.    | Discovery metadata now covers indirect readiness intent, and the skill clarifies that a separately required discovery result is an input, not work the gate performs. [Intermediate n:5](../../evals/results/2026-09-26T09-16-20-083Z-codex-gpt-6-luna-medium.json): task 5/5, activation 4/5; the missed trial showed an incomplete mounted-skill read. Implicit activation remained intermittent. |
| [Ready without plan](../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/ready-without-plan.yaml)            | [N:5](../../evals/results/2026-09-26T09-30-15-225Z-codex-gpt-6-luna-medium.json): task 4/5, activation 5/5. One otherwise valid ready report omitted the required empty `Findings` section.                                                                                                            | Keep the output contract and inspect whether a concise completeness check improves this omission.                                                                                                                                                                                                                                                                                                   |

The negative implementation and planning controls both passed 5/5 after the metadata revision, as did the quality-bar gap, concise ready, and rubber-stamp cases. These staged runs used more than one skill revision and preserve the intermittent failures above.

A later [single fixed-candidate run](../../evals/results/2026-09-26T09-38-22-799Z-codex-gpt-6-luna-medium.json) covered all 16 cases and 80 trials sequentially at Codex `gpt-6-luna`/medium with a 100% threshold. Activation passed **80/80**; the raw task result was **79/80**, or **15/16 cases**. The sole failure was a complete, correctly blocked rubber-stamp report ending with two blank lines, while the shared one-report regex allowed at most one. The eight cases sharing that assertion now allow trailing whitespace. [Regrading all 80 retained answers](../../evals/results/readiness-gate-luna-n5-regrade.json) against the corrected output checks yields **80/80** task results, with all previously passing non-output checks and activation evidence retained. The revised check accepts the saved valid answer and rejects a duplicate-report counterexample. A [fresh rubber-stamp 5/5 run](../../evals/results/2026-09-26T10-28-13-238Z-codex-gpt-6-luna-medium.json) passed task and activation under the corrected assertion. There is no single raw green 80-trial result file after that assertion-only correction. Earlier intermittent activation and handoff misses remain evidence; these samples do not establish long-run or native Claude Code stability. The historical overview counts remain unchanged.

### darrow-review

| Case                                                                                                                                                      | What failed                                                                                                                                                                               | Assessment        | Recommended next step                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| [code-review-both-axes](../../plugins/capability/darrow-review/skills/code-review/evals/both-axes.yaml)                                                   | Final response preserves every canonical rendered line failed.                                                                                                                            | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-fix-verification-progress-advisory](../../plugins/capability/darrow-review/skills/code-review/evals/fix-verification-progress-advisory.yaml) | Progressing blocker keeps convergence open failed. Also: unresolved advisory does not become a blocker.                                                                                   | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-fix-verification-resolved](../../plugins/capability/darrow-review/skills/code-review/evals/fix-verification-resolved.yaml)                   | Current verification scope remains in the requested repository failed. Also: additive verification artifact validates and clears, both fix verifiers retain exact default route evidence. | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-fix-verification-unavailable](../../plugins/capability/darrow-review/skills/code-review/evals/fix-verification-unavailable.yaml)             | Unavailable evidence produces a valid blocked artifact failed.                                                                                                                            | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-low-noise](../../plugins/capability/darrow-review/skills/code-review/evals/low-noise.yaml)                                                   | Failed formatter remains check evidence without prose findings failed.                                                                                                                    | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-presentation-default](../../plugins/capability/darrow-review/skills/code-review/evals/presentation-default.yaml)                             | Final response preserves every canonical rendered line failed.                                                                                                                            | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-pull-request](../../plugins/capability/darrow-review/skills/code-review/evals/pull-request.yaml)                                             | Review is pinned to the pull-request objects and body specification failed.                                                                                                               | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-reviewer-route-override](../../plugins/capability/darrow-review/skills/code-review/evals/reviewer-route-override.yaml)                       | Final response preserves every canonical rendered line failed.                                                                                                                            | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |
| [code-review-spec-only](../../plugins/capability/darrow-review/skills/code-review/evals/spec-only.yaml)                                                   | Canonical TSV is retained beneath the review scope artifact failed. Also: final response preserves every canonical rendered line.                                                         | Mixed / uncertain | Make the canonical review checker pass deterministically first; rerun, then repair skill output if still failing. |

#### Review follow-up: nine original failures, n:5 (2026-09-28)

All nine originally failing cases were rerun against `darrow-review` **0.7.3**
at commit `4d3ffcc`, using Codex CLI **0.156.1**, candidate
**gpt-6-luna/medium**, five trials per case, three concurrent trials, and a
100% threshold. Cases ran sequentially; completed failures were inspected before
starting the next case. The semantic grader remained **gpt-5.6-luna/low**.
Independent readers retained the plugin's configured routes: bundled
**gpt-6-sol/xhigh**, or **gpt-5.5/xhigh** in the override case. No plugin,
fixture, or assertion changes were made during this rerun.

**Task: 24/45. Activation: 42/45. Two of nine cases passed 5/5 for both.**
These are raw results, including the fixture and grading problems below.
The shared review outcome and route checks separately passed **84/84**; the
outcome checks included both Bash variants.

| Case                                                                                                                       | Task | Activation | What failed                                                                                                                                                                               | Assessment                                                                                                                                                                                     | Recommendation                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ---: | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Both axes](../../evals/results/review-luna-n5-2026-09-28/code-review-both-axes.json)                                      |  3/5 |        5/5 | Trial 2 returned a canonical blocked report, citing prohibited reader delegation. Trial 4 read the skill but returned prose without checks, retained artifacts, or repair guidance.       | Skill workflow. The cited host-policy interpretation cannot be independently verified from the bounded trace; other trials successfully launched readers.                                      | Investigate the shared reader-authorization and workflow entry instructions; preserve independent review and evidence requirements.                        |
| [Progress and advisory](../../evals/results/review-luna-n5-2026-09-28/code-review-fix-verification-progress-advisory.json) |  2/5 |        3/5 | Trials 2 and 5 did not load the skill and returned prose. Trial 3 loaded it but blocked because legacy findings lacked repair-guidance fields.                                            | Skill activation and workflow. The references explicitly permit paired absence of legacy guidance fields.                                                                                      | Address implicit fix-verification selection and clarify the supported legacy handoff at the shared input gate.                                             |
| [Resolved fixes](../../evals/results/review-luna-n5-2026-09-28/code-review-fix-verification-resolved.json)                 |  4/5 |        5/5 | Trial 3 resolved both blockers but blocked the advisory because its cited maintenance note was not supplied. Scope, both reader routes, and final rendering passed in all five trials.    | Fixture likely. The fixture supplies only the source label "maintenance note" and expects all three findings resolved. Advisory evidence-gap handling also deserves a separate contract check. | Supply the authoritative maintenance note before changing reviewer judgment or weakening the all-resolved assertion.                                       |
| [Unavailable evidence](../../evals/results/review-luna-n5-2026-09-28/code-review-fix-verification-unavailable.json)        |  2/5 |        5/5 | Trials 1, 2, and 4 returned canonical blocked reports but substituted an authored unavailable-check description for captured check evidence; the provided command was not run.            | Skill workflow. The expected blocked decision was correct, but the required canonical capture was missing.                                                                                     | Strengthen the shared check-capture boundary so unavailable commands still produce actual retained evidence before aggregation.                            |
| [Low noise](../../evals/results/review-luna-n5-2026-09-28/code-review-low-noise.json)                                      |  0/5 |        4/5 | Trial 1 missed activation; trial 3 loaded the skill but returned only "No findings." Trials 2, 4, and 5 completed the review but changed escaping in rendered source paths.               | Skill activation, workflow, and presentation. The substantive review assertions passed in the three copy-only failures.                                                                        | Treat selection, mandatory workflow execution, and canonical rendering as shared plugin problems; retain formatter evidence and the accepted local design. |
| [Default presentation](../../evals/results/review-luna-n5-2026-09-28/code-review-presentation-default.json)                |  3/5 |        5/5 | Trials 2 and 3 changed the final report-link destination from `_b` to `&#95;b`. Trial 3's semantic grader also rejected the renderer's prescribed title and verdict line as repetition.   | Skill presentation plus an eval grading defect. Both failed trials independently failed canonical comparison.                                                                                  | Address report copying across the plugin. Exempt required renderer labels from the concision proposition and calibrate that check before rerunning.        |
| [Pull request](../../evals/results/review-luna-n5-2026-09-28/code-review-pull-request.json)                                |  0/5 |        5/5 | All five reviewers flagged the newline in `ok\n` against a PR body requiring "exactly ok," while the oracle expected a passing review. Trial 1 also changed an escaped changed-file path. | Fixture defect, with a separate skill presentation failure in trial 1. Scope and read-only checks passed throughout.                                                                           | Align the PR requirement and file bytes, preserving the scope assertions; handle the copy failure through the shared presentation boundary.                |
| [Reviewer route override](../../evals/results/review-luna-n5-2026-09-28/code-review-reviewer-route-override.json)          |  5/5 |        5/5 | None. Both configured native reader routes and canonical final rendering passed.                                                                                                          | Passing sample.                                                                                                                                                                                | Keep the current route contract and use this case as a control for later workflow changes.                                                                 |
| [Spec only](../../evals/results/review-luna-n5-2026-09-28/code-review-spec-only.json)                                      |  5/5 |        5/5 | None. All retained reports identify the missing Anonymous fallback with advisory repair guidance.                                                                                         | Passing sample.                                                                                                                                                                                | Keep the current case as a control for implicit review selection and canonical execution.                                                                  |

The common problem is broader than activation. The three activation misses
occurred in progress/advisory (two) and low-noise (one). **Eighteen of the 21
task failures loaded or explicitly invoked the skill.** Seven of those loaded
trials omitted or misinterpreted workflow requirements, six altered canonical
report text, and five failed solely on the fixture concerns described above.
These categories describe the retained outcomes, not every private command's
root cause. The semantic false negative overlaps a report-copy failure; fixing
it alone would not change that trial's task result.

The presentation failures share a concrete pattern: the coordinator changes
Markdown entity escaping when copying renderer output, including source paths
and the final artifact link. Canonical comparison already ignores blank lines,
so these are not trailing-whitespace failures. The loaded workflow failures
instead concern reader delegation, taking a prose shortcut, rejecting supported
legacy findings, or replacing check capture with a description. All evaluated
read-only and publication-boundary checks passed.

Recommended sequence: first repair the PR-content ambiguity, supply the missing
advisory source, and calibrate the concision grader. Then discuss a plugin-wide
approach to execution and presentation before editing the skill. A description
change alone cannot address the loaded failures. Retain reviewer isolation,
actual check capture, immutable findings, and canonical artifact validation;
do not make the ambiguous fixtures dictate review judgment. No solution was
implemented in this follow-up.

Raw evidence is retained in the nine linked case files. The
[aggregate](../../evals/results/review-luna-n5-2026-09-28/overview.json) combines
those separate fresh five-trial runs; its
[source manifest](../../evals/results/review-luna-n5-2026-09-28/sources.json)
records their provenance. No failed trial was replaced with a retry. The earlier
single-trial both-axes pass and interrupted single-trial progress/advisory run
are excluded. This rerun covers the nine historical failures, not all 30 review
cases; it does not measure Claude Code, native Windows, or long-run reliability.

#### Review follow-up: eval repairs and next options (2026-09-28)

The three eval concerns above were repaired at plugin **0.7.4**. The PR body
now explicitly requires `ok` followed by one trailing newline, matching the
fixture file. Resolved-fixes supplies a committed maintenance note and binds
the original advisory to its absolute path. The concision proposition permits
the renderer's prescribed labels while requiring compact findings and checks,
short sections, complete evidence, and no substantial free-form repetition
or review-step narration. The corresponding eval invariants were clarified;
the skill, runtime behavior, and canonical comparison were unchanged.

The final proposition accepted **all five retained valid reports** and rejected
**three counterexamples**: repeated findings with process narration, an
incomplete summary, and an otherwise complete report with excessive distinct
explanatory detail. One bounded independent challenge identified the missing
compact-detail requirement before the final calibration. The fixture setup
check passed separately. Calibration regrades are not fresh candidate trials.

Fresh results use Codex **gpt-6-luna/medium**, CLI **0.156.1**, five trials per
case, three concurrent trials, a 100% threshold, and the unchanged
**gpt-5.6-luna/low** semantic-grader route:

**Final fresh sample: 12/15 task and 15/15 activation. One of three cases
passed the 100% task threshold.** These changes repair eval defects; they do
not establish a reliable execution or presentation solution.

| Case                                                                                                                  | Task | Activation | What failed                                                                                                                                                                                                           | Assessment and next step                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ---: | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pull request](../../evals/results/review-luna-eval-repairs-2026-09-28/code-review-pull-request.json)                 |  5/5 |        5/5 | None.                                                                                                                                                                                                                 | The fixture ambiguity is repaired. Preserve the passing scope, read-only, route, verdict, and canonical-report assertions.                                                                                                                                                                                                 |
| [Resolved fixes](../../evals/results/review-luna-eval-repairs-2026-09-28/code-review-fix-verification-resolved.json)  |  4/5 |        5/5 | Trial 1 returned a validated blocked report because the current base was the broken-config commit, while the supplied prior manifest used its parent. No independent reader routes were retained.                     | Shared skill workflow ambiguity: fix verification requires the prior base but also refers to the ordinary scope table, which chooses HEAD for uncommitted changes. Clarify repair-base selection; consider deriving it mechanically from the validated prior manifest. The missing maintenance-note failure did not recur. |
| [Default presentation](../../evals/results/review-luna-eval-repairs-2026-09-28/code-review-presentation-default.json) |  3/5 |        5/5 | Trials 1 and 3 copied the check applicability as `not&#95_applicable` rather than canonical `not&#95;applicable`, dropping the entity semicolon. All five concision assessments and substantive review checks passed. | Skill presentation: both failures change visible text, not merely equivalent encoding. Improve the shared renderer/copy boundary; retain checks that reject malformed entities.                                                                                                                                            |

The base-selection assessment is grounded in the retained failed response and
the two conflicting instruction passages, not a recovered private command
transcript. The supplied prior manifest remains valid. The previous **24/45**
task and **42/45** activation sample remains historical evidence; these changed
cases do not create a fresh full-plugin result.

The presentation run already underway when the independent challenge tightened
the proposition finished **4/5 task and 5/5 activation**. Its sole failure was
an underscore-encoding difference in the changed-file path. That
[intermediate sample](../../evals/results/review-luna-eval-repairs-2026-09-28/code-review-presentation-default-before-compactness-check.json)
is retained separately and excluded from the final 15-trial
[aggregate](../../evals/results/review-luna-eval-repairs-2026-09-28/overview.json).
The [source manifest](../../evals/results/review-luna-eval-repairs-2026-09-28/sources.json)
records all three final runs, the intermediate sample, and calibration/probe
paths. No failed trial was replaced. This follow-up does not measure the other
review cases, Claude Code, or long-run reliability.

The observed underscore substitutions also deserve a narrower interpretation.
Local probes with the repository's Markdown parser show that `_b` and
`&#95;b` produce identical displayed source paths and report-link destinations.
Changed destinations, converting escaped literal asterisks into emphasis, and
dropping the semicolon in a numeric reference produce different output. The
last defect occurred in the final presentation run: `not&#95;applicable` became
`not&#95_applicable`, changing the visible applicability text. This agrees with
[CommonMark's character-reference rules](https://spec.commonmark.org/0.31.2/#entity-and-numeric-character-references).
These probes establish equivalence for the demonstrated substitutions, not
every field of each failed report or every host's renderer. The current
complete-rendering contract still requires unmodified canonical output, so the
copy failures remain failures under that contract.

A further local probe confirms that the renderer can display
`(not_applicable)` without encoding its underscore. CommonMark disallows
underscore emphasis inside ordinary words; see its
[emphasis rules](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis).
Reducing unnecessary entity syntax in ordinary labels is therefore a concrete
renderer experiment to consider. Preserve escaping of arbitrary content that
could alter structure; these probes do not justify globally removing escaping.

Three plugin-wide approaches remain for discussion:

| Approach                                                                             | Benefit                                                                                                                                                                                                                                                                     | Limitation                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tighten the shared comprehensive and fix-verification instructions                   | Resolve the base-selection conflict and make legacy inputs, actual check capture, and mandatory readers easier to follow.                                                                                                                                                   | Prompt-only changes still depend on the coordinator executing every gate and copying evidence accurately.                                                         |
| Move repeatable evidence handling into narrow helpers in the existing review backend | Derive repair bases from validated prior scope, carry immutable records and actual check receipts mechanically, and validate/finalize retained evidence without model transcription. Keep source selection, contextual judgment, and native reader delegation in the skill. | Helpers reduce transfer mistakes but cannot guarantee implicit activation or prevent a prose shortcut. A separate presentation-contract decision is still needed. |
| Return a short inline verdict and link to the full retained report                   | Avoid copying a long report through the final-response channel while preserving the artifact.                                                                                                                                                                               | Changes the current promise of a complete inline report and requires updates to consumers and composition evals.                                                  |

Recommendation: pursue the helper approach, starting with repair-scope
preparation and evidence assembly inside this independently installable
plugin, and test a renderer that avoids unnecessary escaping of safe labels.
Separately discuss deterministic comparison of parsed Markdown
structure, text, and link destinations for human output, retaining exact
canonical artifact validation. This would require an explicit presentation
contract change; it must reject omitted content, changed links, and changed
markup, and must not decode whole Markdown strings indiscriminately. Test
compatibility with the host renderer and the verification consumer before
adoption. It would address representation differences rather than prove better
activation or execution, and it would correctly reject the malformed numeric
references observed above. No product solution has been implemented yet.

#### Review follow-up: helper implementation, n:5 (2026-09-28)

The approved helper approach is implemented in `darrow-review` **0.8.0**.
Repair scope inherits the effective base from the validated prior manifest.
The new `review-result finalize` command copies retained scope and check
receipts, preserves authoritative original findings and verification history,
derives the outcome, validates the completed record, and materializes the report.
The coordinator still supplies contextual judgment and reader findings.
Comprehensive review and repair verification both use this path. Independent
native readers, read-only boundaries, complete inline reports, and exact
canonical comparison remain required. Safe identifiers such as
`not_applicable` now remain literal; hostile Markdown still receives escaping.

The [invariants](../specs/code-review.md) were updated before implementation.
Both plugin manifests, the backend project, and its lock declare **0.8.0**.
No runtime dependency or eval-runner change was introduced.

All nine historical failure cases were rerun on the working-tree version
above, with Codex CLI **0.156.1**, candidate **gpt-6-luna/medium**, five trials
per case, three concurrent trials, and a 100% threshold. Cases ran sequentially;
failures were inspected before moving on. The semantic grader remained
**gpt-5.6-luna/low**. Native readers retained **gpt-6-sol/xhigh**, or the
configured **gpt-5.5/xhigh** in the override case. All **45 trials** completed;
no failed trial was replaced and no implementation changed during these runs.

**Task: 30/45. Activation: 43/45. Two of nine cases passed 5/5 for both.**
All evaluated read-only and publication-boundary checks passed.

| Case                                                                                                                            | Task | Activation | What failed                                                                                                                                                                                                                                                                | Assessment                                                                                                                                                                           | Recommendation                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ---: | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Both axes](../../evals/results/review-luna-helpers-2026-09-28/code-review-both-axes.json)                                      |  2/5 |        4/5 | Trial 2 missed activation. Trials 3 and 5 loaded the skill but returned defect prose without retained artifacts, native readers, or repair guidance.                                                                                                                       | Skill activation and workflow. The findings alone do not satisfy the intended review contract.                                                                                       | Investigate the shared workflow entry and why a loaded skill is bypassed; preserve usable guidance and canonical evidence.                                         |
| [Progress and advisory](../../evals/results/review-luna-helpers-2026-09-28/code-review-fix-verification-progress-advisory.json) |  5/5 |        5/5 | None. Legacy findings were accepted, blocker progress kept convergence open, and advisory findings remained nonblocking.                                                                                                                                                   | Passing sample; the earlier activation and legacy-input problems did not recur.                                                                                                      | Retain this case as a repair-verification control.                                                                                                                 |
| [Resolved fixes](../../evals/results/review-luna-helpers-2026-09-28/code-review-fix-verification-resolved.json)                 |  3/5 |        5/5 | Trial 1 returned a canonical blocked artifact without launching readers, citing an active delegation constraint. Trial 4 cleared all findings but changed source paths and the report link, including dropping the `folders` path segment.                                 | Loaded workflow and presentation failures. The exact cited host policy is unavailable in the bounded trace. The prior-base mismatch did not recur.                                   | Resolve the shared reviewer-authorization boundary; treat altered paths as substantive copying errors that exact comparison must continue to reject.               |
| [Unavailable evidence](../../evals/results/review-luna-helpers-2026-09-28/code-review-fix-verification-unavailable.json)        |  4/5 |        5/5 | Trial 2 returned prose, incorrectly assumed external-check.sh was absent, and retained neither the required check receipt nor verification report. The fixture command exists and exits 127 to report an unavailable external verifier.                                    | Skill workflow and an unsupported availability assumption. The other four trials captured the command and returned valid blocked reports.                                            | Run the requested check and retain its actual unavailable-verifier evidence; helpers enforce receipts only when invoked.                                           |
| [Low noise](../../evals/results/review-luna-helpers-2026-09-28/code-review-low-noise.json)                                      |  1/5 |        5/5 | Trial 1 returned only “No findings.” Trials 2 and 5 produced blocked reader evidence without launching readers; trial 5 cited a delegation prohibition. Trial 3 completed substantive review but changed underscore escaping in paths. Trial 2 also changed path escaping. | Loaded workflow and presentation failures; a possible host-policy conflict remains unverified. The formatter was captured in the retained-artifact trials.                           | Address shared execution and reader authorization first, then report copying; keep the formatter as check evidence and the accepted local design.                  |
| [Default presentation](../../evals/results/review-luna-helpers-2026-09-28/code-review-presentation-default.json)                |  3/5 |        5/5 | Trials 1 and 4 changed the changed-file path from canonical `&#95;b` to `_b`. Substantive checks and all five concision assessments passed.                                                                                                                                | Skill presentation under the current exact-copy contract. These particular encodings render equivalently; the malformed applicability entity from the previous sample did not recur. | Discuss path presentation or a narrowly defined rendered-equivalence contract separately; preserve checks for changed paths, lost content, and malformed entities. |
| [Pull request](../../evals/results/review-luna-helpers-2026-09-28/code-review-pull-request.json)                                |  4/5 |        5/5 | Trial 4 launched both readers but reported a standards record with an invalid sources array, then returned a canonical blocked report. The corrected newline requirement passed.                                                                                           | Native-reader handoff failure, based on the coordinator's retained validation report; the private reader record is unavailable. The fixture ambiguity did not recur.                 | Inspect the reader packet and require its owning reader to validate or correct it before handoff; retain truthful blocking for invalid evidence.                   |
| [Reviewer route override](../../evals/results/review-luna-helpers-2026-09-28/code-review-reviewer-route-override.json)          |  5/5 |        5/5 | None. Both configured routes and complete canonical output passed.                                                                                                                                                                                                         | Passing sample.                                                                                                                                                                      | Keep the route control and independent reviewer boundary.                                                                                                          |
| [Spec only](../../evals/results/review-luna-helpers-2026-09-28/code-review-spec-only.json)                                      |  3/5 |        4/5 | Trial 4 loaded the skill but returned only the defect description; trial 5 missed activation. Both identified the missing Anonymous fallback but omitted retained review artifacts.                                                                                        | Skill activation and workflow. This previously passing control is unstable in the fresh sample.                                                                                      | Include the same shared entry and execution repair used for both-axes; correct defect detection alone is insufficient.                                             |

The remaining problem is primarily execution after selection. **Thirteen of
15 failed trials loaded the skill.** Their primary failure categories were:
five prose shortcuts, three blocked reports without launched readers, one
invalid reader handoff, and four copy-only failures. The other two trials
missed activation. Low-noise trial 2 additionally overlaps the copying category.
These counts describe retained outcomes; they do not prove every private
command's root cause.

The new helpers provide validated scope, check transfer, and immutable finding
history when used. They do not force the coordinator to start that workflow,
authorize a host-prohibited action, make a reader's packet valid, or transfer
tool stdout directly into the final assistant response. No wrong repair base,
rejection of legacy guidance absence, or malformed applicability entity was
observed in this sample. Exact copying of paths remains unstable.

The previous baseline was **24/45 task and 42/45 activation**. This follow-up
also includes the earlier eval repairs, and individual cases vary: resolved
fixes fell from 4/5 to 3/5, both-axes from 3/5 to 2/5, and spec-only from 5/5
to 3/5. The aggregate increase is not a controlled estimate of the helpers'
effect. The repaired PR case separately passed 5/5 before this follow-up and
now passed 4/5 because of the reader handoff. Five-trial samples establish
observed behavior, not guaranteed stability.

Recommended next discussion: first inspect the effective host delegation
policy and loaded-trial entry behavior across both review modes. Resolve that
boundary before adding case-specific wording or weakening the native-reader
requirement. Then strengthen the existing reader validation handoff with its
owning reader. Treat final presentation as a separate contract decision:
equivalent entity encoding can be distinguished from missing path segments,
but complete content, usable links, literal hostile content, and the currently
required exact report must remain protected until that decision is accepted.
The helper implementation alone has not reached 5/5 reliability.

Raw trials are retained in the nine linked case files. The
[aggregate](../../evals/results/review-luna-helpers-2026-09-28/overview.json) and
[source manifest](../../evals/results/review-luna-helpers-2026-09-28/sources.json)
record the final sample, case digests, result checksums, and routes. This is a
nine-case Codex/macOS follow-up with native readers; the remaining plugin cases
and other hosts were outside this run.

The observed test-first slices below ran from
`plugins/capability/darrow-review/backend`:

1. Prior-base inheritance.

   Red — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k repair_scope_inherits_prior_base`: the scope CLI required `--base` despite the supplied prior manifest.

   Green — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k repair_scope_inherits_prior_base`: 1 passed.

2. Scope and retained-check finalization.

   Red — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k finalization_reads_scope_and_captured_checks`: the result CLI had no finalization command.

   Green — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k finalization_reads_scope_and_captured_checks`: 1 passed.

3. Authoritative legacy-finding preservation.

   Red — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k verification_finalization_preserves_external_legacy_findings`: finalization did not accept `--original`.

   Green — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k verification_finalization_preserves_external_legacy_findings`: 1 passed.

4. Readable safe identifiers with literal hostile content.

   Red — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k renderer_keeps_safe_words_readable_and_hostile_markup_literal`: the renderer still encoded the underscore in `not_applicable`.

   Green — `uv run --quiet --frozen --group dev pytest -q tests/test_cli_contract.py -k renderer_keeps_safe_words_readable_and_hostile_markup_literal`: 1 passed.

**Implementation gates passed:** the focused scope, finalization, CLI, and
golden-report suite passed **48 tests**. `bun run check:python` passed across
all registered packages; the review package passed **253 tests**, Ruff,
formatting, and strict typing, with **97.50% statement coverage** and
**95.59% branch coverage**. `bun run check:docs` passed. The fresh copied
plugin passed all seven entrypoints with the provider transcript mocked.
One fresh-context skill audit and the shared inspector found no material
issues. These checks do not replace live native-reader evidence.

#### Review follow-up: conditional session reminder (2026-09-28)

Further inspection found an **eval gap** in the preceding spec-only sample.
Trial 2 passed the then-current checks with a valid blocked report, no findings,
and no native reviewer launches. Thus the historical **30/45 task** count is
the recorded outcome under those checks, not proof of 30 complete independent
reviews. The repaired spec-only case requires Standards pass, Spec/verdict
fail, a blocking Spec finding, semantic detection of the missing Anonymous
fallback, and both configured native reader routes. Valid blocked reports no
longer satisfy that seeded-defect case.

The **0.8.1** candidate adds a static SessionStart reminder for review and
repair-verification intent. It advertises the complete coordinator workflow,
configured native readers, captured checks, and the canonical report. It
does not initiate review or grant implementation/publication authority.
Delegated axis readers remain within their assigned role. Codex and Claude
have separate native hook registrations and share the same contained context.
There is no eval-runner change or final-copy contract change.
Codex supports a manifest-selected hook file; Claude merges its default hook
file with manifest registrations, so the Codex config uses a non-default name
to prevent Claude from also loading it. See the
[Codex hook reference](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks)
and [Claude plugin manifest reference](https://code.claude.com/docs/en/plugins-reference#hooks).

The comparison uses identical Codex candidates except for hook registrations
and resources. Each of five implicit positive cases and two implementation
negative controls runs **n:5 per arm**, with **gpt-6-luna/medium**, three jobs,
and a 100% threshold. Reader routes remain **gpt-6-sol/xhigh**. Activation,
actual native axis launches, canonical-artifact gates, and task outcome are
reported separately. A bounded external observer records whether the native
developer context contains the reminder marker before fixture cleanup; it
does not alter the candidate, runner, or grading.

A preliminary spec-only run is preserved separately. It exposed a semantic
grader error: desired post-repair behavior in the report's resolution-evidence
field was treated as a contradictory claim about current behavior. The
proposition now distinguishes current diagnosis from desired repair behavior.
Calibration accepts the historical valid response and the preliminary valid
diagnosis, and rejects the historical blocked response and an unrelated Spec
finding. These regrades are calibration evidence, not fresh behavior trials.
The preliminary run's raw outcome was **1/5 task, 5/5 activation, 5/5 native
axis launches, and 5/5 valid canonical artifacts**. Three trials had that
grader error; two failed exact copying, with one overlapping trial. One copy
failure changed underscore escaping; the other truncated the target
fingerprint. This preliminary sample is excluded from the matched totals.

Implementation checks passed: both Bash versions emitted the exact context,
including a simulated Claude environment without `PLUGIN_ROOT`; Claude
manifest validation; documentation validation; and all registered Python
quality gates, including **253 review backend tests**. A bounded fresh-context
audit identified the Claude root-variable packaging issue, which was repaired
before freezing the comparison candidates. Live Claude hook behavior and
PowerShell execution remain unverified.

The matched comparison completed **70/70 trials** without stopping or replacing
failures. The frozen case digests match across arms, and candidate file hashes
confirm that only hook registrations and resources differ. The reminder marker
was observed in native developer context for **35/35 hook-on coordinators** and
**0/35 hook-off coordinators**. No delegated reader started another review.

Each table entry is **hook off / hook on**, with five trials per arm. “Routed
axes” counts trials with native launch evidence for every applicable axis at
`gpt-6-sol/xhigh`; it is separate from activation and valid artifact creation.

| Positive case                              |              Task |        Activation |       Routed axes | Valid canonical artifact |
| ------------------------------------------ | ----------------: | ----------------: | ----------------: | -----------------------: |
| `code-review-spec-only`                    |     3/5 / **5/5** |     3/5 / **5/5** |     3/5 / **5/5** |            3/5 / **5/5** |
| `code-review-both-axes`                    |         3/5 / 3/5 |     4/5 / **5/5** |     3/5 / **5/5** |            4/5 / **5/5** |
| `code-review-low-noise`                    |         3/5 / 3/5 |         5/5 / 5/5 |         5/5 / 5/5 |                5/5 / 5/5 |
| `code-review-fix-verification-resolved`    |         5/5 / 5/5 |         5/5 / 5/5 |         5/5 / 5/5 |                5/5 / 5/5 |
| `code-review-fix-verification-unavailable` |     3/5 / **5/5** |         5/5 / 5/5 |         3/5 / 2/5 |            3/5 / **5/5** |
| **All positive trials**                    | **17/25 / 21/25** | **22/25 / 25/25** | **19/25 / 22/25** |        **20/25 / 25/25** |

The unavailable-evidence case deliberately expects a blocked result. Every
hook-on trial ran the required script, retained its exit-127 receipt, and
returned the complete canonical blocked verification report. Trials 2, 3,
and 5 stopped before launching readers; trials 1 and 4 launched one Standards
reader. These are task passes for evidence-backed blocking, **not evidence of
five independent fix reviews**. Hook-off trials 1, 4, and 5 also retained blocked
reports and launched one reader each. The current workflow permits a blocked
terminal result without a coordinator's repair judgment, but the boundary
between blocking at check capture and proceeding to delegated verification
needs clarification before tightening that case's launch assertion.

Across the other four positive cases, native reviewers launched for every
applicable axis in **20/20 hook-on trials versus 16/20 hook-off trials**. All
20 hook-on trials loaded the complete skill and retained valid artifacts;
task checks passed **16/20 versus 14/20**. This reviewable subset explains the
delegation effect; the all-positive totals above retain the unavailable case.

| Negative control                                         | Task, off / on | Skill avoided, off / on | Review artifacts, off / on | Native readers, off / on |
| -------------------------------------------------------- | -------------: | ----------------------: | -------------------------: | -----------------------: |
| Ordinary implementation, without an explicit review veto |      5/5 / 5/5 |               5/5 / 5/5 |                  0/5 / 0/5 |                    0 / 0 |
| Edit request explicitly excluding review                 |      5/5 / 5/5 |               5/5 / 5/5 |                  0/5 / 0/5 |                    0 / 0 |

Transcript inspection classifies all **12 failed task trials**:

| Failure cluster                                   | Cases and trials                                                           | What failed                                                                                                                                                                                                                  | Assessment and next action                                                                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill not loaded                                  | Hook off: spec-only 3 and 5; both-axes 4                                   | Prose identified the seeded defects, but there was no verified skill read, native reader launch, or canonical artifact.                                                                                                      | Skill/host activation limitation. Retain the conditional reminder; these misses were absent in the hook sample.                                                                                                                                                   |
| Loaded skill, unsupported availability conclusion | Hook off: both-axes 3                                                      | A valid blocked report claimed readers were unavailable, with no observed native launch attempt or seeded findings. The exact host policy was not retained.                                                                  | Skill execution gap; availability reasoning remains unverified. Preserve actual host rejection evidence and distinguish it from an unattempted launch.                                                                                                            |
| Loaded skill, fix-verification workflow skipped   | Hook off: unavailable 2 and 3                                              | Trial 2 explicitly did not run the required check and suggested resolution by inspection. Trial 3 incorrectly rejected the supported legacy external handoff. Neither retained a verification artifact or launched a reader. | Skill execution gap. The hook sample completed check capture and canonical blocking in all five trials. Preserve that complete-workflow reminder.                                                                                                                 |
| Canonical report copied with different escaping   | Hook on: both-axes 3 and 5, low-noise 2 and 4; hook off: low-noise 2 and 3 | Both configured readers ran and substantive checks passed. The final answer changed canonical underscore entity escaping in source or scope paths; the retained artifacts were valid.                                        | Skill presentation failure under the existing exact-copy contract. These six are legitimate current-contract failures, even though the paths render equivalently. Address delivery of the canonical report across the plugin before making case-specific changes. |

**Recommendation:** retain the SessionStart reminder in **0.8.1**. This sample
supports improved selection and complete workflow execution, with no observed
ordinary-implementation boundary regression. It does not establish guaranteed
activation or a full-plugin 5/5 result. The next discussion should focus on
mechanically reliable canonical-report delivery: all **four remaining hook-on
task failures** share that presentation boundary, rather than missing reviewer
launches. Separately agree on whether a real unavailable required check should
stop before delegation, then encode that policy in the skill and its eval.
Neither follow-up is implemented here; the exact-copy contract remains intact.

The local [comparison overview](../../evals/results/review-hook-ab-2026-09-28/overview.md)
links every raw result and the trial assessments. Its colocated `overview.json`,
`summary.json`, `variants.json`, `protocol.json`, metrics, and hook receipts
retain hashes, native launch observations, and provenance. Results are
gitignored; this Markdown section preserves the conclusions in the repository.
The earlier preliminary five trials remain excluded and retained. These
measurements cover the seven selected cases on Codex CLI **0.156.1**, not every
case in the plugin or live Claude/Windows execution.

### darrow-skill-authoring

| Case                                                                                                                                            | What failed                                                                                                       | Assessment                                  | Recommended next step                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [author-agent-skill-validate-read-only](../../plugins/foundation/darrow-skill-authoring/skills/audit-agent-skill/evals/validate-read-only.yaml) | The original response quoted “publish when ready” without judging its missing authority and readiness conditions. | Skill gap repaired; activation intermittent | The workflow now audits action boundaries and reports discovery separately. The focused case passed 5/5 before assertion hardening and passed a fresh final-assertion trial; a later final-assertion trial passed task checks but missed implicit activation. Keep that discovery limit visible. |

The [authorized-publication control](../../plugins/foundation/darrow-skill-authoring/skills/audit-agent-skill/evals/validate-authorized-publication.yaml) passed one Codex Luna/medium trial before the later draft-fixture change, including a mock-backed check that the audit did not attempt `npm publish`. Both validation cases catch staged edits; the negative case uses semantic checks for the three findings. A package-layout check in `create-python-mechanic` was corrected to test the documented frozen `--no-dev` runtime command rather than require one literal UV setting. All ten cases had a passing trial on that earlier content, but there was no clean first-pass suite.

The follow-up changed prepared target skills to `SKILL.draft.md`, strengthened the authoring description and creation input gate, and reran focused Luna/medium trials. `refuse-undefined-skill` passed **5/5** with task and activation on the final content. A previous trial had answered correctly after reading the full authoring skill from the eval marketplace staging copy, but the activation probe did not count that read; the probe now recognizes a complete, installed-body-matching read from a catalog-bound staging path. `validate-read-only` passed task and activation in focused trials, but the first trial of its final 5-run check passed the task without reading either skill path, so implicit selection remains unreliable. `validate-authorized-publication`, `create-focused-skill`, `reuse-current-review`, and `repair-skill-boundaries` each passed a fresh final-content trial. The repair case's prior discovery regex had rejected the valid phrase “Check deployment configuration and review deployment evidence”; the replacement semantic artifact check accepted that response's skill text and rejected a vague counterexample. An independent challenge found that `create-focused-skill` did not check empty release-note sections; its hidden check now tests missing, empty Summary, and empty Testing sections, and a fresh trial passed. The revised plugin does not yet have a clean full-suite or 5/5 audit result. Native Claude Code live behavior and Windows/Linux artifact behavior remain unverified.

A subsequent [70-trial description comparison](../../evals/experiments/skill-authoring-description/snapshots/2026-09-25.md) tested one concise metadata candidate against the current description on four positive and three negative intents. Positive activation was **11/20 candidate versus 12/20 control**; both avoided authoring on **15/15** negative trials per arm and passed **16/20** positive task checks. A tightened packaging check passed a separate 5/5 rerun per arm. Read-only audit activation remained poor under both descriptions; skill repair passed only 2/5 task checks under either description. Do not adopt the concise wording. Discuss a distinct audit skill within the authoring plugin and investigate repair execution separately, then retest the whole intent boundary.

The follow-up split `darrow-skill-authoring` into `create-agent-skill` and read-only `audit-agent-skill` at version 0.3.0. Implementing an audit finding is ordinary engineering; the old general repair case is archived outside the active suite. The shared inspector and shell matrix moved to plugin-level `backend/`. The active suite now has 13 cases. On the finished skill and case content, all **7 audit cases** and **6 creation cases** passed **5/5 task and activation** in separate Codex `gpt-6-luna`/medium runs at a 100% threshold. The local result files are under gitignored `evals/results/`, from `2026-09-25T16-50-14-237Z` through `2026-09-25T17-45-14-422Z`. The negative `implement-audit-finding` case needed one-job execution for a 5/5 task result; two five-job runs had a first-trial edit artifact failure while both skills were correctly avoided in every trial. Full 65-trial attempts were stopped during diagnosis, so there is no single clean full-suite result file. Intermediate runs also had occasional implicit-selection misses; the final 5/5 measurements are samples, not a guarantee of perfect activation. Native Claude Code, Windows, Linux, and Bash 5 remain unverified here.

### darrow-tdd

| Case                                                                                                         | What failed                                                                                                                                         | Assessment         | Recommended next step                                                              |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| [tdd-invalid-red-causes](../../plugins/capability/darrow-tdd/skills/tdd/evals/invalid-red-causes.yaml)       | All invalid red causes were diagnosed failed.                                                                                                       | Skill likely       | Require a valid focused red/green cycle and accurate evidence; rerun this case.    |
| [tdd-meaningful-red](../../plugins/capability/darrow-tdd/skills/tdd/evals/meaningful-red.yaml)               | The answer omitted the exact focused `bash test.sh` command and precise final-gate status; activation also failed.                                  | Skill + activation | Repair the failed behavior and trigger; rerun this case and its matched control.   |
| [tdd-product-value-bug-fix](../../plugins/capability/darrow-tdd/skills/tdd/evals/product-value-bug-fix.yaml) | Bug fix was driven through an observed red and green cycle failed.                                                                                  | Skill likely       | Require a valid focused red/green cycle and accurate evidence; rerun this case.    |
| [tdd-public-red-green](../../plugins/capability/darrow-tdd/skills/tdd/evals/public-red-green.yaml)           | It names bash test.sh and reports a pass, but says the failure was due to whitespace being included in the greeting, not missing stranger behavior. | Skill likely       | Require a valid focused red/green cycle and accurate evidence; rerun this case.    |
| [tdd-vertical-slices](../../plugins/capability/darrow-tdd/skills/tdd/evals/vertical-slices.yaml)             | Activation missed tdd; observed none.                                                                                                               | Skill activation   | Check trigger and mounted-skill discovery; rerun this case with a matched control. |

Follow-up on Codex `gpt-6-luna`/medium: all 11 then-current cases passed one fresh, sequential trial at a 100% threshold after an assertion repair. The `tdd-public-red-green` grader had rejected a correct description of the observed red result (whitespace in the greeting) because it expected the phrase "missing stranger behavior." Its proposition now accepts that concrete mismatch while rejecting an unrelated syntax-error red. Regrading the retained answer and a syntax-error counterexample gave the intended pass/fail split; a fresh [five-trial run](../../evals/results/2026-09-27T07-20-18-118Z-codex-gpt-6-luna-medium.json) passed **5/5 task and 5/5 activation**. No TDD skill instructions changed.

One `tdd-product-value-bug-fix` trial completed every task check but had no verified skill-body read; an immediate repeat passed both task and activation. This is an intermittent implicit-activation miss, not a demonstrated workflow defect. The 11 passing trials were separate case runs, not a single full-suite or five-trial-per-case pass. Investigate activation if the target is consistent 5/5 selection across the plugin.

A complete [55-trial follow-up](../../evals/results/2026-09-27T08-03-39-358Z-codex-gpt-6-luna-medium.json) then ran all 11 cases on Codex `gpt-6-luna`/medium with five serial trials per case, a 100% threshold, and the direct runner's `gpt-5.6-luna`/low semantic grader. It continued through every failure. **6/11 cases** met the threshold; **44/55 trials** passed both task and activation. Task checks passed **51/55** and activation passed **45/55**.

| Case                          | Task | Activation | Both | Failed-trial assessment                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---: | ---------: | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tdd-ambiguous-seam`          |  5/5 |        5/5 |  5/5 | —                                                                                                                                                                                                                                                                                                                           |
| `tdd-explicit-invocation`     |  5/5 |        5/5 |  5/5 | —                                                                                                                                                                                                                                                                                                                           |
| `tdd-integration-test-intent` |  4/5 |        3/5 |  3/5 | Trial 2 did not establish a red-before-green cycle through the requested public-seam command and missed activation; trial 4 passed the task without a verified skill read.                                                                                                                                                  |
| `tdd-invalid-red-causes`      |  5/5 |        5/5 |  5/5 | —                                                                                                                                                                                                                                                                                                                           |
| `tdd-meaningful-red`          |  3/5 |        3/5 |  3/5 | Trials 2–3 missed activation and omitted the literal focused command from the final red/green evidence; trial 3 also did not explicitly establish that the unrelated full-suite failure was pre-existing.                                                                                                                   |
| `tdd-product-value-bug-fix`   |  4/5 |        4/5 |  3/5 | Trial 3 passed the task without a verified skill read. Trial 5 loaded the skill and claimed a focused `node --test` red/green cycle, but the fixture traces only `bash test.sh`, so its failed trace check cannot settle whether that permitted focused cycle occurred. Treat this task failure as eval/behavior uncertain. |
| `tdd-public-red-green`        |  5/5 |        5/5 |  5/5 | —                                                                                                                                                                                                                                                                                                                           |
| `tdd-review-only`             |  5/5 |        5/5 |  5/5 | —; `tdd` was correctly avoided.                                                                                                                                                                                                                                                                                             |
| `tdd-test-maintenance-only`   |  5/5 |        5/5 |  5/5 | —; `tdd` was correctly avoided.                                                                                                                                                                                                                                                                                             |
| `tdd-test-quality-selection`  |  5/5 |        2/5 |  2/5 | Three otherwise correct, no-edit decisions had no verified skill read. The prompt asks for a test-first choice before implementation, which the skill itself covers.                                                                                                                                                        |
| `tdd-vertical-slices`         |  5/5 |        3/5 |  3/5 | Two correct two-slice implementations had no verified skill read.                                                                                                                                                                                                                                                           |

The dominant repeatable issue is implicit selection: ten positive trials had no verified complete `tdd` body read. One native diagnostic showed an attempted read that did not return frontmatter or body; the other misses contained no qualifying read evidence. The four task failures comprise three final-evidence or observed-cycle misses alongside activation misses and one `product-value-bug-fix` trace ambiguity after activation. Next, investigate the implicit-selection boundary across TDD intents and calibrate the product-value trace against permitted focused commands before changing the skill workflow. These results measure Codex only; they do not establish Claude Code behavior or long-run activation reliability.

The advice-only `tdd-test-quality-selection` case was subsequently removed from the active suite at plugin version 0.1.4 because its positive implicit-activation expectation was ambiguous under the implementation-centered skill description. Its row above remains historical evidence from the 11-case run; the active suite now has 10 cases. The remaining four below-threshold cases still account for seven activation misses in 20 trials, so removing the ambiguous case does not explain away the selection issue. TDD-E3 still calls for test-quality coverage: active cases check public seams and independent oracles, but none directly tests the former case's private-helper, tautological-oracle, and mocked-subject comparison together.

At version 0.1.5, the `tdd-product-value-bug-fix` prompt now specifies `bash test.sh` as both focused red/green command and final test command, matching its deterministic trace. A fresh trial proved the trace check can pass under this prompt, though it missed activation and omitted red evidence from the final answer. The later control run passed the revised case 5/5 task and activation. This resolves the earlier command-contract ambiguity without changing the TDD workflow.

The seven activation misses from the 55-trial run were inspected together: six retained no skill-read attempt and one retained an attempted mounted read whose output contained neither complete skill body nor frontmatter. The skill was mounted and read successfully in other trials of the same cases. These records establish missing verified reads, not why the model skipped or failed to complete them.

A matched description comparison used the four clear positive intents and both negative boundaries, five serial trials per case on Codex `gpt-6-luna`/medium at a 100% threshold. Both arms used `--skill-dir` with the same plugin-package layout; only the frontmatter description differed. The [current-description result](../../evals/results/2026-09-27T08-47-57-635Z-codex-gpt-6-luna-medium.json) and [candidate result](../../evals/results/2026-09-27T09-09-36-937Z-codex-gpt-6-luna-medium.json) are retained. An initial candidate attempt without plugin manifests was interrupted and excluded; a subsequent explicit-invocation trial verified the corrected temporary package before the candidate run.

The candidate description was:

```text
You MUST use this skill when the user asks to implement or fix product behavior with TDD, test-driven development, test-first development, a red/green cycle, or an integration-style test. Load it before writing tests or changing product code. Use public behavior seams and one meaningful red/green slice at a time. Do not use for test review, fixture maintenance, test-infrastructure repair, or running tests without product implementation.
```

| Case                          | Current task | Current activation | Candidate task | Candidate activation |
| ----------------------------- | -----------: | -----------------: | -------------: | -------------------: |
| `tdd-integration-test-intent` |          4/5 |                4/5 |            3/5 |                  3/5 |
| `tdd-meaningful-red`          |          3/5 |                2/5 |            4/5 |                  3/5 |
| `tdd-product-value-bug-fix`   |          5/5 |                5/5 |            5/5 |                  4/5 |
| `tdd-vertical-slices`         |          5/5 |                5/5 |            5/5 |                  5/5 |
| `tdd-review-only`             |          5/5 |        5/5 avoided |            5/5 |          5/5 avoided |
| `tdd-test-maintenance-only`   |          5/5 |        5/5 avoided |            5/5 |          5/5 avoided |

Positive activation was **16/20 current versus 15/20 candidate**; both arms avoided the skill in **10/10** negative trials. The candidate changed which case missed but did not improve the aggregate, so its wording was not adopted. The original description and skill workflow remain in place. The plugin README now records the observed Codex implicit-selection instability and gives the existing explicit-invocation path for work that requires the TDD workflow. These samples do not prove a permanent activation rate or native Claude Code behavior.

A second, goal-first description experiment froze those same four positive and two negative cases, including their prompts, fixtures, and checks. Separate copies of the same 0.1.5 plugin were mounted with `--skill-dir`; the only file difference was the `SKILL.md` frontmatter description. Both arms ran five serial trials per case on Codex CLI 0.156.1 with `gpt-6-luna`/medium and a 100% threshold. The [fresh control](../../evals/results/tdd-goal-first-control.json) and [goal-first candidate](../../evals/results/tdd-goal-first-candidate.json) are retained.

The candidate description was:

```text
Implement a behavior change or fix a bug by writing a durable public-seam test first, observing it fail, then making it pass. Use for TDD, red/green, test-first implementation, integration-style test-driven work, or regression coverage that drives the fix. Do not use for test review, fixture maintenance, test infrastructure repair, or running tests without product implementation.
```

| Case                          | Fresh control task | Fresh control activation | Goal-first task | Goal-first activation |
| ----------------------------- | -----------------: | -----------------------: | --------------: | --------------------: |
| `tdd-integration-test-intent` |                5/5 |                      4/5 |             4/5 |                   2/5 |
| `tdd-meaningful-red`          |                3/5 |                      2/5 |             5/5 |                   5/5 |
| `tdd-product-value-bug-fix`   |                5/5 |                      4/5 |             5/5 |                   5/5 |
| `tdd-vertical-slices`         |                5/5 |                      3/5 |             5/5 |                   3/5 |
| `tdd-review-only`             |                5/5 |              5/5 avoided |             5/5 |           5/5 avoided |
| `tdd-test-maintenance-only`   |                5/5 |              5/5 avoided |             5/5 |           5/5 avoided |

Positive activation was **13/20 control versus 15/20 goal-first candidate**; positive task checks passed **18/20 versus 19/20**. Both arms avoided TDD in **10/10** negative trials. The candidate improved meaningful-red selection but reduced integration selection, and neither arm reached 5/5 on all four positive cases. The previous matched current-description batch had **16/20** positive activation, above this candidate's **15/20**. These small, variable samples do not show a repeatable plugin-wide improvement, so no confirmation run or product-description change was made. The runner and all active eval cases remained unchanged during this experiment.

A separate SessionStart experiment kept the shipped description and skill body unchanged. The staged candidate added only a plugin-local `hooks/hooks.json` and a small Bash hook that supplies static TDD intent and exclusion context. It does not inspect the prompt, invoke the skill, edit a repository, or grant authority. A one-trial native smoke probe wrote a temporary receipt, confirming that the isolated Codex runner executed the bundled hook; the receipt write was removed before both measured batches. The Codex eval adapter uses `--dangerously-bypass-hook-trust`, so normal installation still requires the user's hook trust review.

The [first hook batch](../../evals/results/tdd-session-hook-candidate.json) and [fresh confirmation batch](../../evals/results/tdd-session-hook-confirmation.json) each ran the same four positive and two negative cases at five serial trials per case, a 100% threshold, Codex CLI 0.156.1, and `gpt-6-luna`/medium. The retained no-hook batches above used the same cases, prompts, checks, model, effort, and CLI version.

| Case                          | No hook: fresh control activation | Hook batch 1 activation | Hook batch 2 activation |
| ----------------------------- | --------------------------------: | ----------------------: | ----------------------: |
| `tdd-integration-test-intent` |                               4/5 |                     5/5 |                     5/5 |
| `tdd-meaningful-red`          |                               2/5 |                     5/5 |                     5/5 |
| `tdd-product-value-bug-fix`   |                               4/5 |                     5/5 |                     5/5 |
| `tdd-vertical-slices`         |                               3/5 |                     4/5 |                     5/5 |
| `tdd-review-only`             |                       5/5 avoided |             5/5 avoided |             5/5 avoided |
| `tdd-test-maintenance-only`   |                       5/5 avoided |             5/5 avoided |             5/5 avoided |

Positive activation was **19/20** and **20/20** in the hook batches, versus **13/20** in the fresh no-hook control and **16/20** in the earlier no-hook control: **39/40 hook versus 29/40 no hook** across these retained samples. Hook task checks passed **20/20** in each batch; both negative boundaries avoided TDD **10/10** in each batch. This is strong local evidence that the static reminder improves Luna selection for these cases without an observed boundary regression. The one vertical-slices miss was an activation failure, and separate stochastic batches do not establish a guaranteed activation rate or fully isolate time-varying host effects.

The reminder was then made permanent in `darrow-tdd` **0.1.6** with a Codex plugin-local SessionStart hook. The packaged Bash reader emitted byte-identical context to the tested candidate; a PowerShell reader uses the same static context file for Windows. The `tdd` skill body and description did not change. The full active [50-trial Codex run](../../evals/results/tdd-session-hook-permanent-full.json) at `gpt-6-luna`/medium completed **50/50 task checks**, **39/40 positive activations**, and **10/10 negative avoidances**. Nine of ten cases reached 5/5 on both dimensions. `tdd-ambiguous-seam` passed its task checks 5/5 but activated 4/5; the missed trial retained an attempted mounted read without the complete skill body or frontmatter, so activation correctly remained unverified.

The first full-suite attempt was interrupted after a task-correct ambiguous-seam answer failed a redundant literal-output regex. The answer had asked for the CLI flag or configuration key, and the existing semantic check accepted it. That regex was removed; regrading the retained valid answer and a vague counterexample gave pass/fail respectively, and a fresh single trial passed before the full run above. This was an eval assertion repair, not a skill workflow change. Normal Codex installs still require hook trust; the eval runner bypassed trust for isolated execution. Native Windows execution and Claude Code behavior were not measured in this follow-up. A natural negative implementation request that includes tests but does not ask for test-first work remains a useful future boundary probe.

### darrow-ticket-pipeline

| Case                                                                                                                                                           | What failed                                                                                                                                        | Assessment   | Recommended next step                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| [ticket-pipeline-implement-approved-local-change](../../plugins/orchestration/darrow-ticket-pipeline/skills/implement-ticket/evals/approved-local-change.yaml) | Implementation artifact is complete failed.                                                                                                        | Skill likely | Repair implementation handoff and required final behavior; rerun. |
| [ticket-pipeline-normal-ticket-delivery](../../plugins/orchestration/darrow-ticket-pipeline/skills/deliver-ticket/evals/normal-ticket-delivery.yaml)           | Final behavior is correct failed. Also: focused tests and repository gate pass, ticket retains all phase artifacts and verified state (+6 checks). | Skill likely | Repair implementation handoff and required final behavior; rerun. |

### darrow-ticket-to-pr

| Case                                                                                                                                         | What failed                                                                                                                                                                                                                             | Assessment         | Recommended next step                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| [ticket-to-pr-compatible-orchestrator](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/compatible-orchestrator.yaml) | Compatible provider receives the exact ticket once failed. Also: compatible provider blocker is relayed. Activation contract failed; observed ticket-to-pr.                                                                             | Skill + activation | Repair the failed behavior and trigger; rerun this case and its matched control. |
| [ticket-to-pr-composition-existing-pr](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/composition-existing-pr.yaml) | Ticket implementation meets acceptance failed. Also: additional commits and intended implementation reach the existing PR branch, forge observation proves the intended final commit (+6 checks).                                       | Skill likely       | Repair exact delegation and feedback relay, then rerun this ticket case.         |
| [ticket-to-pr-composition-replacement](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/composition-replacement.yaml) | Ticket implementation meets acceptance failed. Also: additional commits and intended implementation reach the existing PR branch, forge observation proves the intended final commit (+6 checks). Activation contract failed; observed… | Skill + activation | Repair the failed behavior and trigger; rerun this case and its matched control. |
| [ticket-to-pr-feedback-rejected](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/feedback-rejected.yaml)             | Revoked approval was actually attempted after discovery failed. Also: the same owner receives the answer before reporting the rejection, approval rejection remains a blocker rather than completion (+1 checks).                       | Skill likely       | Repair exact delegation and feedback relay, then rerun this ticket case.         |
| [ticket-to-pr-feedback-relay](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/feedback-relay.yaml)                   | Same owner implements the explicit decision failed. Also: user answer is acknowledged before production mutation, delivery prepares the exact ticket branch once (+10 checks).                                                          | Skill likely       | Repair exact delegation and feedback relay, then rerun this ticket case.         |
| [ticket-to-pr-unattended-grant](../../plugins/task-recipe/darrow-ticket-to-pr/skills/ticket-to-pr/evals/unattended-grant.yaml)               | Receipt preserved at the delegation seam failed. Also: adaptive result relayed. Activation contract failed; observed ticket-to-pr.                                                                                                      | Skill + activation | Repair the failed behavior and trigger; rerun this case and its matched control. |

### darrow-tickets

| Case                                                                                                                   | What failed                                                                                 | Assessment        | Recommended next step                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| [create-ticket-no-attribution](../../plugins/capability/darrow-tickets/skills/create-ticket/evals/no-attribution.yaml) | Ticket created failed. Also: no attribution in the ticket, no invented export requirements. | Skill likely      | Check the bundled CLI trace and matcher against the contract, then rerun. |
| [read-ticket-indirect-url](../../plugins/capability/darrow-tickets/skills/read-ticket/evals/indirect-url.yaml)         | Bundled CLI owns the URL retrieval failed.                                                  | Mixed / uncertain | Check the bundled CLI trace and matcher against the contract, then rerun. |
| [read-ticket-relation-failure](../../plugins/capability/darrow-tickets/skills/read-ticket/evals/relation-failure.yaml) | Bundled CLI owns the failed retrieval failed.                                               | Mixed / uncertain | Check the bundled CLI trace and matcher against the contract, then rerun. |

### darrow-verification

| Case                                                                                                                                           | What failed                                                                                                                                                                             | Assessment       | Recommended next step                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| [verification-criterion-gap](../../plugins/capability/darrow-verification/skills/verify-change/evals/criterion-gap.yaml)                       | Although the conclusion and next action come first and the response preserves the key evidence, it repeats the complete-report link in both the evidence section and the final link.    | Eval likely      | Review whether a repeated link should fail a complete assessment; adjust the check if not, then rerun. |
| [verification-existing-review](../../plugins/capability/darrow-verification/skills/verify-change/evals/existing-review.yaml)                   | Retained report handoff is rendered last failed. Also: existing provider retains a canonical failing current review, existing result and complete provider report validate (+1 checks). | Skill likely     | Repair provider evidence and final handoff; rerun this case.                                           |
| [verification-followup-missing-history](../../plugins/capability/darrow-verification/skills/verify-change/evals/followup-missing-history.yaml) | It notes missing prior findings and history, but still declares the candidate clear/pass based on an initial full review rather than blocking targeted follow-up.                       | Skill likely     | Repair provider evidence and final handoff; rerun this case.                                           |
| [verification-incomplete](../../plugins/capability/darrow-verification/skills/verify-change/evals/incomplete.yaml)                             | Activation missed verify-change; observed none.                                                                                                                                         | Skill activation | Check trigger and mounted-skill discovery; rerun this case with a matched control.                     |

Follow-up (2026-09-27): Fresh Codex `gpt-6-luna`/medium single trials passed task
and activation for criterion gap
(`evals/results/2026-09-27T18-39-14-262Z-codex-gpt-6-luna-medium.json`), missing
follow-up history
(`evals/results/2026-09-27T18-46-37-499Z-codex-gpt-6-luna-medium.json`), and
incomplete input
(`evals/results/2026-09-27T18-47-29-269Z-codex-gpt-6-luna-medium.json`).
The existing-review trial retained a canonical review under the runner's
`DARROW_REVIEW_STATE_DIR`, but four checks still searched `.git`; that was an eval
defect, not a missing provider result. The case now checks the review-state
directory, and both plugin manifests moved to 0.2.10. A fresh single trial
passed every task and activation check
(`evals/results/2026-09-27T18-53-33-538Z-codex-gpt-6-luna-medium.json`).

The corrected existing-review case then passed **3/5 task** and **5/5 activation**
at a 100% threshold
(`evals/results/2026-09-27T18-58-09-500Z-codex-gpt-6-luna-medium.json`).
In trials 4 and 5, canonical review records and reports validated, but the
verification response supplied inline review text instead of the renderer's
final absolute report link. Trial 5 also concluded blocked because the returned
provider text did not directly establish C2; whether that is a valid evidence
gap or a missed available observation needs a focused provider-handoff audit.
At that point, the full 16-case n:5 pass had not run because this case remained
below threshold.
The original sweep counts above remain historical.

Follow-up completion (2026-09-28): `darrow-verification` **0.2.10** now has a
fresh five-trial result for each of its 16 Codex cases: **80/80 task checks** and
**80/80 activation checks**, including 5/5 negative avoidance. Candidate route:
`gpt-6-luna`/medium; semantic grader: `gpt-5.6-luna`/low; Codex CLI 0.156.1;
threshold 100%, jobs 3. The [complete case evidence](../../evals/results/verification-luna-followup-full.json)
is assembled from separate case runs, with [source-run provenance](../../evals/results/verification-luna-followup-full-sources.json).
This is a measured five-trial outcome, not a guarantee of future stability.

The repair spans the public review/verification boundary. `darrow-review`
**0.7.3** appends a canonical absolute report link in both comprehensive and
fix-verification Markdown. Verification requires that promised reference,
validates its exact filesystem path, and preserves its complete rendered
handoff. It reads script-backed check assertions when reconciling criterion
coverage. The existing-review fixture now identifies the caller's checksum
scheme and asserts `retries=3` in its check, so C2 has real current evidence.

The broader pass also found a mode error: every trial of missing-history
initially substituted a comprehensive review for the requested fix verification.
Three were incorrectly accepted by the old semantic assertion because they
avoided claiming historical repair lineage. The skill now binds follow-up mode
before assessment and blocks missing history without launching a replacement
review. The eval checks the blocked result and absence of a replacement report;
its fresh confirmation passed 5/5. Criterion-gap's concision check and
missing-review's owner-binding wording were narrowed after retained valid
answers were rejected for harmless restatements. Each revised assertion was
calibrated against a valid answer and a plausible counterexample before fresh
trials.

Existing-review remained intermittent during the pass: a 3/5 run reported an
unreadable report path and an unavailable Standards baseline; a later 4/5 run
reported that both readers could not read their scope manifest. The review skill
now preflights the exact baseline path and copies the scope helper's manifest
path unchanged to both readers, retaining the attempted path and error on a
failed read. The [final existing-review run](../../evals/results/2026-09-27T22-47-22-356Z-codex-gpt-6-luna-medium.json)
passed 5/5 task and activation. These were provider/handoff failures, not missed
skill activation; the path-transfer explanation is supported by the reported
gaps, but the bounded retained trace does not establish every failed command.

Focused review checks also exposed stale eval expectations: presentation checks
forbade the newly required report link, and fix-verification still expected its
scope manifest under `.git`. The checks now follow the public renderer and
review-state contracts. Fresh comprehensive presentation and resolved-fix
verification trials each passed task and activation. The review backend's 238
tests and the repository Python gate passed after the renderer change. The full
review-plugin live suite and Claude/native Windows behavior were not rerun in
this follow-up.

## Separate repository-guide driver

The guide driver also pins its semantic grader to `gpt-6-luna/medium`. It stopped after `guide-selection` failed, as designed. The remaining questions were run individually with the same candidate, grader, trial count, and threshold. Combined result: **11 passed, 11 failed** across 22 unique questions. These are additional trials; guide cases above may have different outcomes because they used the direct runner's lightweight grader.

Raw evidence: `evals/results/guide-v1/2026-09-24T11-09-29-475Z/` and remaining questions (`evals/results/issue-228-guide-luna-grader-remaining/`).

| Case                                                                                                | What failed                                                                                                                                                                                                                           | Assessment                | Recommended next step                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [guide-contributing](../../.agents/skills/darrow-guide/evals/guide-contributing.yaml)               | Nearby repository evidence failed. Also: question contract. Activation missed darrow-guide; observed none.                                                                                                                            | Skill / harness uncertain | Inspect native final-message evidence; repair answer completion or response capture, then rerun.                       |
| [guide-diagnosis-available](../../.agents/skills/darrow-guide/evals/guide-diagnosis-available.yaml) | It identifies a troubleshooting capability and requests host, version, and the exact error, but asks the capability to investigate rather than stating that diagnostics should not be run.                                            | Eval likely               | Allow routing to an available diagnostic capability without treating that as running diagnostics; calibrate and rerun. |
| [guide-incomplete](../../.agents/skills/darrow-guide/evals/guide-incomplete.yaml)                   | Activation missed darrow-guide; observed none.                                                                                                                                                                                        | Skill activation          | Check implicit guide discovery for incomplete questions; rerun with a control.                                         |
| [guide-installation](../../.agents/skills/darrow-guide/evals/guide-installation.yaml)               | Activation missed darrow-guide; observed none.                                                                                                                                                                                        | Skill activation          | Check implicit guide discovery for installation guidance; rerun with a control.                                        |
| [guide-mutation](../../.agents/skills/darrow-guide/evals/guide-mutation.yaml)                       | The guide refused installation and made no changes; the grader treated a warning about possible project installation effects as a current effect.                                                                                     | Eval likely               | Distinguish a warning about hypothetical installation effects from actual effects; calibrate and rerun.                |
| [guide-orchestration](../../.agents/skills/darrow-guide/evals/guide-orchestration.yaml)             | Nearby repository evidence failed.                                                                                                                                                                                                    | Skill likely              | Cite a governing design or specification source in the refusal; rerun.                                                 |
| [guide-rationale](../../.agents/skills/darrow-guide/evals/guide-rationale.yaml)                     | It supports native ownership and says the ticket pipeline is an explicitly invoked reference and benchmark. It does not clearly establish explicit orchestration, so the full proposition is not supported. It makes no claims about… | Skill likely              | State the explicit orchestration rule in the rationale; rerun.                                                         |
| [guide-recipes](../../.agents/skills/darrow-guide/evals/guide-recipes.yaml)                         | The answer described the saved-grant entry and one delegation, but the semantic grader rejected that point. Activation also failed.                                                                                                   | Mixed                     | Calibrate the saved-grant proposition against the retained answer, and fix missing activation separately; rerun.       |
| [guide-selection](../../.agents/skills/darrow-guide/evals/guide-selection.yaml)                     | It says workflows are selected by intent and both plugins are optional, but does not establish independent adoption or that no orchestrator is mandatory.                                                                             | Skill likely              | State that Review needs no mandatory orchestrator; rerun.                                                              |
| [guide-troubleshooting](../../.agents/skills/darrow-guide/evals/guide-troubleshooting.yaml)         | Activation missed darrow-guide; observed none.                                                                                                                                                                                        | Skill activation          | Check implicit guide discovery for tutorial follow-ups; rerun with a control.                                          |
| [guide-unknown](../../.agents/skills/darrow-guide/evals/guide-unknown.yaml)                         | Nearby repository evidence or inspected documentation scope failed.                                                                                                                                                                   | Skill likely              | Include the inspected documentation scope or repository source in the final answer; rerun.                             |

## Follow-up order

1. Audit deterministic review checks and the clear semantic-grader mismatches before changing skill contracts.
2. Fix observable skill and activation misses in focused slices, preserving each case’s original acceptance rule.
3. Rerun each affected case fresh on Codex `gpt-6-luna/medium`; use multiple trials before claiming stability. Keep the direct-runner and guide-driver semantic routes distinct.
