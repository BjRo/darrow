# Native-goal preflight calibration

Status: exploratory evidence, not an accepted architecture decision  
Run date: 2026-08-07  
Scope: one Codex trial per task on the four established OSS tasks

## Outcome

The native-goal preflight redesign removes the retired Darrow controller's
quality regression and most of its latency, but this run does not demonstrate
incremental value over raw native goal or vanilla.

- All four task contracts and all four protocol contracts passed.
- The condition-blind judge accepted all four results with a 4.75 mean score.
- Every goal launched in the current Codex thread with the pinned historical
  route, zero Darrow children, and zero human interruptions.
- Mean wall time fell from 702.5 seconds for the retired controller to 266.1
  seconds, a 62% reduction. Task pass improved from 75% to 100%.
- Against raw native goal, quality was tied while preflight was 19% slower and
  used 24% more tokens.
- Against vanilla, quality was tied while preflight was 23% slower and used 45%
  more tokens.

At N=1, the redesign is a successful simplification rather than a demonstrated
product advantage. Keep it exploratory until repeated trials or a routing
ablation shows that its template/model selection changes the quality-cost
frontier.

## Aggregate comparison

| Codex condition                 | Task pass | Judge score | Wall mean | Tokens mean | Darrow children |
| ------------------------------- | --------- | ----------- | --------- | ----------- | --------------- |
| ------------------------------- | --------: | ----------: | --------: | ----------: | --------------: |
| vanilla, historical             | 100%      | 4.75        | 216.5s    | 649756      | 0.0             |
| native goal, historical         | 100%      | 4.75        | 223.0s    | 759672      | 0.0             |
| native-goal preflight           | 100%      | 4.75        | 266.1s    | 939926      | 0.0             |
| retired Darrow child controller | 75%       | 3.75        | 702.5s    | 924361      | 2.0             |

Historical values come from the
[original N=1 snapshot](2026-08-07-n1.md). Candidate model, effort, task corpus,
and judge configuration were held fixed for the new Codex cell.

## Current per-task evidence

| Case                                | Task / protocol | Judge | Wall time | Candidate tokens | Launch boundary |
| ----------------------------------- | --------------- | ----- | --------- | ---------------- | --------------- |
| ----------------------------------- | --------------: | ----: | --------: | ---------------: | --------------- |
| orchestration-oss-ajv-instance-path | pass / pass     | 5/5   | 403.6s    | 1407967          | same thread     |
| orchestration-oss-click-streams     | pass / pass     | 5/5   | 217.2s    | 885310           | same thread     |
| orchestration-oss-express-links     | pass / pass     | 4/5   | 178.7s    | 379686           | same thread     |
| orchestration-oss-go-git-insteadof  | pass / pass     | 5/5   | 265.0s    | 1086741          | same thread     |

The Click task is the most important qualitative correction: both instances of
the retired Darrow controller failed its hidden stream-interleaving contract,
while native-goal preflight passed it.

## Claude capability finding

Claude was not included in the quality comparison. A focused launch probe found
no same-thread goal-control tool on the evaluated Claude surface. A recursively
launched Claude CLI then stopped as unauthenticated even though the parent
session was authenticated. That makes an in-session nested fallback an invalid
boundary, not a failed implementation attempt.

The current skill therefore stops as `launch_required` on Claude unless the
surface exposes same-thread native goal control. A future Claude comparison
requires either that surface or an authenticated enclosing launcher that runs
preflight before starting the goal session.

## Provenance

| Item                 | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| -------------------  | -----                                                              |
| Candidate            | Codex `gpt-5.5`, medium, `codex-cli 0.145.0`                       |
| Blind judge          | Codex adapter default model, low effort, condition-blind           |
| Order seed           | `native-preflight-codex-n1-20260807`                               |
| Runner revision      | `04a9ee73406dbfbed9e250b0b5e16fc80eb53a06`                         |
| Runner patch SHA-256 | `8747ad8e9f615257c0eb19f09edda6d78e764fa726ebcb2d4d6d7d21866ddc8d` |
| Raw result SHA-256   | `5149569d375435be9222198f3df86ea7c377eb4043a9d7aee67e4b6264df15fc` |
| Raw manifest SHA-256 | `054be4f3bdf92c58c3aaacdf4af9047b5038b16d052ae967d8b1dc32e1165ff7` |
| Raw report SHA-256   | `a0a7f01df708eef9ddb37fa19070b10b4e518f1cca54b6d7b1931999edb03ca7` |

The raw bundle remains gitignored under
`evals/results/orchestration-value/native-preflight-codex-n1-20260807/`. The
hashes above make later local verification tamper-evident; the structured
[JSON snapshot](2026-08-07-native-preflight-codex-n1.json) preserves the
aggregate and task-level values for future agent runs.

## Execution-log audit

The snapshot was verified against all four raw candidate streams and all four
raw judge streams. Each stream's terminal agent message and input/output usage
matched the runner record. The judge's terminal JSON score matched its parsed
assessment. Every candidate stream contained one thread start and one completed
turn, and every final launch record named the pinned route, `same_thread`
boundary, zero child invocations, and zero human interruptions. The task and
aggregate values, historical comparison, runner provenance, and artifact hashes
also matched their source records.

## Limits and next comparison

- One trial cannot establish a durable default.
- The route was deliberately pinned to isolate goal framing and controller
  removal; this run does not test adaptive model selection.
- Service-time variance and model nondeterminism remain confounders.
- Claude currently has no valid in-session programmatic launch boundary.
- The next decision-bearing evaluation should use at least three Codex trials
  per cell for vanilla, raw native goal, and native-goal preflight. If routing
  is the proposed value, add a separate fixed-route versus adaptive-route
  ablation rather than mixing both hypotheses.
