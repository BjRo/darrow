# Selected verification lifecycle

Read when assurance is selected. Verification owns the assessment: provider
selection, finding identity, history, the closed follow-up set and assessment
correction. This file covers what the main thread owns: when to assess, whether
another repair is allowed, and when to stop. Selecting independent review alone
still goes through verification; never invoke review directly.

## Assess the current candidate

After implementation and every applicable required check succeeds, invoke the
bound verification skill with the repository, exact candidate/scope/base,
originating objective and every material acceptance criterion, constraints,
successful checks, existing evidence and the review binding. Use a bounded
capability context whose complete result returns to this thread. A returned
review report alone is missing verification evidence.

An explicit assessment-before-change request checks and assesses the unchanged
candidate first. Failed checks need an authorized repair and refreshed evidence,
or a stop before assessment, commit and publication. Running a check does not
prove success.

Await every selected result before editing. Clear requires current successful
checks, sufficient evidence for every material criterion and no unresolved
eligible blocker; a provider pass alone is not enough. Validate that before any
dependent commit or publication. Advisories stay visible and nonblocking.

## Decide whether another repair is allowed

Apply the first matching row. The default maximum is 2 repair attempts in total,
shared across providers and findings; only an explicit finite user or
repository override changes it. Progress never raises the maximum.

Before repair advice or another repair, calculate the remaining allowance with
the bundled read-only helper. Resolve `<plugin-backend>` beside this installed
skill: `<plugin-root>/backend`. Copy counts from the actual contract and history.

```sh
uv run --quiet --no-project "<plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight repair-budget \
  --repairs-used <consumed-count> \
  [--repair-maximum <explicit-finite-override>] \
  [--assessment-used <consumed-count> --assessment-maximum <explicit-limit>]
```

Omit `--repair-maximum` without a finite override. If counts are unknown or the
helper fails, stop rather than guess. `decision: stop` prohibits another repair;
`within_limits` establishes only the arithmetic.

| Current result or limit                                                               | Next action                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete current verification is clear                                                | Stop repairing; unused attempts need not be used.                                                                                                                          |
| Attempts used **greater than or equal to** the maximum, or another limit is exhausted | Stop. Two used out of two allows **zero** more repairs, even with progress or “keep trying” feedback.                                                                      |
| Required evidence is missing or inconclusive, or the latest repair made no progress   | Stop speculative repair. Investigate only within existing authority.                                                                                                       |
| An in-scope, authorized blocker remains, evidence supports action, and budget remains | Make one combined repair, refresh checks and request follow-up. After a prior repair, require provider-observed progress: a resolved original blocker or a narrowed cause. |

Different wording or a speculative edit is not progress. A singular repair
request, the number of findings or early clearance does not change the maximum.

## Repair under one budget

One repair addresses the combined eligible blockers from all selected results.
Send it to the implementor that produced the candidate; only verification starts
with fresh context. Repair only blockers inside the originating scope and
authority; stronger checks of the same behavior are permitted.

After each repair, rerun invalidated checks to success and request follow-up
through the same verification boundary. Pass verification's prior result
references back unchanged; verification decides what history it needs and
blocks if it is missing. A follow-up never resets the budget, and later content
edits invalidate clear evidence.

No progress, blocked or inconclusive evidence, exhausted limits or missing
authority stops repair, completion and remaining publication. Report the
combined conclusion, findings, gaps, consumed attempts and the authorized
maximum. If an assessment itself is wrong, return the concrete error to
verification's correction contract; that neither consumes nor resets attempts.
