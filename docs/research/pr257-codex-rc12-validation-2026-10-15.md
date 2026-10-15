# PR #257: Codex validation with Sevro rc.12

Observed on 2026-10-15 in the isolated `fix/pr257-validation` worktree.

The latest targeted cohort has 40/40 cases completed, 32 fully passing, 2 failed task verdicts and 6 unavailable task verdicts. Earlier attempts remain retained. A classified failure or unavailable observation is not a pass.

## Candidate and execution

- Published npm package: `@bjoernrochel/sevro@0.1.0-rc.12`; no development checkout or package override.
- Darrow checkpoint: `1e6759c4349567f897a167a588b3714095889e86`, plus uncommitted fixture/infrastructure repairs.
- PR #257 published head when inspected: `34606ad9e1952b7f4e9c56befa446c18e1a2eb5d`; these local repairs are not that published head.
- Native Codex app-server by default; repository Guide uses Codex exec. Candidate default `gpt-6.1-sol/medium`; placement cases preserve their declared routes.
- Semantic grader `gpt-6-luna/medium`; passive, N=1, jobs=1, threshold=1, timeout 1,200,000 ms; host diagnostics retained.
- Cases ran sequentially and stopped for diagnosis on unexplained outcomes. No retries to search for green results. Repaired assertions have bounded positive/negative controls and fresh native verification.

## Primary placement and compatibility cases

| Case                                                 | Task         | Activation    | Checks | Observed candidate route |
| ---------------------------------------------------- | ------------ | ------------- | ------ | ------------------------ |
| `goal-placement-direct-same-route`                   | not_assessed | not_requested | 9/10   | gpt-6-luna/medium        |
| `goal-placement-coupled-sequential`                  | not_assessed | not_requested | 10/11  | gpt-6-luna/medium        |
| `goal-placement-cheaper-delegation`                  | passed       | not_requested | 11/11  | gpt-6-astra/high         |
| `goal-placement-concurrent-parts`                    | passed       | not_requested | 11/11  | gpt-6.1-sol/medium       |
| `goal-placement-repair-allowance`                    | passed       | not_requested | 6/6    | gpt-6.1-sol/medium       |
| `goal-placement-repair-self-review`                  | passed       | not_requested | 6/6    | gpt-6.1-sol/medium       |
| `goal-preflight-quality-sensitive-localized`         | passed       | not_requested | 12/12  | gpt-6.1-sol/medium       |
| `goal-preflight-routing-difficult-routine-diagnosis` | passed       | not_requested | 10/10  | gpt-6.1-sol/medium       |

## Previously uncleared cases

| Case                                        | Task         | Activation    | Checks | Observed candidate route |
| ------------------------------------------- | ------------ | ------------- | ------ | ------------------------ |
| `doctor-adaptive-goal-direct-codex`         | failed       | passed        | 2/4    | gpt-6.1-sol/medium       |
| `create-agent-skill-refuse-undefined-skill` | passed       | passed        | 4/4    | gpt-6.1-sol/medium       |
| `code-review-empty-diff`                    | passed       | passed        | 7/7    | gpt-6.1-sol/medium       |
| `guide-mutation`                            | passed       | passed        | 8/8    | gpt-6.1-sol/medium       |
| `guide-orchestration`                       | passed       | passed        | 9/9    | gpt-6.1-sol/medium       |
| `code-review-reviewer-route-unavailable`    | not_assessed | passed        | 6/7    | gpt-6.1-sol/medium       |
| `guide-unknown`                             | passed       | passed        | 7/7    | gpt-6.1-sol/medium       |
| `guide-visual-present`                      | passed       | passed        | 7/7    | gpt-6.1-sol/medium       |
| `goal-preflight-high-risk-routine`          | passed       | passed        | 14/14  | gpt-6.1-sol/medium       |
| `guide-visual-absent`                       | passed       | passed        | 9/9    | gpt-6.1-sol/medium       |
| `code-review-presentation-default`          | passed       | passed        | 6/6    | gpt-6.1-sol/medium       |
| `code-review-guidance-uncertain`            | passed       | passed        | 5/5    | gpt-6.1-sol/medium       |
| `code-review-repair-guidance`               | passed       | passed        | 6/6    | gpt-6.1-sol/medium       |
| `code-review-reviewer-route-override`       | passed       | passed        | 8/8    | gpt-6.1-sol/medium       |
| `verification-followup-no-progress`         | passed       | passed        | 9/9    | gpt-6.1-sol/medium       |
| `verification-followup-regression`          | passed       | passed        | 12/12  | gpt-6.1-sol/medium       |
| `goal-verification-existing-review`         | passed       | passed        | 7/7    | gpt-6.1-sol/medium       |
| `ticket-to-pr-feedback-rejected`            | passed       | passed        | 11/11  | gpt-6.1-sol/medium       |
| `goal-readiness-prior-assessed-omitted`     | passed       | not_requested | 9/9    | gpt-6.1-sol/medium       |
| `ticket-to-pr-composition-existing-pr`      | passed       | passed        | 13/13  | gpt-6.1-sol/medium       |
| `ticket-to-pr-composition-replacement`      | not_assessed | unavailable   | 12/13  | gpt-6.1-sol/medium       |
| `ticket-to-pr-feedback-relay`               | not_assessed | passed        | 19/20  | gpt-6.1-sol/medium       |
| `artificer-revoke`                          | passed       | passed        | 5/5    | gpt-6.1-sol/medium       |
| `publish-pr-evidence-text-only`             | passed       | passed        | 3/3    | gpt-6.1-sol/medium       |
| `goal-intent-capability-bindings`           | passed       | not_requested | 16/16  | gpt-6.1-sol/medium       |
| `goal-real-create-commit-composition`       | passed       | not_requested | 15/15  | gpt-6.1-sol/medium       |
| `goal-authorized-publication`               | passed       | not_requested | 18/18  | gpt-6.1-sol/medium       |
| `orchestration-oss-express-links`           | passed       | not_requested | 2/2    | gpt-6.1-sol/medium       |
| `orchestration-oss-requests-proxy`          | passed       | not_requested | 2/2    | gpt-6.1-sol/medium       |
| `orchestration-oss-ajv-instance-path`       | passed       | not_requested | 2/2    | gpt-6.1-sol/medium       |
| `create-ticket-no-attribution`              | failed       | passed        | 1/4    | gpt-6.1-sol/medium       |
| `code-review-invalid-base`                  | not_assessed | unavailable   | 0/0    | gpt-6.1-sol/medium       |

## Darrow infrastructure repairs

- Adopted bounded `execCalls` receipts without converting submitted calls into accepted controls or inventing native ordinals. Missing, contradictory, malformed or partial evidence remains unavailable.
- Explicit owner dispatch is independent of supporting-read completeness. Supporting/sequence assertions still require unique complete native Skill-read evidence.
- Continuation absence checks inspect only the bound later interval; partial evidence inside that interval still blocks absence proof.
- Removed unused complete common-control dependencies from all 69 native-goal cases in two diagnosed steps: 67 unconditional declarations, then two positive-route declarations. Every positive-route, native-goal and absence check still validates its own required facts. Installed-package controls verify both passing and unavailable/failing paths.
- Doctor and skill-authoring use `runtime-codex-state.json`. The two actual-state cases declare Codex-only harness support. Actual config and all four user-skill roots are candidate-bound; absence checks fail closed on missing roots or traversal errors.
- Express and Requests use `evals/sevro-extension/runtime-local-http.json`; actual effect/test assertions remain unchanged.
- Publisher-read checks use complete main-thread supporting reads, removing the obsolete overall-owner-child requirement. Effect checks still prove publication and exact commit identity.
- Semantic fixes accept whole-response source attribution, labelled provenance tables, supported repair guidance and completed publication ready for review. Negative controls retain contract, uncertainty, provenance, causal and completion boundaries. Product skill behaviors were not changed to hide failures.

## Remaining outcomes

### `doctor-adaptive-goal-direct-codex`

Actual isolated Codex config access, frozen diagnostic and explicit activation work. Latest valid report explicitly names checked/used isolated config, configured concurrency5 and unknown free capacity, but semantic grader still returns a source/capacity false negative after bounded clarifications. Preserve this Darrow grading limitation rather than continue assertion hardening or candidate resampling. Separate control-absence proof remains unavailable for partial Code Mode metadata-query inspection.

- `darrow.semantic.1`: failed. The response names an isolated config path and excludes checkout config, but does not identify that path as the checked and used CODEX_HOME source; it reports configured concurrency 5, not effective capacity or that capacity is unknown or unset.
- `darrow.evals.transcript.1`: unavailable. Required skill, event, or native control evidence unavailable

### `code-review-reviewer-route-unavailable`

Sevro bounded Code Mode inspection remains partial for load/template-composed command arguments, array-map tool callbacks and constructed command strings. All six task checks and explicit activation pass; reviewer-absence proof remains unavailable. These programs exceed the documented rc.12 inspected subset.

- `darrow.evals.transcript.1`: unavailable. Native control evidence unavailable, incomplete, or contradictory

### `ticket-to-pr-composition-replacement`

All12 effect, lineage, completion and native-goal checks pass, but mixed literal Skill/non-Skill cat command is not recognized. Verified exact complete ship-proposal fixture bytes are prefix of successful286-token output; no truncation. Root skill-read observation stays partial and omits publisher, so publisher proof and activation sequence stay unavailable. No retry or forced tool sequence.

- `darrow.evals.transcript.1`: unavailable. Graded from complete supporting skill reads

### `ticket-to-pr-feedback-relay`

All19 effect, plaintext feedback, same-thread, goal and completion checks pass, with complete initial/follow-up Skill reads and activation. Recipe-reinvocation absence remains unavailable because the follow-up interval contains partial Code Mode inspection at ordinal65 (Promise.allSettled followed by loop), after bound continuation ordinal47. Relevant interval must remain unknown; no retry.

- `darrow.evals.transcript.3`: unavailable. Native tool calls and follow-up ordinal required

### `create-ticket-no-attribution`

Existing behavior failure recurs: candidate submits forbidden AI-attribution note, backend correctly rejects it, then candidate stops instead of correcting the input and creating the ticket. 1/4 task checks pass; activation passes. Product behavior remains unchanged as requested.

- `darrow.shell.1`: failed. exit code 1 (expected 0)
- `darrow.shell.2`: failed. exit code 1 (expected 0)
- `darrow.shell.3`: failed. exit code 1 (expected 0)

### `code-review-invalid-base`

Existing behavior failure recurs: candidate correctly rejects the missing exact base but explicitly creates no canonical terminal blocked artifact, treating read-only as prohibiting permitted Review evidence. Sevro then reports sevro.grader.error: candidate artifact directories are missing or unsafe. No checks are graded and activation is unavailable; do not count this as a passed blocked outcome. Product behavior remains unchanged.

### `goal-placement-direct-same-route`

Primary declared gpt-6-luna/medium case passes9 implementation/test/completion checks. Required no-implementation-agent proof remains unavailable: native receipts are partial for template-composed exec_command arguments and apply_patch variables. Direct accepted records cannot establish absence inside opaque submissions. Retain core acceptance blocker, no retry.

- `darrow.evals.transcript.1`: unavailable. Required skill, event, or native control evidence unavailable

### `goal-placement-coupled-sequential`

Declared gpt-6-luna/medium case passes10 implementation/test/completion checks. Required sequential/no-agent proof remains unavailable for template/variable exec_command arguments and Promise.all destructuring with composed output. Partial receipts at ordinals30,68; no retry.

- `darrow.evals.transcript.1`: unavailable. Required skill, event, or native control evidence unavailable

## Deterministic verification and retained evidence

556 tests pass across 58 files, with 0 current failures. This combines a full sweep and focused/remainder checks after repairs; it is not one simultaneous final run. Per-file source/log hashes and phase labels are retained in `rc12-deterministic-coverage.json`.

Raw results live under `evals/results/pr257-eval-migration/` (gitignored). `rc12-complete-retest-status.json` records actual trial routes, selection/artifact hashes, every attempt, latest verdicts and classifications. `rc12-required-evidence-migration.json` records the initial 69-case dependency migration; rc12-positive-route-required-evidence-migration.json and rc12-native-evidence-final.json retain the final 69-case declarations and separate publisher remapping. `rc12-replacement-skill-read-repro.json` binds the successful untruncated mixed Skill/non-Skill read to the exact fixture bytes. Semantic-control summaries distinguish retained-output grading from new native behavior trials.

Earlier EMFILE launches, source-fingerprint refusals caused by editing during a run, obsolete synthetic receipts, and test-authoring errors remain in their original logs. Successful corrected checks do not erase those attempts.

## Reproduce

Select one case at a time from the tables. Clear `SEVRO_CHECKOUT` and `SEVRO_PACKAGE_BIN`, install the locked published package, preserve declared candidate routes, and use a new result directory for each attempt.

```sh
bun evals/runner/run.ts --case <exact-case-id> --harness codex --codex-entrypoint app-server \
  --model gpt-6.1-sol --effort medium --owner-evaluation passive \
  --trials 1 --jobs 1 --threshold 1 \
  --semantic-check-model gpt-6-luna --semantic-check-effort medium \
  --results-root <new-absolute-result-directory> --output <new-absolute-selection-json> \
  -- --codex-timeout-ms 1200000 --retain-host-diagnostics
```

Add `--runtime-config-file evals/sevro-extension/runtime-codex-state.json` after `--` for Doctor/authoring, `evals/sevro-extension/runtime-local-http.json` for Express/Requests, and `evals/sevro-extension/runtime-review-artifacts.json` for actual Review artifact cases. For Guide cases, replace the entrypoint with `--codex-entrypoint exec` before `--` and `evals/sevro-extension/runtime-repository-skills.json` after it. The retained plan files record each exact source and profile.

## Upstream changes assessed

- [Sevro #83: chore(release): Prepare rc12](https://github.com/BjRo/sevro/pull/83).
- [Sevro #82: refactor(engine): clarify evaluation lifecycle and ownership](https://github.com/BjRo/sevro/pull/82).
- [Sevro #81: fix(codex): expose candidate-bound configuration and user skills](https://github.com/BjRo/sevro/pull/81).
- [Sevro #80: fix(runtime): Support isolated local HTTP test servers](https://github.com/BjRo/sevro/pull/80).
- [Sevro #79: fix(fixtures): Preserve pinned repository submodule declarations](https://github.com/BjRo/sevro/pull/79).
- [Sevro #78: fix(codex): Inspect submitted Code Mode control calls](https://github.com/BjRo/sevro/pull/78).
- [Sevro #77: fix(codex): Allow isolated trial Git metadata writes](https://github.com/BjRo/sevro/pull/77).
- [Sevro #76: fix(codex): Preserve composed and continuation skill evidence](https://github.com/BjRo/sevro/pull/76).

These single native trials establish bounded observations, not a reliability rate or performance comparison. No native Claude coverage is claimed. Matched ablation was not rerun. Upstream source-override results are supporting evidence, not substitutes for the published-package trials above.
