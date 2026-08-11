# Implementation-readiness comparison

Run the readiness cases against an unchanged host and the candidate skill with
the same harness, model, effort, fixtures, prompts, checks, and trial count:

```sh
cd evals
bun runner/run.ts --case readiness- --harness codex --trials 3 --without-skill
bun runner/run.ts --case readiness- --harness codex --trials 3
bun runner/compare.ts <baseline-result.json> <candidate-result.json>
```

Repeat the pair with `--harness claude`. Report trial count, verdict accuracy,
false-ready and false-not-ready cases, tokens, wall time, and limitations. The
current shared runner records ordinary pass/fail, token, cost, and wall-time
metrics; classify verdict errors from the per-case checks until dedicated
readiness metrics are added. Do not compare unmatched routes or trial counts.
