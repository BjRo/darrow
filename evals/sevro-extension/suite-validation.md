# Suite validation

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
