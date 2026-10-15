# PR #257: Codex validation with Sevro rc.13

Observed on 2026-10-15 in the isolated `fix/pr257-validation` worktree.

The targeted retest completed 14 unique cases: **8 fully passing, 3 failed task
verdicts, and 3 unavailable task verdicts**. Current evidence does not establish
merge readiness. Unavailable observations and classified failures remain
non-passing.

This is a targeted follow-up to the [rc.12 cohort](pr257-codex-rc12-validation-2026-10-15.md),
not another run of all 40 cohort cases.

## Candidate and execution

- Published dependency: `@bjoernrochel/sevro@0.1.0-rc.13`; no Sevro source override.
- Darrow checkpoint: `3b9535eeff196593e67d7a3339c9ee31cd90430a`, plus the uncommitted
  dependency/caller repairs described below.
- The checkout already contained Doctor grading repair `a5ab8f5a`, ticket
  attribution recovery `a0e0dc3a`, and invalid-base fixture repair `3b9535ee`.
- Native Codex 0.162.1, app-server except the canonical Guide exec case.
- Default candidate `gpt-6.1-sol/medium`; the primary cases retain their declared
  routes. Semantic grader `gpt-6-luna/medium`.
- Passive ownership, N=1, jobs=1, threshold=1, timeout 1,200,000 ms, retained
  diagnostics. Cases ran sequentially with diagnosis before continuing on a
  non-passing outcome.
- Fifteen native candidate attempts are retained. Guide initially received an
  extra runtime override and passed on app-server. That result is supplemental;
  one corrected exec/profile trial also passed and is the canonical Guide
  result. This configuration correction was not unchanged-case resampling.
- One separate trusted retained-output grading control failed. It is not a
  native candidate trial; its unverified assertion edit was restored.

The published package integrity is
`sha512-HpDDq/UPuCbKt1KG5XgeU+aQ/xjsFT+pwKYVnyabAUsmLnn9eWk3tUs8/h3oElXZCxbQ5GIUPWgElA4RRFQOeA==`.
The registry supplies no gitHead in the retained metadata.

## Results

| Case                                      | Task         | Activation    | Checks | Candidate route    |
| ----------------------------------------- | ------------ | ------------- | ------ | ------------------ |
| doctor-adaptive-goal-direct-codex         | passed       | passed        | 7/7    | gpt-6.1-sol/medium |
| create-ticket-no-attribution              | passed       | passed        | 4/4    | gpt-6.1-sol/medium |
| code-review-invalid-base                  | passed       | passed        | 7/7    | gpt-6.1-sol/medium |
| code-review-reviewer-route-unavailable    | not_assessed | passed        | 6/7    | gpt-6.1-sol/medium |
| ticket-to-pr-composition-replacement      | passed       | passed        | 13/13  | gpt-6.1-sol/medium |
| ticket-to-pr-feedback-relay               | not_assessed | unavailable   | 19/20  | gpt-6.1-sol/medium |
| create-agent-skill-refuse-undefined-skill | passed       | passed        | 4/4    | gpt-6.1-sol/medium |
| guide-unknown (exec)                      | passed       | passed        | 7/7    | gpt-6.1-sol/medium |
| goal-placement-direct-same-route          | not_assessed | not_requested | 9/10   | gpt-6-luna/medium  |
| goal-placement-coupled-sequential         | failed       | not_requested | 6/11   | gpt-6-luna/medium  |
| goal-placement-cheaper-delegation         | failed       | not_requested | 10/11  | gpt-6-astra/high   |
| goal-placement-concurrent-parts           | failed       | not_requested | 10/11  | gpt-6.1-sol/medium |
| goal-placement-repair-allowance           | passed       | not_requested | 6/6    | gpt-6.1-sol/medium |
| goal-placement-repair-self-review         | passed       | not_requested | 6/6    | gpt-6.1-sol/medium |

The three preceding Darrow repairs now pass fresh published-package trials.
The replacement-publication case also passes its previously unavailable
publisher-read and activation checks, supporting the mixed Skill-read fix.

## Remaining Sevro observations

### Direct placement

All nine implementation, verification, completion and goal checks pass. The
required no-agent assertion remains unavailable. Thirteen native programs have
thirteen correlated inspection receipts; ordinal 25 is partial for template
interpolation of constant array entries `paths[0]` and `paths[1]`. Zero accepted
agents cannot establish absence inside an uninspected submission.

### Unavailable reviewer route

All six task checks and activation pass, including the canonical blocked review
artifact. Reviewer absence remains unavailable. Six of nine program receipts
are partial for persistent `load()` values and composed output. These forms exceed
the documented bounded inspection subset.

### Feedback relay

All 19 effects, plaintext-feedback, same-thread, goal and completion checks pass.
All twelve Code Mode receipts are complete, clearing the earlier inspection gap.

Turn-specific Skill reads remain unavailable. The root native read diagnostics
are complete and recover create-commit/create-pr at ordinal 61, after continuation
boundary 43. Their successful, untruncated 154-token command output contains both
complete fixture bodies. The follow-up Skill-read observation remains partial
with an empty sequence. Recipe-reinvocation absence and aggregate activation
therefore remain unavailable.

`rc13-feedback-relay-read-reproduction.json` retains fixture/body hashes, the exact
program, output, native call identity and bundle binding. Darrow does not replace
the incomplete phase observation with reconstructed evidence.

## Remaining Darrow outcomes

### Coupled sequential placement: candidate execution failure

The candidate checked the correct plugin backend files, then omitted the
`darrow-adaptive-goal` component when invoking the helper. The incorrect path
failed with ENOENT; the candidate stopped without implementing or creating its
native goal. Six checks pass and five fail. No-agent evidence is complete and
passes, so this is separate from the Sevro inspection gaps.

Product behavior remains outside the authorized infrastructure repair scope.
The trial is retained without unchanged-case resampling.

### Cheaper delegation: semantic grading failure

All ten other checks pass. Native acceptance records retain one child on
`gpt-6.1-sol/medium`, with `forkTurns: none` and requested/start/accepted ordinals
44/46/47, versus the parent `gpt-6-astra/high` route.

The completed final report says, “Policy selected GPT-6.1 Sol/medium; delegated
sequentially to reduce cost.” The semantic grader rejects the linkage between
implementation and that route. One bounded rubric clarification still rejected
this retained valid output in a trusted grading control. The edit and temporary
version bump were restored; no fix or passing calibration is claimed.

### Concurrent parts: semantic reporting criterion failure

All ten other checks pass. The final report says both modules and tests were
implemented concurrently on the policy-selected `gpt-6-luna/medium` route.
The grader requires explicit separate workers, agents or assignments and rejects
that disclosure.

Native receipts retain two accepted children on the expected route. Acceptance
alone does not prove private assignment contents or complete child-return
correlation; the retained child-session summaries report resultStatus unavailable.
No assertion edit or candidate resampling was used to turn this into a pass.

## Darrow infrastructure repairs

- Updated the exact package/lock pin and three installed-caller expectations.
- Kept exact host-configuration assertions, adding the documented resolved
  `sevro.host.executable` identity.
- Aligned two stale main-sync expectations with the existing conditional
  evidence requirements. Existing route behavior controls remain intact.
- Canonicalized newly persisted suite cell result paths. Sevro's public report
  canonicalizes input paths; alias spellings previously caused valid reports to
  be rejected and ablation rows to appear missing. Input count, order, case,
  route and provenance checks remain in place.
- Added a portable output-alias regression. It failed with valid successful
  cells before the repair and passes afterward. The complete suite-caller file
  passes 44 tests, including matched ablations.

The full deterministic gate has **558 passing tests across 59 files, zero
current failures**. This combines source/log-bound phases and focused reruns;
it is not one monolithic run. Earlier stale executable/evidence assertions and
18 report-related suite failures remain retained. A regression fixture initially
placed its alias inside the source tree, then used the wrong cell index; both
test-authoring attempts remain in their original logs.

## Retained evidence

Private evidence lives under `evals/results/pr257-eval-migration/`:

- `rc13-complete-retest-status.json`: all 14 canonical results and 15 native
  attempts, routes, transports, source/response/artifact/bundle hashes.
- `rc13-deterministic-coverage.json`: every current passing file and retained
  earlier attempt, source and log hashes, and core source identities.
- `rc13-classifications.json`: ownership and bounded diagnosis for each nonpass.
- `rc13-placement-native-reproductions.json`: exact direct-placement program
  and its partial receipt, plus the coupled case's complete receipts.
- `rc13-feedback-relay-read-reproduction.json` and
  `rc13-feedback-relay-continuation.json`: bound read and continuation evidence.
- `rc13-report-alias-reproduction.json`: successful installed public report
  through an alias, demonstrating canonical rather than literal identity.
- `rc13-cheaper-disclosure-calibration-summary.json` and
  `rc13-unverified-disclosure-clarification.patch`: failed control and restored
  assertion experiment.

All native response and transcript-member hashes were checked. The canonical
Guide exec transport is also bound by native session metadata
`source: exec`, `originator: codex_exec`; its default exec host-configuration key
is omitted. Other trials retain explicit app-server configuration.

## Upstream changes assessed

- [#92: Prepare rc13](https://github.com/BjRo/sevro/pull/92).
- [#87: Inspect templates and destructured tool batches](https://github.com/BjRo/sevro/pull/87).
- [#88: Recognize complete native Skill reads](https://github.com/BjRo/sevro/pull/88).
- [#90: Initialize private zsh temporary prefixes](https://github.com/BjRo/sevro/pull/90).
- [#91: Parallelize TypeScript gate phases](https://github.com/BjRo/sevro/pull/91).
- [#84: Simplify evaluation setup and iteration](https://github.com/BjRo/sevro/pull/84).

The upstream template fix replays the original retained placement programs
successfully, while its own fresh trials also retain unsupported new forms.
Those source-override trials are supporting evidence, separate from the
published-package trials here.

## Reproduce

Select one exact case at a time and fresh absolute output paths:

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN \
  bun evals/runner/run.ts --case <exact-case-id> \
  --harness codex --codex-entrypoint app-server \
  --model gpt-6.1-sol --effort medium --owner-evaluation passive \
  --trials 1 --jobs 1 --threshold 1 \
  --semantic-check-model gpt-6-luna --semantic-check-effort medium \
  --results-root <new-absolute-result-directory> \
  --output <new-absolute-selection-json> \
  -- --codex-timeout-ms 1200000 --retain-host-diagnostics \
  --runtime-config-file <absolute-checkout>/sevro.json
```

Preserve declared candidate routes. Doctor/authoring use
`evals/sevro-extension/runtime-codex-state.json`; Review artifact cases use
`runtime-review-artifacts.json` in that same directory. Guide uses exec and
`runtime-repository-skills.json`, with one runtime profile only.

N=1 observations do not establish reliability or performance. No native Claude
or matched-ablation rerun is claimed, and the other rc.12 cohort cases retain
their original version-specific evidence.
