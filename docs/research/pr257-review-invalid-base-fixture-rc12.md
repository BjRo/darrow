# PR #257: Invalid-base review fixture on Sevro rc.12

Observed on 2026-10-15 in the `fix/pr257-validation` worktree, after checkpoint
`a0e0dc3a`.

The repaired `code-review-invalid-base` eval passes all seven task checks and
implicit Skill activation on native Codex. The earlier missing-artifact failure
was consistent with a conflicting participant instruction: the prompt prohibited
all file changes while requiring private blocked-review artifacts.

## Repair

The participant prompt now prohibits modifying repository files and explicitly
requests the required blocked-review artifacts in the configured private Review
state directory. It still requires the exact `release/does-not-exist` base and
preserves the configured state and cache paths.

Fixture setup and every acceptance check are unchanged. The Skill, references,
and backend are unchanged. Existing CR-C2 and CR-C22 already require private
terminal artifacts while preserving the repository. Both Review plugin manifests
advance from `0.11.8` to `0.11.9`.

## Observed result

Published package `@bjoernrochel/sevro@0.1.0-rc.12`, with source overrides
cleared. Native Codex app-server, observed candidate `gpt-6.1-sol/medium` and
semantic grader `gpt-6-luna/medium`, passive N=1, jobs=1, threshold=1, timeout
1,200,000 ms and retained diagnostics. The existing private Review artifact
runtime profile is unchanged.

- Run ID: `3e711f1e-f6ba-4100-b871-90bb2e4d6e43`.
- Task: passed, 7/7 checks.
- Activation: passed, from complete host observation.
- Reviewer absence: passed, from complete native tool labels.
- Raw-response SHA-256: `2fc4f90f1dfe7f97d1ef7c58d9809169d476a35fb25a315f9b03e1d1f41aa0a3`.
- Native bundle SHA-256: `2712416a2e7021b3b690ac99e2939800ba6d8cca41d31ab1f79a108da51f1e1c`.

The unchanged checks verify a human response without machine JSON, unchanged
worktree status, valid retained canonical JSON, the exact invalid base and
blocked outcome with empty changes/findings, matching rendered Markdown, a
clear explanation and next action, and no reviewer invocation.

The candidate rejected the exact base, allocated a private terminal review run,
and retained `scope.json`, `result.json`, and `review.md`. It recovered within
the same trial from a shell here-document temporary-file denial by using
`python3 -c`, then corrected an initially empty `standards_sources` field after
validator rejection. The final validation and rendering succeeded. Native
output also contains denied xcrun cache-write warnings; these did not prevent
the successful writes or validation. These intermediate diagnostics remain in
the retained trace rather than being discarded by a rerun.

The original failing rc.12 attempt remains retained. This is one trial after a
diagnosed prompt change, with no unchanged-case resampling. It supports resolving
this fixture failure; it does not establish reliability or reverify the full
cohort. Native Claude was not tested.

## Evidence and checks

Private evidence remains under `evals/results/pr257-eval-migration/`:

- `rc12-review-invalid-base-prompt-repaired-v1-selection.json` points to the
  original trial and native transcript bundle.
- `rc12-review-invalid-base-prompt-delta.json` records the exact prompt change
  and confirms that all other parsed case data is unchanged.
- `rc12-review-invalid-base-prompt-repair-summary.json` binds the case, raw
  response, and verified native bundle member hashes to the observed route,
  checks, activation, and intermediate diagnostics.

Documentation, formatting, and whitespace checks pass. No Python source, tests,
package metadata, or locks changed.

The [eval development guidance](../eval-development.md) calls for a bounded
fresh-context review after stabilization. That review remains pending in the
main conversation because this side conversation prohibits subagent use.

## Reproduce

From the validation checkout, select fresh absolute output paths and supply
the absolute path to the existing runtime profile:

```bash
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN \
  bun evals/runner/run.ts --case code-review-invalid-base \
  --harness codex --codex-entrypoint app-server \
  --model gpt-6.1-sol --effort medium --owner-evaluation passive \
  --trials 1 --jobs 1 --threshold 1 \
  --semantic-check-model gpt-6-luna --semantic-check-effort medium \
  --results-root <new-absolute-result-directory> \
  --output <new-absolute-selection-json> \
  -- --codex-timeout-ms 1200000 --retain-host-diagnostics \
  --runtime-config-file <absolute-checkout>/evals/sevro-extension/runtime-review-artifacts.json
```
