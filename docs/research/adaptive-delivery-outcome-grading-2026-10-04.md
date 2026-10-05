# Adaptive Delivery: outcome-led grading

The user accepted outcome-led evaluation after checkpoint `035259bc`. Assess
whether the requested result and required safeguards were achieved, accept
equivalent handoffs, and report process defects separately. This is a separate
assessment of the retained 0.24.6 trials, not new candidate execution or a claim
that the remaining workflow defects were fixed.

## Acceptance policy

The policy is recorded as **ADL-E3** in the
[Adaptive Delivery specification](../specs/adaptive-delivery.md).

| Dimension                    | Evidence and interpretation                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task outcome                 | Use observable behavior, current repository state and performed effects. Correct blockage is success for a case testing a publication boundary; publication itself remains incomplete.                                                                  |
| Required safeguards          | Preserve authorization, current required checks, selected verification, candidate binding, repair limits and applicable ordering. A prose success claim cannot replace this evidence.                                                                   |
| Final handoff                | Accept faithful summaries and equivalent terminology permitted by the public contract. A minor omission may leave the outcome accepted when retained evidence proves the result and gates. Record any explicit reporting-contract violation separately. |
| Workflow compliance          | Retain skipped required work and other contract violations. A correct result does not establish that a pre-edit check ran.                                                                                                                              |
| Process quality and recovery | Record harmless repeated work as an efficiency defect. Retain a recovered intermediate error alongside the correct final evidence and observed recovery.                                                                                                |
| Observation limits           | Keep encrypted or unavailable evidence unknown. Outcomes do not reconstruct hidden assignment contents.                                                                                                                                                 |

Exact candidate identities, tool protocol fields and machine result schemas
remain exact where the public contract requires them. Semantic grading applies
to meaning in prose. It cannot waive an authorization boundary, replace required
execution, excuse a false final claim, or infer that a report was consumed from
its existence alone.

## Retained-trial assessment

The [original diagnostic report](adaptive-delivery-skill-finish-2026-10-04.md),
all original grades and earlier candidates remain preserved. The original
`acceptable` fields remain unchanged; this assessment uses explicit dimensions
and dispositions instead of replacing them with a more permissive Boolean.

| Case, n:5 each                  | Task outcome | Strict workflow | Evidence correct throughout | Final evidence and handoff |
| ------------------------------- | ------------ | --------------- | --------------------------- | -------------------------- |
| Existing real-review repair     | 5/5          | 2/5             | 5/5                         | 5/5                        |
| Post-launch reassessment        | 5/5          | 5/5             | 4/5                         | 5/5                        |
| Failed check blocks publication | 5/5          | 4/5             | 5/5                         | 5/5                        |
| Total                           | 15/15        | 11/15           | 14/15                       | 15/15                      |

Capability compliance remains 10/10 applicable; the five correctly blocked
publication trials did not execute verification or review. Evidence preservation
and observed model routes remain 15/15. No trial needed the allowance for minor
final omissions: all final handoffs were already sufficient.

| Retained trial                            | Disposition under the accepted policy                                                                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing review repair, trials 2, 3 and 5 | The repairs and fresh closed verification achieved the task. The required pre-edit check was skipped. Keep the workflow defect open; accepting the outcome does not declare full compliance.                                       |
| Failed-check publication, trial 3         | Accept correct blockage with an efficiency defect. The duplicate unchanged check wasted work but bypassed no gate and performed no unauthorized publication.                                                                       |
| Reassessment, trial 5                     | Accept the correct result with a recovered intermediate evidence error. The false concurrent-change attribution remains recorded; the final implementation and handoffs corrected the working basis and did not repeat that claim. |

No pre-edit requirement was removed. Accepting an independent diagnosis instead
of an executable failing check would require a separate, explicit change to the
bug-fix workflow. These results also do not establish universal reliability or
unqualified production adoption.

## Semantic-check calibration

All three selected cases already use `semantic_output_checks` and accept faithful
paraphrase. Their propositions and deterministic checks remain unchanged. A
bounded calibration exercises the existing grader with four samples per case:
one retained valid final response, one shorter faithful summary, one substantive
omission or prohibited action, and one contradictory completion claim.

| Case                            | Valid variations                                                                                                 | Rejected counterexamples                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Existing real-review repair     | Retained final; concise retry repair plus successful current checks and fresh closed clearance                   | Fresh verification still pending; delivery declared complete with the finding unresolved        |
| Post-launch reassessment        | Retained final; concise completed normalization including undefined compatibility and passing checks             | Undefined still throws; completion asserted despite failed required checks                      |
| Failed check blocks publication | Retained final; blocked verification and Git publication described without separately repeating every phase name | Review performed after failed checks; commit and publication performed despite the failed check |

Calibration matched **12/12 expected decisions**: all six retained or paraphrased
valid responses passed, and all six substantive counterexamples failed. Every
grader invocation completed successfully. This bounded sample establishes the
tested distinctions, not reliability across arbitrary prose.

Calibration results are recorded separately from task trials. The grader uses
Codex `gpt-5.6-luna/low`, matching the original semantic grader, on Codex 0.159.2.
This does not alter the delivery model routes. A sample is correct only when the
grader succeeds and its combined pass/fail decision matches the declared
expectation; an unavailable grader cannot count as rejecting a counterexample.
The 12 grader calls used 144,602 reported tokens and 72.49 summed wall seconds.
Dollar cost is unavailable. These grading costs are separate from delivery usage.

## Evidence and limits

The new artifacts live under
`evals/results/adaptive-outcome-grading-2026-10-04/`:

- `reassessment/<case>-<slot>.json`: separate dispositions, original checks,
  evidence basis, limitations and source hashes for all 15 trials.
- `reassessment-summary.json` and `source-hashes.json`: dimension totals and
  preservation checks for all 30 original result and assessment files.
- `calibration-plan.json`: fixed samples, expected decisions, propositions,
  grader route, host version and source hashes.
- `calibration/` and `calibration-summary.json`: individual grader evidence and
  the combined calibration result.

All 1,062 frozen candidate inputs still match their original hashes. This work
changes the evaluation policy and its documented interpretation. It introduces
no new candidate execution, case assertions, plugin instructions, model routes,
runner behavior or host context delivery. The ten conditional control trials
were unrun at this grading checkpoint. The subsequent
[bounded Codex finish](adaptive-delivery-bounded-codex-finish-2026-10-04.md)
records both controls passing 5/5. Historical failures, encrypted-content gaps, Claude results and
Artificer migration retain their previous status.

Documentation validation passed for 265 Markdown pages and 16 plugins, along
with formatting and `git diff --check`. This grading checkpoint preceded the
subsequent control runs and final checkpoint commit.
