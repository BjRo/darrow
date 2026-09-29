# Capability-review fixture migration

The eight tests from `evals/runner/goal-capability-review-fixture.test.ts` now
live under `evals/domain/`. They use the public-command transport and installed
Sevro package, with no runner imports or copied implementation. The canonical
fixture protocols and named review acceptance check remain unchanged.

## Setup tool lookup regression

The first migrated case timed out during setup. Sevro makes declared fixture
tools available during setup, while the legacy Darrow setup used ambient tools.
This fixture records `command -v git` for its Git wrapper. Under Sevro it bound
the wrapper itself, causing recursive execution before the candidate ran.
The stalled focused run was interrupted; it is not a meaningful TDD Red.

The normative contract now preserves Darrow's setup tool lookup. A focused
public-command regression adds an early setup guard that exits `9` if fixture
Git shadows system Git. Its independent oracle compares the recorded path with
ambient Git and verifies the declared wrapper remains usable during grading.
The extension removes Sevro's leading fixture-bin path only from its setup
process. Generic Sevro policy, execution, and grading environments are unchanged.

Red — the following command failed before the extension change, with one
failed test and one assertion. Public exit was `70`, diagnostic was `fixture
setup failed (9)`, execution was `not_run`, grading was `not_requested`, and
task was `not_assessed`:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/fixture-state.test.ts --test-name-pattern 'Darrow setup resolves system Git before declared wrappers'
```

Green — the identical command passed after the extension change, with one
test and five assertions in 1.50 seconds:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/fixture-state.test.ts --test-name-pattern 'Darrow setup resolves system Git before declared wrappers'
```

## Preserved examples

| Examples                                                           | Count | Required observations                                                                                                                            |
| ------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correct content, wrong content, failing required check, extra file |     4 | Review's exit and declared output match acceptance; only the correct candidate produces a review record                                          |
| Current, missing, duplicate, stale review record                   |     4 | Review and commit actions succeed; only current evidence clears the canonical publication check; negative cases retain their diagnostic messages |

The transport accepts an explicit fixture snapshot and declared output regex.
The failing `check.sh` case modifies initial committed fixture content, as the
old test did; an uncommitted check edit would instead fail the scope check.
Controlled actions and assertions execute in Sevro's isolated shell grader.
Each public result separately asserts execution, grading, task verdict, and
exit. Negative evidence cases keep the original acceptance check failed. A
second declaration runs its read-only body with expected exit `1` and its
expected diagnostic regex, because public check detail reports the exit mismatch
rather than copying command output. The initial translated tests failed those
three detail assertions; this declaration preserves the original diagnostic
coverage through the public interface.

The synthetic host returns a fixed complete response and performs no actions.
These tests do not claim native review delegation or skill selection. All Git
operations affect generated fixtures; no real publication occurs.

## Focused gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-capability-review-fixture.test.ts
```

All 8 tests and 47 assertions passed in 12.29 seconds. This uses the previously
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.

## Final installed gate

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/package/sevro-0.1.0-dev.0.tgz bun run test:eval-runner-sevro-package
```

The gate installed the archive into a fresh consumer without package Git
metadata and ran all parity and domain tests. All 346 tests and 3,552 assertions
passed across 20 files in 475.81 seconds. This run includes the current extension
change, transport helper, setup regression, and all migrated fixture families.
Final TypeScript lint, typecheck, formatting, and documentation checks passed.
No standalone Sevro or marketplace plugin changed. Live native model behavior,
the published release pin, and legacy benchmark migration remain separate gates.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-capability-fixture/`.
