# Suite validation

## Separate project and configuration roots

Sevro's public `--config-root` preserves the explicit Codex configuration import
independently of Darrow case and asset discovery. The extension entrypoint forwards
that absolute option after `--`. The imported concurrency setting is captured
once, applied to configured Codex roles, and retained in comparison identity.
Invalid declared configuration fails before execution. The shared isolation
boundary also protects primary and linked worktrees for declared source roots.

The test-first trace is retained in Sevro's
`docs/configuration-root-validation.md` at `/Users/bjro/Sources/sevro`.
It records five observed red/green slices through the public CLI: importing a
separate root, denying linked configuration worktree reads, refusing unreadable
declared configuration links, and rejecting an explicitly empty configuration
root. Seven new tests contain 76 assertions.
Additional guards cover defaults, every Codex role, malformed settings, invalid
TOML integer types and ranges, and unusable roots. No live model call was made.

Darrow's integration guard was added after implementation, without a test-first
claim. This command passed one test with seven assertions:

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow separates case discovery from imported Codex configuration"'
```

The real Darrow and Sevro commands discover the selected case from one project
and import the limit from another root. The declared candidate model remains
unchanged; unrelated TOML settings are absent from evidence. Dry execution stays
`not_run` and task success `not_assessed`. Existing source-isolation parity now
uses `--config-root` on both public commands.

The full installed-package gate passed 109 tests with 1,744 assertions across
three files in 203.49 seconds after the review repairs:

```sh
SEVRO_PACKAGE_TARBALL=/private/tmp/darrow-issue95-config-root-repaired.PMKCOa/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

Tarball SHA-256:
`f7579e569769a8045df28ed8ccd0ff09621f42477a5453eda07cd16890dc7ca9`.
It was packed from the stable Sevro working candidate on parent `fe8faf5`,
subsequently committed as `4a6482a`. The public installation uses no source checkout or
runner Git metadata. Sevro's final full gate passed 217 tests with 1,207
assertions across 36 files in 80.11 seconds, plus typechecking and formatting.
Its standalone package installation check also passed before the two bounded
review repairs. Darrow typechecking, ESLint, and formatting passed.

The required independent review found a dangling `.codex` directory link that
silently retained the default and an explicitly empty `--config-root` that
silently selected the project. Both repairs have observed public CLI red/green
traces. Bounded repair verification resolved both findings with no regressions
or evidence gaps against the final working candidate
`WORKTREE@fe8faf52b75005b3e4597d00fff3dc8bb0a44a94+eb180edf50d8b0a1f581ea637e48d413527cd4e7`.
The complete local report is
`/Users/bjro/.darrow/reviews-issue95-configuration-root/8794a1ce3463a83e1434abc110042a76e2397e27951a9a5cbf42214d9bbfc77b/darrow-review.8_nwne6o/verification.md`.

The first Sevro full gate hit the existing eight-scenario Claude guard's default
five-second timeout. Its explicit bound is now ten seconds, with assertions
unchanged; the focused guard and full gate then passed. This timeout repair is
test harness maintenance. Release pinning and normal command cutover remain
pending.

## Claude continuation through the public CLI

Sevro commit `fe8faf5` adds UUID-bound native Claude resumption. Darrow's
`follow_up_prompt` translation reaches that host through the negotiated
`sevro.host.continuation` capability. Existing task and output checks run
against the completed second turn.

The focused command passed one test with seven assertions:

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow runs a Claude follow-up through Sevro"'
```

It runs the real Darrow entrypoint and Sevro CLI with a synthetic Claude
executable and credentials. The resumed call verifies the session and prompt,
creates the expected fixture effect, and supplies the final response. The
result passes the hidden shell and output checks, retains both turn artifacts,
and binds a complete continuation observation with an unchanged visible
worktree before feedback. This integration guard was added after Sevro's
implementation, without a test-first claim.

The final installed-package gate passed 108 tests with 1,737 assertions across
three files in 182.96 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/private/tmp/darrow-issue95-claude-resume-package.d3MnL2/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `fe8faf5`. Its own full suite
passed 210 tests with 1,131 assertions across 36 files, plus typechecking,
formatting, and package installation without source Git metadata. Darrow
typechecking, ESLint, and formatting passed. The new integration fixture uses
no live model call. A separate native continuation is recorded in
[live-validation.md](live-validation.md). Release pinning and command cutover
remain pending.

## Parent candidate case routes

Suite `case_routes` and mode `apply_case_routes` now preserve exact-case parent
candidate overrides independently of owner expectations and grader routes.
The public-command regressions use Sevro's bundled hosts with synthetic
executables; no live model call was made.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite applies enabled case routes before mode candidate defaults"'`:
   exit `64`, because suite `case_routes` was unsupported.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite applies enabled case routes before mode candidate defaults"'`:
   one test passed with 16 assertions. The enabled exact-case route overrides
   the mode's candidate model and effort; unmapped cases and inactive modes
   retain the mode defaults. Actual retained routes agree and task checks pass.

The first green attempt exposed a fixture mistake: its synthetic executable
was inside the protected source tree. Moving it to a separate temporary
directory restored the intended host boundary. The literal command above
then passed; the protected-source failure was not a missing-behavior red.

Additional guards passed two tests with 44 assertions. They cover malformed
maps, a missing enabled harness map, invalid flags, both host configurations,
focused cases, inactive false flags, and dry unassessed results. These guards
were added after implementation, without a test-first claim.

The final installed-package gate passed 107 tests with 1,730 assertions across
three files in 182.17 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `08b5371`. Darrow typechecking,
ESLint, and formatting passed. The previous 377/377 resolution inventory stays
separate from these execution checks; it does not establish complete workflow
compatibility. Release pinning and normal command cutover remain pending.

## Existing adaptation-fidelity dry preparation

Before the case-route changes, clean Darrow commit `a518624d` and clean Sevro
commit `08b5371` prepared an existing benchmark mode successfully:

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun evals/sevro-extension/suite.ts --suite /Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension/evals/experiments/orchestration/adaptation-fidelity-suite.yaml --mode routed-terra --case orchestration-routing-localized-mechanical --results-root /private/tmp/darrow-issue95-adaptation-fidelity-owner-dry --trials 1 --threshold 1 -- --host codex --codex-bin /opt/homebrew/bin/codex --codex-auth-file /Users/bjro/.codex/auth.json --model gpt-5.6-terra --effort medium --shell-isolation --dry'
```

The command exited `0` with one cell. Retained configuration identifies the
condition, adaptive-delivery mount, and expected Luna/medium child separately
from the Terra/medium parent. Execution is `not_run`; the task is
`not_assessed`. This verifies preparation and configuration binding, without
establishing native skill dispatch, owner acceptance, or benchmark behavior.
The local checkout identity remains explicit; release pinning is pending.

## Benchmark owner routes

The Darrow run command and suite modes now preserve case-bound native owner
route assertions separately from the parent candidate route. The public-command
regressions use the real Sevro CLI or extension protocol with synthetic hosts.
Complete native acceptance establishes an applied route; private contract
selection stays unverified.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite grades benchmark owner routes separately from the parent candidate route"'`:
   exit `64`, because mode `effective_owner_routes` was unsupported.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite grades benchmark owner routes separately from the parent candidate route"'`:
   one test passed with 13 assertions. The parent remains on Terra/medium;
   a matching accepted Luna/high child passes, while a mismatched child fails
   only its added route check. Retained configuration binds the expectation.

Additional guards passed four tests with 79 assertions. They cover incomplete,
duplicate, foreign, malformed, and route-incomplete receipts, inherited context,
no or multiple accepted children, malformed maps, selected Claude rejection,
focused maps, and dry unassessed results. A real CLI run with a route-incomplete
receipt retains completed execution, unavailable grading, task `not_assessed`,
and Sevro exit `4`; the suite exits `1` while preserving the passing task check.
These guards were added after implementation, without a test-first claim. No
live model call was made. Release pinning and normal workflow cutover remain
pending.

The final installed-package gate passed 104 tests with 1,670 assertions across
three files in 172.78 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `08b5371`. Darrow typechecking,
ESLint, formatting, and the 377/377 case resolution inventory passed. This
inventory does not prove live behavior or complete workflow compatibility.

## Benchmark evaluation records

The Darrow run command and suite modes now preserve the requested evaluation
record checks. They require a complete final response and exactly one integer
child count and human-intervention count, while retaining existing task checks.
The regressions use Sevro's public CLI and extension protocol with synthetic
candidates. The counts are self-reported, without native accuracy attestation.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite gates requested evaluation records independently of existing task checks"'`:
   exit `64`, because mode `require_evaluation_records` was unsupported.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite gates requested evaluation records independently of existing task checks"'`:
   one test passed with 11 assertions. Both existing task checks pass; the
   missing human-intervention record fails only its added check and the task.
   Retained redacted configuration identifies the requested policy.

Additional guard coverage passed three tests with 56 assertions. It covers
both hosts, duplicate and malformed records, incomplete and foreign final
responses, malformed suite declarations before execution, dry unassessed
results, an omitted policy, and the legacy adaptive-delivery applicability
exception. These guards were added after implementation, without a test-first
claim. Initial assertions used the wrong retained check and dry metric locations;
they were corrected to the public CLI trial checks and report's task pass rate.
No live model call was made. Ownership checks and release cutover remain pending.

The final installed-package gate passed 99 tests with 1,578 assertions across
three files in 167.65 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `08b5371`. Darrow typechecking,
ESLint, formatting, and the 377/377 case resolution inventory passed. This
inventory does not prove live behavior or complete workflow compatibility.

## Candidate skill overrides

The run and suite commands now accept candidate skill overrides and sibling
mount selection through Darrow's extension configuration. The selected
experiment case stays unchanged; unmounted controls mount no skills. These
regressions use Sevro's public CLI or extension protocol with synthetic hosts.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite mounts candidate skill overrides without changing experiment selection"'`:
   exit `64`, because `skill_dir` and `mount_plugin_skills` were unsupported mode fields.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite mounts candidate skill overrides without changing experiment selection"'`:
   one test passed with 14 assertions. The candidate receives both sibling bodies;
   the control receives none. Both retain the selected experiment without an
   activation grade, and configuration and artifacts bind their mount settings.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow refuses override mounts that contradict preparation configuration"'`:
   preparation returned both skill artifacts after its sibling setting was removed.
4. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow refuses override mounts that contradict preparation configuration"'`:
   one test passed with four assertions. Contradictory configuration is rejected;
   matching configuration returns the two declared artifacts.

Additional guard coverage checks malformed, missing, foreign, and symlinked
inputs before any cell starts, Claude plugin packaging, and a matched ablation
with the same override declared in both modes. These tests were added after
implementation, without a test-first claim. An initial ablation assertion used
the wrong report level; it was corrected to the documented comparison's case
row without changing product behavior. No live model call was made.

The additional guards passed three tests with 37 assertions. The final
installed-package gate passed 95 tests with 1,511 assertions across three files
in 166.58 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `08b5371`. Darrow typechecking,
ESLint, and formatting passed. The compatibility inventory resolves 377/377
cases; resolution alone does not establish live behavior or full extraction
parity. Benchmark owner-route and evaluation-record policies, the release pin,
and the normal workflow cutover remain pending.

## Suite condition selection

Suite modes now support shared `condition` files and host-specific
`condition_by_harness` files. Selection uses suite-relative paths, validates
templates before execution, binds each cell to its preflight content digest,
and checks retained redacted configuration. The command regressions use the
real Sevro CLI and public extension protocol with synthetic candidates.

Darrow working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite selects benchmark condition files per mode and host"'`:
   exit `64`, because the shared mode's `condition` field was unsupported.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite selects benchmark condition files per mode and host"'`:
   one test passed with 23 assertions across four cells. Host overrides take
   precedence, missing overrides use the shared file, unmounted controls keep
   their instructions, and retained labels and original content digests match.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite refuses changed condition bytes before a later candidate starts"'`:
   a second candidate started after the first changed the protected input.
4. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite refuses changed condition bytes before a later candidate starts"'`:
   one test passed with seven assertions. The first run records its source
   failure; the second cell exits `64` before candidate execution and retains
   the original preflight digest.
5. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite validates condition-aware prompts before Sevro supplies the route"'`:
   exit `64`, because early preflight rejected the case's route variables.
6. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite validates condition-aware prompts before Sevro supplies the route"'`:
   one test passed with five assertions. Preflight validates deferred templates;
   the final candidate receives its actual host, model, and effort in both turns.

Sevro working directory: `/Users/bjro/Sources/sevro`.

1. Red — `lean-ctx -c 'bun test tests/cli.test.ts -t "CLI retains redacted extension configuration with its identity"'`:
   the completed run omitted its redacted extension configuration.
2. Green — `lean-ctx -c 'bun test tests/cli.test.ts -t "CLI retains redacted extension configuration with its identity"'`:
   one test passed with four assertions. The retained configuration matches the
   operator's redacted snapshot, binds its identity digest, and excludes the
   private configuration marker.

Sevro commit `08b5371` passed 206 tests with 1,057 assertions across 36 files,
typechecking, formatting, and `bun run test:package-install`.

Continuing in the Darrow working directory:

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite rejects contradictory retained benchmark configuration"'`:
   a contradicted condition label incorrectly returned suite exit `0`.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite rejects contradictory retained benchmark configuration"'`:
   one test passed with 13 assertions. Contradicted labels or digests and missing
   retained configuration produce cell `70`; raw Sevro task `passed` and exit
   `0` remain unchanged.

Additional guard coverage passed two tests with 38 assertions. Malformed host
maps, missing or invalid files, unknown templates, and condition-induced
invocation in an unmounted control fail before cells start. A focused dry run
excludes the invalid control and records activation `not_run`. These guards
were added after implementation, without a test-first claim. They do not prove
live behavior of the existing orchestration benchmark or owning skill overrides.

The final installed-package gate passed 90 tests with 1,456 assertions across
three files in 154.39 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `08b5371`. Darrow typechecking,
ESLint, and formatting passed. The compatibility inventory resolves 377/377
cases; this inventory does not prove execution or behavioral parity for all of
them. No live model call was made for these suite condition regressions.

## Standalone condition prerequisites

At this milestone, the standalone Darrow run entrypoint accepted a benchmark
instruction file, while suite condition fields were pending. The prerequisites used the real
Sevro CLI and public extension protocol with synthetic candidates.

Sevro working directory: `/Users/bjro/Sources/sevro`.

1. Red — `lean-ctx -c 'bun test tests/cli.test.ts -t "CLI supplies the selected candidate route during extension resolution"'`:
   exit `70`, because `sevro.case.host-route` was unsupported.
2. Green — `lean-ctx -c 'bun test tests/cli.test.ts -t "CLI supplies the selected candidate route during extension resolution"'`:
   one test passed with four assertions. Resolution receives the selected
   candidate adapter's exact host, model, effort, and capability set.

Sevro commit `65a9e7f` passed 205 tests with 1,053 assertions across 36 files,
typechecking, formatting, and `bun run test:package-install`.

Darrow working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow condition files render the actual candidate route through Sevro"'`:
   exit `64`, because `--benchmark-condition-file` was unknown.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow condition files render the actual candidate route through Sevro"'`:
   one test passed with ten assertions. Both host routes receive the expected
   instruction prefix; unmounted controls retain it, and redacted configuration
   retains the original content digest without the instruction body.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow conditions preserve route rendering on the follow-up turn"'`:
   resolution rejected the follow-up route variables as unsupported templates.
4. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow conditions preserve route rendering on the follow-up turn"'`:
   one test passed with two assertions. The follow-up renders its route without
   repeating the instruction prefix.
5. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow condition routes resolve after corpus preflight"'`:
   the standalone command exited `64` because its early corpus preflight tried
   rendering case route variables before a candidate route was available.
6. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-extension.test.ts -t "Darrow condition routes resolve after corpus preflight"'`:
   one test passed with three assertions. Corpus preflight reads the fixture
   declaration; Sevro's later resolution supplies the route for both prompts.

Additional input coverage passed one test with eight assertions: oversized
files, invalid UTF-8, NUL bytes, and unknown templates all stop before candidate
execution. This guard coverage was added after implementation, without a
test-first claim.

The final installed-package gate passed 84 tests with 1,370 assertions across
three files in 142.53 seconds:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

The tarball was packed from clean Sevro commit `65a9e7f`. Darrow typechecking,
ESLint, and formatting passed. The compatibility inventory still resolves
377/377 cases; this inventory does not prove execution or behavioral parity for
all of them. No live model call was made for these condition regressions.

## Command regressions

Both slices exercise the documented Darrow suite command through the real
Sevro CLI and extension protocol. Only the candidate host is synthetic. Task
checks remain independent of activation gates and selection metrics.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite gates activation independently"'`:
   two successful task trials and one successful activation incorrectly returned
   suite exit `0`; the declared threshold required exit `1`.
2. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite gates activation independently"'`:
   one test passed. The suite exits `1`, retains task `passed` and Sevro exit
   `0`, and records activation pass rate `0.5` against threshold `1`.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite reports activation classes"'`:
   task checks passed and activation gates failed as expected, but the separate
   activation report was absent.
4. Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite reports activation classes"'`:
   one test passed. The three-class example reports recall `0.5` and precision
   `0.5`, while the generic task report retains three successful cases.

The full suite test file passed 12 tests with 172 assertions. Additional cases
cover mixed known and unknown trials, dry preparation, unmounted controls,
zero precision denominators, separate mode and host groups, retained failures,
and cancellation. Typechecking, ESLint, and formatting passed.

The installed Sevro `0.1.0-dev.0` tarball passed all 75 public-command parity
tests with 1,277 assertions across three files:

```sh
SEVRO_PACKAGE_TARBALL=/tmp/sevro-0.1.0-dev.0.tgz lean-ctx -c 'bun run test:eval-runner-sevro-package'
```

## Focused Claude suite

On 2026-09-28, one `guide-mutation` cell ran through the suite command in
passive mode, with one trial and threshold `1`. The native Claude candidate
used `claude-sonnet-5` at low effort and `--claude-project-settings`. Semantic
grading used Codex `gpt-5.6-terra` at medium effort. Shell isolation applied.

Dry preparation completed first with task `not_assessed`, activation
`not_run`, and null recall and precision. The fresh live suite then returned
exit `0`, with no failed cells or failed or unavailable activation gates.
Execution and grading completed; all eight task checks passed. The independent
positive activation gate passed from the native repository-command receipt.
The `passive` / `claude` activation group reports recall `1` and precision `1`
for this one measured positive trial. Negative and competition rates remain
null because those classes were not run.

Evidence records Sevro revision `16adcf31d8e5085d5ef8258f3da4364ae57be4ca`
and Darrow revision `e61ccea9b1ce212f6e028b37409c40c25ad39a3f`, both
without dirty patches. The retained run ID is
`1a98790c-0b2c-47c8-88a9-250d3edc176a`.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `run.json`               | `d27add817547c735a59a6dd845ee931d86ce23317213d4a16c4e30c9cb695f07` |
| `suite-run.json`         | `d2322ccc2c51ad52ea5335220df821a5941387846a913420f97b7566988b1f46` |
| `activation-report.json` | `63ee3e2b7e3324ea6393c4082b9a107e155eba8a4a0255f425bfefaf5a38cc65` |

The suite artifacts remain at
`/private/tmp/darrow-issue95-guide-suite-claude-activation-sevro/live`.
The manifest binds the cell to its absolute retained Sevro evidence path and
contains both report paths.

This establishes the supported native Claude suite path for one positive
repository-skill case. It does not establish stability, live negative or
competition coverage, all suite route overrides, a published package pin, or
the normal command cutover. Those issue #95 requirements remain pending.

## Candidate route overrides

The suite now preserves per-mode `model_by_harness` and `effort`. The command
regression uses Sevro's bundled Codex and Claude adapters with synthetic host
binaries, one trial, threshold `1`, passive execution, and shell isolation.
It runs on macOS with Codex available for the real sandbox boundary. No live
model call or real login is required.

Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite applies per-mode candidate routes"'`:
the unchanged suite rejected `model_by_harness` and `effort` with exit `64`.

Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite applies per-mode candidate routes"'`:
one test passed with 21 assertions. Original modes retain their host-specific
base routes; overridden modes retain `codex-variant` / `high` and
`claude-variant` / `high`, with requested and actual routes recorded separately.
Both separated CLI values and `--option=value` inputs are exercised.

A public-command wrapper then supplies contradictory retained model evidence
and, separately, contradictory effort evidence. Only the overridden cells
become unsuccessful, with unavailable provenance, while their original Sevro
task verdict and exit code remain intact. A no-skill comparison with differing
candidate routes also runs every task successfully but refuses matched
ablation deltas. Invalid model maps and effort values fail before execution.

The initial custom-adapter fixture could not exercise route flags because
Sevro requires a bundled host for `--model` and `--effort`. The fixture was
corrected before the recorded red/green sequence. This proves command and
evidence behavior; it makes no claim about live model quality or the remaining
benchmark condition and skill overrides.

## Defaults and focused selection

Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite supports legacy defaults"'`:
the unchanged command rejected `--harness` with exit `64`.

Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite supports legacy defaults"'`:
one test passed. A suite without a harness declaration selects Codex,
the enforced mode, and `suite-beta` when those CLI selectors are supplied;
the case filter overrides the suite's `suite-alpha` filter as in the legacy
command. Only the selected cell runs.

Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite keeps both-host options"'`:
the narrowed run rejected its existing two-host options file with exit `64`.

Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-suite.test.ts -t "suite keeps both-host options"'`:
one test passed. The same options file works for a selected Codex run and for
the default Claude/Codex matrix, with the same file digest retained. A malformed
unused route remains an error before execution.

The three focused selection tests passed with 32 assertions. They also reject
unsupported or duplicate hosts and modes, unknown cases, and empty filters
before creating a results directory. These tests use the public CLI and
synthetic candidate adapters without live model calls.

After candidate routes and focused selection were added, the installed Sevro
`0.1.0-dev.0` package gate passed all 80 tests with 1,347 assertions across the
three public-command parity files. Typechecking, ESLint, and formatting also
passed. This validates the installed development package; a published release
pin and the remaining benchmark options are still pending.
