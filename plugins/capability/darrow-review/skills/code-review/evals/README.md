# Code-review seeded-defect evaluation

`value-comparison.yaml` uses the case ID `code-review-value-comparison`.
It checks whether Review detects a seeded parser defect, avoids a design
false positive, and retains its canonical result artifacts. Time the human
assessment of one trial's final review and pass the measured minutes explicitly;
do not estimate or backfill them.

```sh
cd evals
bun runner/run.ts --case code-review-value-comparison --harness codex --codex-entrypoint app-server --trials 3 --human-review-minutes <measured-minutes> -- \
  --runtime-config-file "$PWD/sevro-extension/runtime-review-artifacts.json"
bunx --no-install sevro report --json --result-file <candidate-sevro-result.json>
```

The [Review artifact profile](../../../../../../evals/sevro-extension/README.md#runtime-configuration)
retains candidate Review state for grading and permits the required SessionStart
hook. The fixture requires canonical Review artifacts, so it does not establish
a matched without-skill value comparison. Its current checks do not provide an
equivalent oracle for an unstructured review agent.

Use the selection manifest's per-case Sevro result path for reporting. The result
records seeded-defect detection, escaped defects, false-positive count,
input/output tokens, wall-clock time, cost, and the manually measured
human-review minutes. Missing measurements remain unknown. Replace
`--harness codex --codex-entrypoint app-server` with `--harness claude` to assess
that host separately. Compare runs only when their retained routes, trial
counts, and evaluation inputs match; passing this fixture alone does not
establish Review's added value.
