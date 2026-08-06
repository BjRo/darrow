# Goal Loop comparison matrix

The goal loop's default route is retained only when its measured defect reduction
justifies its incremental token and latency cost. Run every condition with the
same case filter, harness, model, effort, trial count, threshold, and recorded
human-review minutes.

For the native goal loop candidate, run the colocated cases normally. For
the direct strong-agent, single-goal-worker, and headless-supervisor baselines,
run the same cases with `--without-skill` and the corresponding condition file
in this directory. `--without-skill` deliberately omits orchestration-specific output
contract checks while retaining all repository outcome and quality-oracle
checks. The conditions emit neutral invocation and interruption records so the
runner can aggregate the same metrics for every design.

Compare each baseline result with the candidate using
`bun evals/runner/compare.ts BASELINE.json CANDIDATE.json`. Comparison rejects
runs whose harness, model, effort, case set, or trial count differs. Do not make
a fixed autonomy or cost claim from dry runs or a single task class.
