# Scoped release validation

## Candidate identity

The owner selected npm package `@bjoernrochel/sevro` after npm rejected the
unscoped name. The GitHub repository and installed command remain `sevro`.
This changes distribution metadata, release mechanics, and matching test
expectations; the generic engine, host, and grading source is unchanged.

- Sevro source: `c24b919`.
- Version: `0.1.0-rc.1`; intended public distribution tag: `next`.
- License: owner-selected `BUSL-1.1`; 71 packaged files.
- Archive: `/Users/bjro/.darrow/issue95-scoped-release/c24b919/release/bjoernrochel-sevro-0.1.0-rc.1.tgz`.
- SHA-256: `5f0d9447e792f7454b4eb8ab069e43fef338919ab50753b9cfdd3569c90bc6b1`.
- npm integrity: `sha512-HkkZvKBVP0DF3GRWJyxG1gkhkykVZOhyoUdevsv9e5ONWzd5iuj9E2dfWvJMm4fdCU6UZi5z8p5jYqjqFQVj0A==`.

Darrow commit `c592ec88` updates the installer, candidate CI, and public
comparison for the scoped package. The subsequent fixture repair changes one
benchmark expectation from `sevro` to `@bjoernrochel/sevro`.

## Observed checks

Sevro frozen installation, typecheck, and formatting passed. Release and
provenance checks passed 16 tests / 60 assertions across two files in 6.37
seconds. The full source suite passed 245 tests / 1,404 assertions across 38
files in 125.77 seconds with `bun test --timeout 15000`.

The initial default five-second source gate passed 244 tests and timed out
one existing multi-fixture repository-invocation test. Its unchanged isolated
retry passed in 4.98 seconds. The full 15-second rerun passed that case in 5.35
seconds. No assertion was changed to resolve this timeout. CI's source-test
deadline remains a follow-up.

Preparation and installation of the exact archive passed. The installed
command, assessed and prompt-only outcomes, deterministic native fixtures,
reporting, scoped package name, version, build identity, and absence of source
Git metadata were checked. A public installed-package versus legacy-command
comparison passed one test / 25 assertions in 1.67 seconds.

The full installed Darrow gate used this exact archive at `c592ec88`:

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL='/Users/bjro/.darrow/issue95-scoped-release/c24b919/release/bjoernrochel-sevro-0.1.0-rc.1.tgz' bun run test:eval-runner-sevro-package
```

That run exercised 519 tests across 36 files in 1,108.02 seconds: 516 passed,
and three canonical benchmark tests failed on their stale unscoped package-name
expectation. The retained full gate therefore exited 1. All 1,229 recorded
source inputs remained unchanged during that run.

After the one-string test repair, the complete affected benchmark file passed
six tests / 640 assertions in 92.11 seconds, preparing 77 cells:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-scoped-release/c24b919/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts
```

This rerun covers all three failed canonical cases and their explicit passive
peers. The other 1,228 recorded inputs and the archive were unchanged. These
results provide the full-run coverage plus targeted repair verification; they
are not reported as a second successful full-gate execution. Darrow typecheck,
ESLint, formatting, and documentation checks passed for the changed scope.

Raw evidence is retained in
`/Users/bjro/.darrow/issue95-scoped-release/validation.json`,
`darrow-installed-gate.log`, `benchmark-repair-gate.log`, and
`darrow-source-inventory.json` beneath that directory. Optional actionlint
attempts found no executable on PATH. No current actionlint or remote CI
success is claimed.

## Test-first release mechanics

The release preparation and installation commands are documented maintainer
interfaces. Their scoped name and filename are independent owner-selected
oracles.

Red — `bun test tests/release.test.ts --test-name-pattern 'release preparation retains a real tarball, identity, inventory, and checksums'`:
the unchanged release script rejected the scoped fixture as an invalid public
release.

Green — `bun test tests/release.test.ts --test-name-pattern 'release preparation retains a real tarball, identity, inventory, and checksums'`:
one test / 12 assertions passed after accepting the scoped package and npm
filename.

Red — `bun test tests/release.test.ts --test-name-pattern 'scoped package installation retains the sevro command and release provenance'`:
the unchanged installer requested the old unscoped tarball filename.

Green — `bun test tests/release.test.ts --test-name-pattern 'scoped package installation retains the sevro command and release provenance'`:
one public installation check passed after using the scoped archive, package
directory, and provenance identity.

The later benchmark expectation correction is fixture maintenance; its failed
full-gate run is not TDD red evidence.

## Remaining extraction work

Publication, the exact Darrow dependency and lockfile pin, default caller
cutover, generic runner and source-copy baseline removal, automatic frozen
installed CI, and a focused live check after the switch remain outstanding.

Earlier unscoped full and live evidence keeps its original source and archive
identity. These preparation and deterministic checks establish no new live
owner comparison or bundled-host enforced execution. Explicit enforced modes
remain available but unsupported by the bundled hosts; passive variants do not
actively correct benchmark execution. No special deprecated ticket-pipeline
handling was added.

See the [migration guide](migration.md) and
[acceptance ownership inventory](runner-cutover-inventory.md).
