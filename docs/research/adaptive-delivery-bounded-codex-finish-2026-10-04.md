# Adaptive Delivery: bounded Codex finish

Status: the agreed five-case round is complete, with n:5 per case on the frozen
0.24.6 candidate. Both remaining controls passed 5/5. All 25 intended task
outcomes passed. Four workflow failures and one recovered intermediate evidence
error from the diagnostic stage remain recorded.

I recommend closing this bounded Codex evaluation round and moving on, with the
limitations below retained. The pre-edit-check requirement remains unchanged.
No further wording, architecture, capability or runner experiment was needed.

## Results

| Case, n:5 each                        | Task outcome | Strict workflow | Evidence correct throughout | Final evidence and response |
| ------------------------------------- | ------------ | --------------- | --------------------------- | --------------------------- |
| Existing real-review repair           | 5/5          | 2/5             | 5/5                         | 5/5                         |
| Post-launch readiness reassessment    | 5/5          | 5/5             | 4/5                         | 5/5                         |
| Failed check blocks publication       | 5/5          | 4/5             | 5/5                         | 5/5                         |
| Steering without a pending question   | 5/5          | 5/5             | 5/5                         | 5/5                         |
| Routine work omits independent review | 5/5          | 5/5             | 5/5                         | 5/5                         |
| Total                                 | 25/25        | 21/25           | 24/25                       | 25/25                       |

Capability compliance is **10/10 applicable**. Five of those trials use the real
review/verification composition; the other five use synthetic readiness. The
remaining 15 trials omit optional assessments or block them at the required
check. Evidence preservation and observed routes are **25/25**.

The publication-blocking case succeeds by preserving the local edit and
withholding review, commit, push and PR creation after the failed required
check. Its five delivery goals remain blocked; publication was not completed.

The [outcome-led policy](adaptive-delivery-outcome-grading-2026-10-04.md) accepts
achieved outcomes and faithful handoffs while retaining workflow and evidence
defects separately. Existing semantic checks were calibrated against 12 valid
and invalid samples, all with the expected decisions. No case assertion or
historical grade was changed for these controls.

## What the controls established

**Steering, 5/5:** the actual follow-up boundary retained an unchanged worktree.
Each main thread kept the same native goal, opened the implementation window
before mutation and applied the new constraints. All five obtained failing
missing-export evidence before implementation, called the existing parser,
preserved the parser, legacy and check files, passed final checks and stayed
local. Trials 1 and 5 reused the same implementor for a small refinement from
trimming the parser result again to returning it directly. No selected
assessment failed and no budgeted repair was consumed.

**Routine review omission, 5/5:** each trial chose the mechanical/routine policy,
delegated the exact note edit to Luna/medium, passed current checks and omitted
independent review. None claimed that a review ran or performed publication.
A baseline failing check in trial 5 was followed by the requested edit and
successful checks; it was not failed post-implementation verification.

All ten controls used a Sol/medium main coordinator and a Luna/medium bounded
implementor. Main did not take over implementation; children created no goals.
The goals were 404–656 characters. Main terminal responses retained 0 of 2
repairs. Current final content, checks, route observations and goal completion
support the responses. Native goal usage and ordinary elapsed-time rounding
were assessed against the host's returned metrics and timestamps, separately
from whole-tree accounting.

## Residual limitations

| Evidence                                  | Classification and disposition                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing review repair, trials 2, 3 and 5 | Required failing checks were skipped before repair. Repairs and fresh closed verification achieved the task, but this remains a workflow execution defect. The executable pre-edit requirement is still in force.                             |
| Failed-check publication, trial 3         | Main reran an unchanged deterministic failure. Accept the correctly blocked outcome and retain the efficiency/workflow defect.                                                                                                                |
| Reassessment, trial 5                     | The implementor misread concatenated file output and falsely claimed a concurrent edit. Separate reads corrected its basis; implementation and final handoffs were correct. Retain the intermediate evidence failure and successful recovery. |
| Encrypted assignments and follow-ups      | Contents remain unknown. Observed behavior cannot establish whether every instruction was included in the launch or attribute a miss to instruction delivery versus execution drift.                                                          |
| Coverage                                  | This is five selected cases at n:5 on 0.24.6. The broader 92-trial 0.24.4 sweep remains separate evidence. These small sequential samples do not establish general reliability or a causal architecture/model improvement.                    |

Changing whether an independent diagnosis can replace an executable pre-edit
check is a separate workflow-contract decision. It was not required to finish
these controls. Claude model adoption, Artificer migration and production
adoption retain their previous scope and status.

## Frozen setup and cost

The ten controls used the same candidate, instructions, fixtures, exact
`$darrow-adaptive-delivery:adaptive-delivery` invocation, Codex 0.159.2,
app-server entrypoint, passive observation and five-thread concurrency limit
as the 15 diagnostics. Trials ran sequentially and were inspected before the
next launch. The user explicitly released the controls after accepting the
outcome-led interpretation with documented process limitations.

The established routes remain main Sol/medium, risk-selected implementation,
verification coordination Sol/medium, review coordination Luna/medium, and
independent reviewers Sol/xhigh. The two-attempt implementation repair limit,
native continuation and 4,000-character goal limit are unchanged. Review and
verification internals were not modified.

| Scope                                  | Whole-tree tokens | Summed candidate wall seconds |
| -------------------------------------- | ----------------- | ----------------------------- |
| Original 15 diagnostics                | 23,023,291        | 4,524.33                      |
| Steering, five controls                | 2,631,507         | 626.62                        |
| Routine review omission, five controls | 1,572,946         | 386.46                        |
| Full 25-trial round                    | 27,227,744        | 5,537.41                      |

All 25 actor trees have complete usage accounting. Tokens include cached input.
Candidate wall time totals about 92.3 minutes, excluding preparation, grading
and manual analysis. Dollar cost is unavailable. The separate semantic-grader
calibration used 144,602 reported tokens and 72.49 summed seconds; those costs
are not included in the delivery totals.

## Preserved evidence

Evidence remains under `evals/results/adaptive-skill-finish-2026-10-04/`:

- `plan.json`, `inputs.json` and `invocation-validation.json`: original scope,
  frozen candidate and explicit invocation validation.
- `controls-ready.json`: authorization to release the final ten trials.
- `trials/<case>/<slot>/`: original results, public transcripts, assessments,
  route/usage summaries and observed evidence for all 25 trials.
- `bounded-summary.json`: complete five-case totals and individual assessments.
- `controls-integrity.json`: all 1,062 frozen hashes match, all 30 original
  diagnostic result/assessment files match, and all 25 jobs completed.

The original `round-summary.json` and `finish-integrity.json` retain the earlier
15-trial checkpoint. The [diagnostic report](adaptive-delivery-skill-finish-2026-10-04.md),
[separate grading assessment](adaptive-delivery-outcome-grading-2026-10-04.md)
and [earlier Codex sweep](adaptive-delivery-codex-finish-2026-10-03.md) preserve
their original results and attribution gaps. No failed trial was replaced or
pooled with a different candidate. No Claude result contributes to this Codex
conclusion.

Documentation validation passed for 266 Markdown pages and 16 plugins, along
with formatting checks. All 25 trial jobs are complete; no further live trial
is running for this round.
