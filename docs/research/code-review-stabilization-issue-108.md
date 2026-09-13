# Codex review stabilization — issue 108

This follow-up implements [issue #108](https://github.com/BjRo/darrow/issues/108).
All 26 fresh N=5 cases meet both 80% gates. Joint passes increased from
119 to 122 out of 130, and perfect cases increased from 15 to 18.

The prerequisite branch was merged by
[PR #96](https://github.com/BjRo/darrow/pull/96) on September 7, 2026, as
`949212c556c69ca4e40d2ace58d5aca15468482d`; the implementation checkout contains
that merge.

## Baseline and failure ownership

The retained September 6–7 evidence reproduces the issue's baseline exactly:
26 Codex cases, five trials per case, candidate `gpt-5.6-terra` at `medium`,
and an 80% acceptance threshold. Task behavior passed 122/130 trials (93.8%),
activation passed 126/130 (96.9%), and both passed together 119/130 (91.5%).
All baseline cases record `codex-cli 0.153.4`.
Fifteen cases were perfect; eleven had four joint passes. Every case met both
the task and activation thresholds.

Task, activation, and joint passes are counted independently from each trial.
A perfect case has five joint passes. A threshold-floor case has exactly four
passes in its lower-scoring task or activation dimension; the runner gates them
separately. Joint pass rate is reported as a separate measurement rather than
silently substituted for the acceptance gate.

The reconstruction uses all five completed checkpoints for each selected case,
including completed case batches from runs interrupted during later cases, plus
completed individual case runs. It does not treat a single checkpoint as an
N=5 result. The local, ignored reconstruction at
`evals/results/issue-108/baseline.json` preserves each case's source attempt,
source result path, lifecycle status, and all five original trials. Derived pass
rates use all five trials; copied single-trial performance summaries are omitted.

The following table describes the failing baseline trial in each floor case.
Task/activation/joint counts are out of five. Historical final responses and
bounded retained events are evidence of the reported outcomes; they do not
reconstruct files or command traces that were not retained.

| Case suffix                       | Task / activation / joint | Diagnosis and disposition                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| empty-diff                        | 4 / 5 / 4                 | A blocked report was returned, but checks could not locate the required canonical result artifact. Missing retained file/command evidence prevents distinguishing an absent artifact from a misplaced artifact or lookup defect. Keep the canonical-path requirement; current N=1 probe passes. |
| fix-verification-regression-scope | 4 / 5 / 4                 | The response identifies different effective bases for prior and current scopes. This is a suspected scope-binding behavior defect, not grounds to accept a blocked result for the seeded progressing regression. Current N=1 probe passes.                                                      |
| fix-verification-resolved         | 4 / 5 / 4                 | The Spec verifier reports that the supplied repair command compares the current manifest with itself. The aggregate correctly blocks the evidence gap, but the requested verification did not complete. Suspected coordinator handoff defect; retain the clear-outcome requirement.             |
| fix-verification-unavailable      | 4 / 5 / 4                 | The report substitutes a generic unavailable-evidence sentence for captured command evidence. The canonical-row requirement is intentional. Compare against the retained check artifact instead of prescribing the helper's diagnostic wording separately.                                      |
| goal-contract-pass                | 4 / 5 / 4                 | Standards did not supply a pass/fail judgment; the review blocked and the completion marker was absent. This is missing reader evidence, not a semantic-grader false negative. The protocol explicitly prescribes the composed next-action text, so its exact check stays.                      |
| invalid-base                      | 5 / 4 / 4                 | Task checks passed but activation recorded no mounted skill read. The retained evidence cannot distinguish missed observation from skipped activation; no historical activation credit is invented.                                                                                             |
| merge-base-branch                 | 5 / 4 / 4                 | Same activation-observation limitation; scope and task checks passed. Keep the implicit-discovery prompt and native read requirement.                                                                                                                                                           |
| presentation-blocked              | 4 / 5 / 4                 | A complete-looking blocked response accompanied missing canonical-artifact evidence. As with empty-diff, the limited retained evidence cannot establish the exact cause. Do not accept final-answer resemblance as artifact proof.                                                              |
| pull-request                      | 4 / 5 / 4                 | Standards omitted a required source and its reader record was invalid. Blocking was the correct aggregation response, but the intended successful PR review was not achieved. Suspected reader-output defect; retain the pass requirement.                                                      |
| spec-only                         | 4 / 4 / 4                 | The response identified the seeded missing Anonymous fallback in ad hoc prose, with no observed activation or canonical review artifact. This is a skill-selection/workflow miss, not a reason to weaken presentation checks.                                                                   |
| worktree-scope                    | 5 / 4 / 4                 | All requested layers passed task checks; activation had no observed skill read. Historical observation is insufficient to assign the failure to the skill or harness.                                                                                                                           |

These suspected behavior defects and observation limits were reported before
implementation. No skill instructions, reader routes, or product mechanics were
changed. Historical artifacts came from earlier plugin versions, while the new
run uses the current checkout. This is a follow-up observation, not a matched
ablation attributing every difference to the eval edits.

## Evaluation changes

The five standalone fix-verification cases now independently render their
validated `verification.tsv` and compare both the sibling `verification.md` and
the final response with that rendering. Previously, a shortened or empty saved
report could pass if the final response matched it. The second-round case
excludes the caller-bound previous verification artifact, so random scope
directory ordering cannot select stale evidence.

The resolved case now compares the attempt status and progress fields exactly.
Its previous whole-line regex also matched an unresolved advisory when evidence
contained the word “resolved.” The unavailable case now requires its blocked
check row to match a captured `darrow-review-check-v1` record in the same scope.
This accepts faithfully captured diagnostic wording while rejecting missing or
reinterpreted evidence. Artifact consistency is not independent proof of actual
command execution.

CR-E13 records these evaluation requirements. Both plugin manifests advance
from 0.3.10 to 0.3.11 because colocated evals are plugin content. Participant
prompts, the 26-case inventory, implicit activation probes, model/effort, and
the 80% threshold are preserved. No baseline failure was converted into a pass.

The old checkpoint format retained final responses but not the canonical TSV,
Markdown, and check files needed to rerun these artifact checks. Full historical
regrading is therefore unavailable. Deterministic calibration instead exercises
real renderer/validator output and explicit counterexamples, including an
unresolved advisory, matching summaries, empty reports, stale artifacts,
alternative captured diagnostics, missing capture, and mismatched capture.
Fresh trials provide forward behavior evidence.

## Verification and matrix

The focused outcome-check suite passed 52 tests. Together with the existing
review-route identity suite, 76 tests passed. All 26 Codex fixtures prepared in
the dry run; dry preparation is not behavioral evidence. Fresh N=1 empty-diff
and repair-regression probes passed task and activation checks.

The skill inspector, native Claude plugin-manifest validator, documentation
checks, Prettier, TypeScript lint/type checking, shell lint, and diff whitespace
checks passed. All four bundled shell suites passed on observed Bash
3.2.57. Bash 5 was unavailable; the version-aware helper reported
`matrix_status=unverified`, so no Bash 5 compatibility result is claimed.

One fresh-context evaluation review found no remaining material issue in the
changed checks or tests. It independently reproduced the baseline pass counts
and identified stale copied performance summaries in the reconstruction; those
fields were removed. Report comparison retains the existing blank-line
normalization and does not prove byte-for-byte whitespace identity.

The full fresh matrix completed on September 12, 2026. All 26 cases meet both
the task and activation acceptance gates. Each case used Codex
`gpt-5.6-terra` / `medium`, N=5, jobs=3, threshold=0.8. Cases executed sequentially;
any case with a failed task or activation trial paused for evidence inspection.
Every original trial is retained; no failed trial was replaced or regraded.

| Metric                | Baseline        | Follow-up       | Change in count |
| --------------------- | --------------- | --------------- | --------------- |
| Task passes           | 122/130 (93.8%) | 123/130 (94.6%) | +1              |
| Activation passes     | 126/130 (96.9%) | 126/130 (96.9%) | 0               |
| Joint passes          | 119/130 (91.5%) | 122/130 (93.8%) | +3              |
| Perfect cases         | 15/26           | 18/26           | +3              |
| Threshold-floor cases | 11/26           | 8/26            | -3              |

The follow-up adds 3 joint passes and 3 perfect cases. 7 original floor cases
are now perfect, while 4 previously perfect cases finish at the floor.
Intermittent workflow, reader-output, and presentation failures remain; the
CLI and plugin-version differences limit causal attribution.

The following per-case counts are task / activation / joint passes out of five.

| Case                                     | Baseline task / activation / joint | Follow-up task / activation / joint |
| ---------------------------------------- | ---------------------------------- | ----------------------------------- |
| both-axes                                | 5 / 5 / 5                          | 5 / 5 / 5                           |
| empty-diff                               | 4 / 5 / 4                          | 4 / 4 / 4                           |
| fix-verification-progress-advisory       | 5 / 5 / 5                          | 5 / 5 / 5                           |
| fix-verification-regression-scope        | 4 / 5 / 4                          | 4 / 4 / 4                           |
| fix-verification-regression-second-round | 5 / 5 / 5                          | 4 / 5 / 4                           |
| fix-verification-resolved                | 4 / 5 / 4                          | 5 / 5 / 5                           |
| fix-verification-unavailable             | 4 / 5 / 4                          | 4 / 5 / 4                           |
| fixed-point                              | 5 / 5 / 5                          | 5 / 4 / 4                           |
| goal-contract-pass                       | 4 / 5 / 4                          | 5 / 5 / 5                           |
| goal-contract-repair-verification        | 5 / 5 / 5                          | 5 / 5 / 5                           |
| invalid-base                             | 5 / 4 / 4                          | 5 / 5 / 5                           |
| low-noise                                | 5 / 5 / 5                          | 5 / 5 / 5                           |
| merge-base-branch                        | 5 / 4 / 4                          | 5 / 5 / 5                           |
| neither-axis                             | 5 / 5 / 5                          | 5 / 5 / 5                           |
| no-trigger-after-edit                    | 5 / 5 / 5                          | 5 / 5 / 5                           |
| presentation-blocked                     | 4 / 5 / 4                          | 4 / 5 / 4                           |
| presentation-default                     | 5 / 5 / 5                          | 4 / 5 / 4                           |
| presentation-machine-v1                  | 5 / 5 / 5                          | 5 / 5 / 5                           |
| pull-request                             | 4 / 5 / 4                          | 5 / 5 / 5                           |
| read-only-adversarial                    | 5 / 5 / 5                          | 5 / 5 / 5                           |
| reviewer-route-override                  | 5 / 5 / 5                          | 5 / 5 / 5                           |
| reviewer-route-unavailable               | 5 / 5 / 5                          | 5 / 5 / 5                           |
| spec-only                                | 4 / 4 / 4                          | 5 / 5 / 5                           |
| standards-only                           | 5 / 5 / 5                          | 5 / 5 / 5                           |
| value-comparison                         | 5 / 5 / 5                          | 4 / 4 / 4                           |
| worktree-scope                           | 5 / 4 / 4                          | 5 / 5 / 5                           |

Per-case results and logs are retained under `evals/results/issue-108/matrix/`.
The combined artifact is `matrix/complete.json`; `comparison.json` and
`comparison-table.md` hold the independently checked totals and case comparison.
The comparison verifies the exact case inventory, five unique executed trials
per case, model/effort/threshold, Boolean activation evidence, and consistency
between check outcomes, trial verdicts, and reported pass rates.
The baseline reconstruction exactly matches every aggregate in issue 108.

Both source paths below are relative to `evals/results/issue-108/`:

- `baseline.json` SHA-256: `8fae57472f3cca9b4a786c2b9b468dcb5f15db4731eb2b1821188e84394b169d`
- `matrix/complete.json` SHA-256: `f46a93f66af9cd1b4db79677bd762d6b6962afa9dfb27f1df505871cce2a1edc`

The final focused regression and route-identity run passed 76 tests with zero
failures; its retained output is `evals/results/issue-108/final-focused-tests.log`.

The follow-up starts from repository commit
`09b61076d225243b6a50963e647a85036bb781de` with the documented eval changes and
plugin version 0.3.11. The native CLI records `codex-cli 0.154.0` in the new
per-case evidence.

The fresh empty-diff case completed at 4/5 for task, activation, and joint pass.
Trial 2 returned only “No uncommitted changes found” without observed skill
activation or canonical review artifacts. This is a confirmed workflow miss;
the checks correctly rejected it. The failure is retained, and the case meets
the original threshold without changing the prompt, skill, or assertions.

Fresh regression-scope trial 1 likewise detected the negative-input regression
in ordinary prose while skipping observed skill activation and the canonical
verification artifact. Its task and activation failures are retained as a
workflow miss; recognizing the defect alone does not satisfy the capability's
independent-verification contract.
The other four trials passed task and activation checks, leaving this case at
4/5 in both dimensions. No trial was replaced after inspecting the failure.

Fresh second-round regression trial 2 loaded the skill and retained an accepted
Standards reader, but that reader's record omitted the required original
finding attempt. The coordinator retained a blocked evidence gap. Activation,
prior-artifact binding, and canonical report checks passed; the clear-outcome
check correctly failed. This is a reader-output defect, not a reason to accept
blocked verification for the fully repaired fixture.
The complete second-round case scored 4/5 task, 5/5 activation, and 4/5 joint
passes, meeting the original acceptance threshold with the failed trial retained.

Fresh unavailable-evidence trial 5 returned a valid canonical blocked report,
but its check evidence explicitly said the required command was not executed.
The generic row did not match captured command evidence, so the revised check
correctly rejected it. This repeats the baseline execution/evidence defect;
the case scored 4/5 task, 5/5 activation, and 4/5 joint passes. The failure is
retained without assertion or skill changes.

Fresh fixed-point trial 2 passed all task checks but failed activation. Native
diagnostics recognized partial skill-read commands and mentioned the mounted
root, but neither bound a read to the mounted skill path nor retained its
complete body. A canonical pass report and accepted Standards reader establish
task completion, not the missing activation observation. The exact cause
remains unassigned. This case scored 5/5 task, 4/5 activation, and 4/5 joint
passes, with the failed activation retained.

Fresh blocked-presentation trial 4 produced a valid canonical terminal artifact
but corrupted the final report's base revision: a commit-SHA prefix was followed
by part of the temporary fixture path. The independently rendered comparison
failed on that base line. This is a presentation defect, not a missing artifact
or a reason to relax report identity. The case scored 4/5 task, 5/5 activation,
and 4/5 joint passes; the failed trial is retained.

Fresh default-presentation trial 2 likewise produced valid canonical TSV but
truncated the worktree target identifier in its final response, dropping the
separator between the commit and snapshot hashes. The independent report
comparison rejected the target line; all other checks passed. This second
presentation defect is retained. The case scored 4/5 task, 5/5 activation, and
4/5 joint passes, meeting the original gate without changing the assertions.

Fresh value-comparison trial 4 identified the `parseInt` trailing-input defect
in ordinary prose but skipped observed skill activation and canonical review
artifacts. The artifact-based defect and false-positive metrics consequently
failed; those failures do not establish that the defect escaped or that an
abstraction false positive was reported. They establish missing required
measurement artifacts. This is a workflow miss, retained at 4/5 task, 4/5
activation, and 4/5 joint passes for the complete case.
