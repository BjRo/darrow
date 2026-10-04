# Adaptive Delivery: bounded skill-only finish

Status: all 15 diagnostic trials are complete. Every case outcome passed. Four
workflow failures and one recovered intermediate evidence error remain recorded.
The two conditional controls were not released because workflow defects recurred.
No further candidate, capability, architecture or runner changes were made.

## Result and recommendation

Keep achieved outcomes as passes, with workflow compliance assessed separately.
I recommend accepting the observed delivery outcomes with the limitations below
documented, and discussing the pre-edit-check requirement before another skill
revision. These results do not support another instruction-delivery experiment.
The optional ten control trials remain available after that discussion, within
the original 25-trial cap. Production adoption remains a separate decision.

| Case                               | Task / intended outcome | Strict workflow | Capability compliance | Evidence correct throughout | Final evidence and response | Preservation / routes |
| ---------------------------------- | ----------------------- | --------------- | --------------------- | --------------------------- | --------------------------- | --------------------- |
| Existing real-review repair        | 5/5                     | 2/5             | 5/5                   | 5/5                         | 5/5                         | 5/5                   |
| Post-launch readiness reassessment | 5/5                     | 5/5             | 5/5                   | 4/5; recovered error        | 5/5                         | 5/5                   |
| Failed check blocks publication    | 5/5                     | 4/5             | Not exercised         | 5/5                         | 5/5                         | 5/5                   |
| Total                              | 15/15                   | 11/15           | 10/10 applicable      | 14/15                       | 15/15                       | 15/15                 |

The last case succeeds by preserving the local edit and withholding review,
commit, push and PR creation after a failed required check. All five delivery
goals correctly remain blocked; none completed publication.

The user allowed minor final-handoff omissions when evidence establishes the
achieved target and required gates. No trial needed that allowance: all final
handoffs were sufficient and accurate. The four workflow failures concern actual
skipped or repeated actions. No raw task failure was overwritten or excused.

## Remaining failures

| Case and trials                 | Failure and ownership                                                                                                                                                      | Outcome and recommendation                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing review repair: 2, 3, 5 | Adaptive Delivery skipped the required focused failing retry check before repair, despite reading the bug-fix workflow. The passing repository script checks only timeout. | Repairs and fresh closed verification succeeded. Retain workflow failures and outcome passes. Discuss whether executable red evidence must remain mandatory for an already independently diagnosed repair before changing that contract. |
| Failed-check publication: 3     | Adaptive Delivery repeated the deterministic check after the implementor had returned exit 7. Content and conditions were unchanged.                                       | All publication gates held; later continuations used retained evidence correctly. Retain a workflow defect with bounded wasted work. No runner or capability change is indicated.                                                        |
| Reassessment: 5                 | The implementor confused concatenated file output and incorrectly claimed a concurrent file change after a patch failed.                                                   | Separate reads corrected its working basis. Implementation and final handoffs were correct. Keep the intermediate evidence failure and recorded recovery; accept the achieved outcome.                                                   |

The first failure violates the
[public bug-fix workflow](../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/references/workflows/fix-bug.md)
and main's responsibility for required pre-edit evidence. This is a skill
execution defect, not an invalid fixture expectation. Passing final checks cannot
establish the skipped earlier check. Trials 1 and 4 did obtain it: in trial 4 the
focused check failed at 09:08:01 UTC, before the edit at 09:08:22 UTC.

In reassessment trial 5, the combined read, rejected patch and separate file read
establish the attribution mistake. No observed concurrent edit explains it. The
false claim stayed in intermediate child commentary; neither final handoff
repeated it. Evidence correctness therefore remains failed for that trial, while
final evidence correctness and outcome achievement pass.

Capability participants also recovered local path, command and serialization
errors before returning valid reports. Those errors remain retained. A broad
search in existing-review trial 2 was denied access to the protected eval
directory; no hidden contents were exposed. No incorrect terminal capability
handoff was accepted in this round.

## What worked and what remains unknown

- All five existing candidates were independently assessed before repair. Each
  used one of two repair attempts, retained the original finding and obtained
  fresh closed verification of the repaired content.
- All reassessment trials preserved the new requirement that
  `normalize(undefined)` return an empty string, reassessed before mutation,
  obtained failing pre-edit evidence and verified final behavior.
- Reassessment trials 3 and 5 resumed the same implementor after main reassessed
  the changed constraint. The other three found it in main before delegation
  and did not exercise reuse.
- Every failed-check trial withheld dependent effects and reached native
  blockage on the third consecutive turn. Four ran the failed command once;
  trial 3 ran it twice.
- All terminal responses preserved repair use and maximum, including blocked
  continuations. No repair allowance was reset or exceeded.
- All main goals stayed under 4,000 characters, with no replacement owner. Every
  observed model route matched the frozen setup.

Workflow reads are visible in the trials that skipped the pre-edit check. These
records do not establish that workflow instructions disappeared from context.
Encrypted assignments cannot distinguish incomplete launch instructions from
implementor drift. Instruction priority and context loss remain unproven causes.
Successful effects do not reveal encrypted message contents retroactively.

Readiness is synthetic here: its results establish invocation and ordering, not
the quality of a production readiness judgment. Claude model adoption and
Artificer migration remain outside this work.

## Separate baseline comparison

The same three cases each had five trials in the frozen 0.24.4 regression.
Its recorded grades remain separate from this candidate.

| Case                            | 0.24.4 task | 0.24.6 task | 0.24.4 strict delivery | 0.24.6 strict delivery |
| ------------------------------- | ----------- | ----------- | ---------------------- | ---------------------- |
| Existing real-review repair     | 5/5         | 5/5         | 0/5                    | 2/5                    |
| Post-launch reassessment        | 5/5         | 5/5         | 2/5                    | 5/5                    |
| Failed check blocks publication | 5/5         | 5/5         | 0/5                    | 4/5                    |
| Total                           | 15/15       | 15/15       | 2/15                   | 11/15                  |

Task success was already 15/15 in the baseline. The observed difference concerns
workflow adherence and final accounting. Evidence correctness throughout is
14/15 in both candidates, with a recovered attribution error in each. These small,
sequential samples do not establish causation or general reliability.

The [previous finish report](adaptive-delivery-codex-finish-2026-10-03.md) preserves
the 92-trial 0.24.4 sweep, separate 0.24.5 fixture repair, historical failures and
attribution gaps. New trials neither replace nor pool with those results.
No Claude result contributes to a Codex improvement claim.

## Frozen setup, scope and cost

The 0.24.6 candidate keeps workflow ownership, evidence reconciliation and repair
accounting in main, reuses an applicable implementor and clarifies pre-edit checks
and unchanged blockers. The selected fixtures, runner, native app-server entrypoint,
review and verification match the preserved snapshot. Developer-context runner
changes were reverted before preparation; no hooks or injection were added.

| Role                                       | Route               |
| ------------------------------------------ | ------------------- |
| Main coordinator                           | `gpt-6-sol/medium`  |
| Routine bounded implementor in these cases | `gpt-6-luna/medium` |
| Verification coordinator                   | `gpt-6-sol/medium`  |
| Review coordinator                         | `gpt-6-luna/medium` |
| Independent review readers                 | `gpt-6-sol/xhigh`   |

Codex 0.159.2, passive owner evaluation and a concurrency limit of five were pinned.
The snapshot kept the `darrow-adaptive-delivery` directory name. Preparation
verified all five selected cases and exact explicit invocation tokens. Trials
ran sequentially in fresh invocations, with every task check required to pass and
each result inspected before the next launch. No instructions or fixtures changed.

| Case                          | Whole-tree tokens | Summed candidate wall seconds |
| ----------------------------- | ----------------- | ----------------------------- |
| Existing review repair, n:5   | 17,524,339        | 3,313.54                      |
| Post-launch reassessment, n:5 | 2,937,730         | 686.33                        |
| Failed-check publication, n:5 | 2,561,222         | 524.46                        |
| Total                         | 23,023,291        | 4,524.33                      |

Usage is complete for all 15 actor trees. Tokens include cached input. Summed
candidate wall time is about 75.4 minutes, excluding manual assessment and grading
overhead. Dollar cost is unavailable. Native goal-reported usage is a different
metric and does not replace whole-tree usage.

The conditional `goal-steering-without-question` and
`goal-review-routine-omitted` cases remain unrun for this candidate. This completes
the diagnostic stage, not a full new regression sweep.

## Evidence and validation

Raw evidence lives under `evals/results/adaptive-skill-finish-2026-10-04/`:

- `inputs.json`: 1,062 frozen input hashes.
- `invocation-validation.json` and `validation.json`: five-case preparation.
- `trials/<case>/<slot>/`: original results, public transcripts, analysis and
  assessments, including every failed dimension.
- `round-summary.json`: separate totals and residual failures for these 15 trials.

One bounded fresh-context audit reviewed the skill, specification, host guides,
lifecycle/workflow references, five cases, manifests and first two assessments.
It found no new material contradiction, authority defect or invalid outcome
expectation and confirmed separate outcome/workflow grading. It ran no target
actions or live evals and made no edits.

The earlier passing skill inspector and static checks were reused. Final gates
passed: report formatting, documentation validation (264 Markdown pages and 16
plugins), all 1,062 frozen input hashes, and `git diff --check`.
`finish-integrity.json` records all 15 jobs complete and controls unreleased.
No commit or push was performed.
