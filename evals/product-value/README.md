# Product-value evaluation

This suite implements the product gate in `PV-1`–`PV-17`. It is separate from
the colocated skill eval runner because it compares treatments and generalizes
over real tasks.

## Safe workflow

Preregistration must remain frozen before confirmatory work. Start with the
deterministic checks and inspect the bounded six-run smoke schedule:

Claude headless evaluation requires `ANTHROPIC_API_KEY` or a dedicated
`CLAUDE_CODE_OAUTH_TOKEN`. Generate the latter interactively with
`claude setup-token`, then provide it to the evaluation shell through your
normal secret-management mechanism. Do not reuse or copy Claude's rotating
interactive-login credential.

```sh
bun evals/product-value/cli.ts install-toolchain
bun evals/product-value/cli.ts preflight \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
bun evals/product-value/cli.ts schedule --phase smoke > /tmp/smoke-schedule.yaml
```

Run the infrastructure smoke first. It executes `mynab-flags-now` once across
both harnesses and all three treatments at medium effort, with a 15-minute
deadline per observation. Source checkouts are read-only inputs; every trial
uses a disposable history-free archive. Its frozen dependency setup is shared
by every treatment; the CLI attaches that prepared checkout rather than
allocating an unprepared second worktree.
Claude direct and CLI cells resolve through the same evaluator-owned bounded
tool and no-session-persistence launcher, with Claude's temporary state pinned
inside the disposable run root. Every CLI cell stops its evaluator-started
Darrow runtime processes afterward; failed workspaces remain available for
diagnosis, with provider usage recovered from their transcript.

```sh
bun evals/product-value/cli.ts run --phase smoke \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
```

Existing observation files are durable checkpoints and are not rerun. A single
smoke cell can be selected while diagnosing evaluator infrastructure:

```sh
bun evals/product-value/cli.ts run --phase smoke \
  --harness codex --treatment native \
  --source mynab=../mynab --source credfolio2=../credfolio2
```

Smoke results are operational evidence, not product evidence. Inspect all six
observations for completion, tokens, cost, and wall time before starting the
36-run, one-repeat calibration pilot:

If the smoke shows that CLI and direct treatments used materially different
delivery policies, run the excluded Codex-only matched-policy diagnostic before
spending on Claude or pilot work:

```sh
bun evals/product-value/cli.ts diagnose-policy --phase smoke \
  --results evals/product-value/results/policy-diagnostic-v1 \
  --source mynab=../mynab
```

This runs fresh `native` and `plugins` controls plus the evaluator-only
`native-matched-policy` and `plugins-matched-policy` cells. Both auxiliary cells
receive the same evaluator-owned behavioral TDD instructions, with no helper or
output protocol. They never enter the three-treatment schedule or product
analysis. Use the matched direct pairs to estimate instruction-policy cost.
Compare a matched-policy result with the excluded CLI smoke only when both cells
complete successfully.

```sh
bun evals/product-value/cli.ts schedule --phase pilot > /tmp/pilot-schedule.yaml
bun evals/product-value/cli.ts run --phase pilot \
  --source mynab=../mynab \
  --source credfolio2=../credfolio2
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
run contains an immutable observation, raw harness output, a participant patch,
and a compact `trace.json`. The trace retains timings, event counts, and token
accounting plus categorized command/nonzero counts without commands, paths,
model text, or tool output. Participant patches exclude evaluator-owned Darrow
state. Do not publish raw patches or output without reviewing them for secrets.
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
