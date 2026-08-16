# Review convergence comparison for issue 32

Date: 2026-08-16

This report compares the issue-32 candidate with the released behavior at
commit `84f5c3ee7812ce303ee0ac5b625b458771bae8a9`. The claim under test is narrow:
one comprehensive review followed by exact-target fix verification and
progress-bounded convergence is more reliable than the prior review contract.

## Method

- Harness: Codex CLI 0.147.0
- Model and effort: `gpt-5.6-terra`, `medium`
- Trials: one trial per case and condition
- Control: detached worktree at the commit above
- Candidate: issue-32 working tree
- Matching: each control cell used the candidate case YAML and deterministic
  fixture helper through hard links. Prompt, fixture, checks, harness, model,
  effort, and trial count were therefore identical. Only the released
  adaptive-goal skill/adapter or the issue-32 candidate differed.
- Digest gate: every reported control/candidate pair has the same
  `evaluationDigest`. All five protocol pairs and all six goal-loop pairs pass
  this equality check.
- Cost and human-review time: unavailable

Both controls ran from the detached released revision with the final matched
case and fixture files. Gitignored raw runner results are in
`evals/results/issue-32-*.json` in the development checkout.

## Task results

| Surface                                  |   Control |  Candidate |   Delta |
| ---------------------------------------- | --------: | ---------: | ------: |
| Fix-verification protocol                |  0/5 (0%) | 5/5 (100%) | +100 pp |
| Goal-loop convergence                    | 4/6 (67%) | 6/6 (100%) |  +33 pp |
| Expected terminal runs settled `blocked` | 3/4 (75%) | 4/4 (100%) |  +25 pp |

The five protocol cases cover a fully resolved repair, a materially progressing
blocker with non-gating advisory residue, a direct repair-caused regression
with an unrelated observation excluded, that regression's second verification
round with stable identity, and unavailable required evidence. The six goal
cases cover all-eligible first rework, an explicit two-invocation hard cap,
unchanged evidence, a known oscillating repair, a repair-caused regression that
needs a second repair cycle, and unavailable fix verification after repair.

## Review work and convergence

| Goal case                | Control invocations / repair cycles | Candidate invocations / repair cycles | Candidate outcome                                 |
| ------------------------ | ----------------------------------: | ------------------------------------: | ------------------------------------------------- |
| Progress convergence     |                               0 / 0 |                                 2 / 1 | `clear`                                           |
| Explicit limit           |                               0 / 0 |                                 2 / 1 | hard-cap stop, goal `blocked`                     |
| No progress              |                               2 / 1 |                                 2 / 1 | `no_progress`, goal `blocked`                     |
| Oscillation              |                               2 / 1 |                                 2 / 1 | known oscillating repair rejected, goal `blocked` |
| Repair-caused regression |                               3 / 2 |                                 3 / 2 | `clear`                                           |
| Verification unavailable |                               2 / 1 |                                 2 / 1 | unavailable evidence, goal `blocked`              |
| **Total**                |                           **9 / 5** |                            **13 / 7** | —                                                 |

Every executed candidate sequence used one comprehensive invocation followed by
fix-verification invocations; repeated comprehensive review count was zero. The
two zero-invocation control cells failed in preflight, so their lower work count
is not an efficiency win. The oscillation candidate stopped before performing
the known state-reverting repair and avoided a redundant third verification.

## Tokens and wall time

| Case                           | Control tokens / seconds | Candidate tokens / seconds |
| ------------------------------ | -----------------------: | -------------------------: |
| Protocol: progress + advisory  |            83,629 / 34.6 |            363,080 / 113.1 |
| Protocol: regression scope     |            90,410 / 39.4 |            413,380 / 129.1 |
| Protocol: regression round two |           203,188 / 73.2 |            392,603 / 152.2 |
| Protocol: resolved             |            66,466 / 26.4 |            412,661 / 151.3 |
| Protocol: unavailable evidence |           124,359 / 57.3 |            331,058 / 121.3 |
| Goal: progress convergence     |       unavailable / 34.0 |            639,584 / 125.6 |
| Goal: explicit limit           |       unavailable / 25.2 |            452,773 / 101.7 |
| Goal: no progress              |          585,800 / 119.6 |            646,726 / 136.3 |
| Goal: oscillation              |        1,134,466 / 205.6 |            682,293 / 202.2 |
| Goal: repair-caused regression |          569,730 / 132.3 |            792,721 / 149.2 |
| Goal: verification unavailable |          612,654 / 131.8 |            662,102 / 152.5 |

Failed control preflights are reported as unavailable rather than zero-token
executions because the runner did not retain complete usage for those failures.
The candidate's correctness improvement does not establish an overall token or
latency improvement. It materially reduced tokens only in the goal oscillation
cell; several candidate cells cost more because they actually entered and
completed the required workflow.

## Quality observations

- Escaped defects were zero in every executed goal cell.
- False-positive verifier findings were zero in every executed goal cell.
- The candidate regression-scope protocol case preserved the unrelated
  observation outside the closed convergence set.
- The candidate terminal cases performed no repository work after the terminal
  review evidence and settled the native goal as `blocked`, never `complete`.
- The explicit numeric limit was enforced only when supplied by the originating
  request; progress-bounded cases carried no implicit numeric cap.
- The second-round protocol cell checksum-linked the prior verification,
  preserved the regression key and causal fields, carried target history, and
  resolved that regression without a comprehensive rereview.
- Unavailable fix verification blocked both goal conditions after repair and
  prevented publication or a false completion claim.

## Evidence decision

Issue 32 accepts this N=1 matrix as representative implementation evidence
because every reported pair is digest-matched and the stochastic runs are
backed by deterministic schema, lifecycle, portability, and adapter tests. The
decision is to ship the protocol behavior, not to claim a statistically stable
reliability, token, or latency improvement.

Before using these results for a promotion decision or performance claim, run
at least three trials per final cell on both Codex and Claude Code, retain cost
and human-review-minute data, and report confidence or variance rather than a
single pass rate.

## Limitations

This is representative live evidence, not a statistical estimate. Each cell
has one trial, only Codex was exercised, and model behavior is stochastic. Some
intermediate candidate runs exposed transport-newline, assertion-order,
structured-output-schema, and report-copy defects; the table uses the final
matched assertions and passing candidate trials after those defects were
corrected. Candidate result files come from several final per-case runs rather
than one atomic suite run. Cost and human-review time were unavailable.

A later atomic six-case candidate rerun passed four cells and completed the
intended underlying workflow in the other two, but their final prose missed
narrow presentation regexes. A subsequent regression-cell retry genuinely
stopped at `no_progress` instead of performing the second repair. Those runs are
not substituted into the matched N=1 table; they reinforce that the table is
representative evidence for the implemented contract, not a reliability-rate
estimate.
