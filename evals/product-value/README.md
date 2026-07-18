# Product-value evaluation

This suite implements the product gate in `PV-1`–`PV-16`. It is separate from
the colocated skill eval runner because it compares treatments and generalizes
over real tasks.

## Safe workflow

Preregistration must remain frozen before confirmatory work. Start with the
deterministic checks and inspect the generated schedule:

```sh
bun evals/product-value/cli.ts install-toolchain
bun evals/product-value/cli.ts preflight \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
bun evals/product-value/cli.ts schedule --phase pilot > /tmp/pilot-schedule.yaml
```

Run the six-task pilot first. Source checkouts are read-only inputs; every trial
uses a disposable history-free archive.

```sh
bun evals/product-value/cli.ts run --phase pilot \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
```

One task/treatment can be used for an operational smoke test. Existing
observation files are durable checkpoints and are not rerun:

```sh
bun evals/product-value/cli.ts run --phase pilot \
  --task mynab-flags-now --harness codex --treatment native \
  --source mynab=../mynab --source credfolio2=../credfolio2
```

After the pilot procedure is accepted, execute the frozen holdout and analyze:

```sh
bun evals/product-value/cli.ts run --phase confirmatory \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
bun evals/product-value/cli.ts blind --phase confirmatory
# Grade the randomized files under results/blind/bundles, then fill grades.jsonl.
bun evals/product-value/cli.ts import-grades \
  --grades evals/product-value/results/blind/grades.jsonl
bun evals/product-value/cli.ts analyze --phase confirmatory
```

Results default to `evals/product-value/results/` and are ignored by Git. Each
run contains an immutable observation, raw harness output, and the participant
patch. Do not publish raw patches or output without reviewing them for secrets.
Completed disposable workspaces are removed. Failed or waiting trials retain
their isolated workspace path in the observation so an operator can inspect the
failure or exercise recovery before recording annotations; they are never
silently replaced by a fresh trial.

## Human attention

The runner records automatic waits and failures. When an operator intervenes,
the observation must be updated through the grading/annotation workflow before
analysis with active attention minutes, intervention type, retries, recovery,
and rework. Wall-clock waiting is not human attention. Agent or Darrow failures
must never be converted into exclusions.

Import one JSON object per affected run after timing the intervention:

```json
{
  "runId": "...",
  "humanAttentionMinutes": 3.5,
  "interventions": 1,
  "retries": 1,
  "recovered": true,
  "reworkCount": 0,
  "note": "continued after reviewing the failed check"
}
```

```sh
bun evals/product-value/cli.ts import-annotations \
  --annotations evals/product-value/results/annotations.jsonl
```

## Confirmatory discipline

- Do not edit `protocol.yaml`, `corpus.yaml`, rubrics, analysis code, or
  thresholds after opening the holdout.
- Confirmatory execution refuses uncommitted evaluator/specification changes;
  the commit hash is part of every observation.
- Do not pool runs across harness/model/effort/version changes.
- Do not treat two repeats as two tasks.
- Preserve failed and waiting observations.
- Report pilot results separately; they are never included in the final gate.
