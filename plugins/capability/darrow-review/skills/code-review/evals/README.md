# Code-review value comparison

`value-comparison.yaml` is the paired comparison case for CR-E8. Run the same
harness, model, effort, and trial count first without the skill (one
unstructured review agent) and then with it. Time the human assessment of one
trial's final review and pass the measured minutes explicitly; do not estimate
or backfill them.

```sh
cd evals
bun runner/run.ts --case code-review-value-comparison --harness codex --trials 3 --without-skill --human-review-minutes <measured-minutes>
bun runner/run.ts --case code-review-value-comparison --harness codex --trials 3 --human-review-minutes <measured-minutes>
bunx --no-install sevro report --json --result-file <baseline-sevro-result.json> --result-file <candidate-sevro-result.json>
```

Use each selection manifest's per-case Sevro result path for reporting. Compare
the paired checks and metrics only when their retained routes, trial counts,
and evaluation inputs match. The result pair records seeded-defect detection, escaped defects,
false-positive count, input/output tokens, wall-clock time, cost, and the
manually measured human-review minutes. Repeat the pair with `--harness claude`
for the cross-harness comparison.
