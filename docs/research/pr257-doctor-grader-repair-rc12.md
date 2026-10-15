# PR #257: Doctor grader repair on Sevro rc.12

Observed on 2026-10-15 in the `fix/pr257-validation` worktree, after checkpoint
`67f4fcdb`.

The Darrow report-grading defect is repaired. A fresh native Codex trial passes
all five report checks, the read-only check and activation. The case remains
`not_assessed`: its seventh check, absence of orchestration, is unavailable
because Sevro's Code Mode inspection is partial. This is not a fully passing
case.

This note updates the Doctor grading limitation in the
[original rc.12 cohort report](pr257-codex-rc12-validation-2026-10-15.md).
The other cohort cases were not rerun, and their historical results are unchanged.

## Repair

The Doctor Skill and diagnostic backend are unchanged. The eval now checks the
required verbatim records mechanically:

- Checked and used sources identify the same absolute isolated configuration.
- `checkout_config_used` is `no`.
- `concurrency_control` names `agents.max_concurrent_threads_per_session`.
- `nesting_control` retains `agents.max_depth (V1 only; ignored by V2)`.

One small semantic check grades the reported configured concurrency and its
distinction from currently free slots. It rejects a checkout-derived value, a
recommendation without a completed diagnosis, or treating a configured limit as
observed free capacity. It does not require a backend conclusion.

Both plugin manifests advance together to `0.26.7`. The participant prompt is
unchanged; no tool sequence or new output format is imposed.

## Validation

The installed public Sevro interface passes all 12 deterministic record controls:
three valid representations and nine invalid source/control cases. Controls cover
reordered records, Windows absolute paths, missing records, a checkout source,
mismatched checked/used sources, relative paths, checkout use, a missing concurrency
name, nesting substituted for concurrency, and omitted V1-only applicability.

Six retained-output controls behave as expected under the final grading candidate:

| Control                                             | Expected and observed |
| --------------------------------------------------- | --------------------- |
| Original valid native response                      | pass                  |
| Valid response from the first repaired native trial | pass                  |
| Completed diagnosis with an unset setting           | pass                  |
| Value attributed to checkout configuration          | fail                  |
| Recommendation without a diagnosis                  | fail                  |
| Configured limit claimed as currently free slots    | fail                  |

These are grading controls, not new candidate behavior trials.

The final native trial uses published `@bjoernrochel/sevro@0.1.0-rc.12`,
Codex app-server, observed candidate `gpt-6.1-sol/medium`, semantic grader
`gpt-6-luna/medium`, passive N=1, jobs=1, threshold=1 and timeout 1,200,000 ms.
No source override was used.

- Run ID: `1bde0a1d-37da-4d64-b805-0dd2240fdd2c`.
- Task: `not_assessed`; six checks pass and one is unavailable.
- Explicit activation: passed.
- Raw-response SHA-256: `d5c8a980fee90f87ede001d8a63c9dc964eded9164a9d054ba0524cb45b0643c`.

The remaining unavailable check is `darrow.evals.transcript.1`.
Native exec ordinal 27 combines a literal `exec_command` with an
`ALL_TOOLS.filter(...).map(...)` metadata query. Its inspection receipt is
partial, so absence cannot be proved. The successful report checks do not
repair that evidence gap.

Type checking, ESLint, documentation checks and the existing Doctor
negative-evidence controls also pass.

## Retained attempts

Private artifacts remain under `evals/results/pr257-eval-migration/`:

- `rc12-doctor-records-repair-summary.json` binds final checks, route, response
  hash, native-bundle hash, partial ordinals and calibration results.
- `rc12-doctor-records-calibration-v2-summary.json` records all six final
  controls and the exact case-source hash.
- `rc12-doctor-records-repaired-v3-selection.json` records the final native trial.
- `rc12-doctor-records-repaired-v1-selection.json` retains a pre-execution
  refusal: a relative runtime-profile path was rejected. The corrected launch
  uses an absolute path.
- `rc12-doctor-records-repaired-v2-selection.json` retains the first executed
  repair trial. It passed four of six checks but exposed two further grading
  false negatives: optional backend context was treated as mandatory, and
  correctly copied control names were rejected for lacking an extra V2
  explanation. Both responses pass the final grading candidate.
- The earlier calibration candidate remains retained. Before native execution,
  an explicit multiline flag was removed because Sevro adds that flag; a test
  tuple also needed a TypeScript const assertion.

There was one executed native trial per grading candidate. The rejected launch
did not execute a candidate. The final trial followed diagnosed assertion
changes; no unchanged-case retries searched for a green result. N=1 does not
establish reliability, and no native Claude coverage is claimed.

## Reproduce

From the validation checkout, use fresh absolute result and output paths.
The runtime-profile path must also be absolute.

```bash
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN \
  bun evals/runner/run.ts --case doctor-adaptive-goal-direct-codex \
  --harness codex --codex-entrypoint app-server \
  --model gpt-6.1-sol --effort medium --owner-evaluation passive \
  --trials 1 --jobs 1 --threshold 1 \
  --semantic-check-model gpt-6-luna --semantic-check-effort medium \
  --results-root <new-absolute-result-directory> \
  --output <new-absolute-selection-json> \
  -- --codex-timeout-ms 1200000 --retain-host-diagnostics \
  --runtime-config-file "$PWD/evals/sevro-extension/runtime-codex-state.json"
```

Run the durable record controls with:

```bash
bun test --timeout 60000 ./evals/integration/doctor-records.test.ts
```
