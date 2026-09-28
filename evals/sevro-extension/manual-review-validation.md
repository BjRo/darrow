# Manual review annotation validation

## Contract

The existing direct command accepts `--human-review-minutes` before `--`.
The finite, non-negative value is manually supplied minutes per trial and
applies to every selected case. Empty and non-finite values are refused before
selection storage or case execution.

The Darrow selection manifest records `humanReviewMinutes` and
`humanReviewMinutesSource: "user_supplied"`. An omitted option records both
fields as `null`. Initial, per-attempt, latest, optional output, failed, and
interrupted manifests preserve the annotation. The raw public Sevro result
stays intact.

This records a supplied value, without asserting that a review happened. It
does not enter Sevro's evaluator identity, task grading, automated measurements,
or generic reports. Dry and unavailable task evidence remain unassessed.
Legacy callers had a per-case result field; the selection manifest now owns
the annotation for all selected cases.

## Observed test-first slices

### Supplied annotation

```text
Red — env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller retains supplied review minutes as an annotation': exit 1; the direct command rejected the unknown option with exit 64.
Green — env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller retains supplied review minutes as an annotation': exit 0; 1 test, 19 assertions.
```

The test supplies zero and fractional values, reads the retained manifests and
raw CLI files, and verifies unassessed dry evidence and unchanged evaluator
identity across the two annotations.

### Invalid input

```text
Red — env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller refuses invalid review minutes before selection': exit 1; all six invalid inputs were accepted and returned exit 0.
Green — env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts --test-name-pattern 'direct caller refuses invalid review minutes before selection': exit 0; 6 tests, 36 assertions.
```

The inputs are negative, NaN, positive and negative infinity, empty, and
whitespace. They now return exit 64 with an option diagnostic, empty stdout,
and no result directory.

Omitted-value, failed-task, and interrupted-prefix checks extend the existing
public tests. Their annotation assertions were already green and are
compatibility evidence, not additional Red/Green claims.

## Final gates

The installed runner is the unpublished Sevro `0.1.0-dev.0` package built
from commit `ed60be6`. Its tarball SHA-256 is
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
No Sevro implementation or package source changed in this milestone.

### Affected public integration tests

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts evals/runner/parity/sevro-selection.test.ts evals/runner/parity/sevro-corpus-caller.test.ts
```

PASS: 42 tests, 499 assertions. The tests cover the annotation and invalid input
as well as existing task failures, cancellation, activation, case selection,
public-result validation, source isolation, and corpus provenance.

### Typecheck

`bun run typecheck` — PASS.

### ESLint

```sh
bun run lint:ts evals/sevro-extension/direct-caller.ts evals/sevro-extension/selection.ts evals/runner/parity/sevro-direct-caller.test.ts
```

PASS.

### Formatting and documentation

Formatting for all ten milestone paths and `bun run check:docs` pass.
Documentation checks cover 225 Markdown pages and 16 plugins.

## Limits

These checks use the installed unpublished Sevro development package and
synthetic native responses. The native failure and cancellation checks exercise
the macOS Codex sandbox; other platforms skip those cases. They do not prove
live-model stability, the accuracy of a human-supplied value, a published
release, default cutover, or completion of issue #95.
