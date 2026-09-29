# Default installed package validation

Darrow pins published `@bjoernrochel/sevro@0.1.0-rc.1` in its development
dependencies and frozen lockfile. Normal direct, benchmark-suite, and guide
commands use its public CLI without a runner environment variable. The package
is resolved from the Darrow tooling installation, independently of the candidate
project and invocation directory. Explicit package and checkout overrides retain
their existing validation and distinct provenance.

The public command tests create separate candidate projects and controlled host
executables. They clear both overrides, retain the selected case and unassessed
dry outcome, and require the installed runner's scoped name and exact version.
These are deterministic integration checks, not new native model trials.

## Successive test-first slices

Red — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller uses the frozen package without route overrides'`:
the unchanged default legacy caller rejected forwarded native host arguments.

Green — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller uses the frozen package without route overrides'`:
one test / five assertions passed through the pinned package. Removing the
unreachable legacy implementation and repeating this command also passed.

Red — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-benchmark-caller.test.ts --test-name-pattern 'benchmark caller uses the frozen package without route overrides'`:
the unchanged default legacy suite rejected `--project-root`.

Green — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-benchmark-caller.test.ts --test-name-pattern 'benchmark caller uses the frozen package without route overrides'`:
one test / six assertions passed through the pinned package.

Red — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-guide.test.ts --test-name-pattern 'guide caller uses the frozen package without route overrides'`:
the unchanged default guide rejected roots and host options without an explicit
runner route.

Green — `env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-guide.test.ts --test-name-pattern 'guide caller uses the frozen package without route overrides'`:
one test / four assertions passed through the pinned package.

## Caller gate

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/parity/sevro-direct-caller.test.ts evals/runner/parity/sevro-benchmark-caller.test.ts evals/runner/parity/sevro-guide.test.ts
```

All 40 tests / 418 assertions passed across three files in 117.73 seconds.
Coverage includes existing selection, route, grading, cancellation, retained
evidence, explicit override refusal, and unsupported enforced-condition checks.
The retained log is
`/Users/bjro/.darrow/issue95-scoped-release/default-caller-gate.log`.

The previous suite integration test required an environment override despite
already exercising public command results and runner provenance. That obsolete
precondition is removed; its outcome and evidence assertions remain.

The first lint check identified the resolver's function size and complexity.
Separating installed-dependency validation resolved both findings. The three
default-route checks and two invalid-route checks then passed together: five
tests / 32 assertions in 5.11 seconds. ESLint, typecheck, formatting, and the
253-page documentation check passed for the changed scope.

Generic runner files and the temporary source-copy comparison are now
[retired](runner-retirement-validation.md). Automatic frozen installed CI and
the required focused live check remain the next milestones.
Earlier live evidence retains its original archive and source identity. See
[release validation](scoped-release-validation.md) and the
[migration guide](migration.md).
