# Repository Python quality

## Purpose

Python in this repository must remain readable, typed, deterministic, and safe
to release across its declared support range. These rules apply to every Python
package listed in [`python-packages.txt`](../../python-packages.txt). A new
Python source file, `pyproject.toml`, or UV lock outside a registered package is
an error until its package is added to that inventory.

## Source quality

Packages use Ruff for formatting, import order, common correctness rules,
modern syntax, naming, simplification, and a cyclomatic-complexity ceiling of
five. Mypy runs in strict mode over production code, tests, and package tooling.
Development tools belong in a locked development dependency group and must not
enter the runtime dependency set.

Names describe the domain concept or action they represent. A module owns one
coherent responsibility; a function performs one focused operation at one
level of abstraction. Boundary code validates untrusted input and reports a
specific error. An exception may be translated when the new error adds useful
domain context, but it must retain its cause. Broad catches are allowed only at
an explicit process or protocol boundary with documented failure semantics.

Automation cannot judge every aspect of those rules. Reviewers inspect names,
module cohesion, function focus, error boundaries, and whether assertions
verify observable behavior rather than implementation details.

## Tests and coverage

Each package keeps fast unit tests for local behavior and integration tests for
the real filesystem, database, subprocess, or protocol seams it owns. Every bug
fix carries a regression test that fails for the reported trigger. Property
tests are required where generated cases can test a meaningful invariant, such
as parser normalization, validation, redaction, serialization round trips, or
state-machine transitions. They use deterministic settings suitable for CI.

Coverage is measured for the complete import package with branch measurement
enabled. The aggregate gate calculates statement coverage and branch coverage
separately for each registered package; both must be at least 95%. The gate
must fail when statement coverage passes but branch coverage does not. Coverage
exclusions require a concrete unreachable-platform or interpreter reason in
the source and review.

Each package owns its coverage source and branch configuration. The repository
quality infrastructure owns the shared percentage calculation, threshold, and
failure behavior so packages do not copy or weaken that policy.

## Commands and enforcement

`bun run check:python` is the canonical local and CI command. For every
registered package it verifies the lock, synchronizes the complete development
environment, checks formatting and lint, runs strict typing, executes all tests
including property tests, and enforces both coverage measures. The pre-commit
hook runs the fast formatting, lint, and type portion when staged Python or
Python project files change.

CI runs the canonical all-package gate on Linux and macOS for every declared
Python minor version. Packages that claim native Windows support run the same
gate in a package-scoped Windows matrix. A stable aggregate `Python quality`
status is the branch-protection check. The inventory guard itself is tested by
introducing a temporary unregistered package and proving that the gate refuses
it.

## Performance and release evidence

Performance checks target observable workload invariants rather than arbitrary
timing budgets. A benchmark identifies its fixture size and environment,
reports startup and steady-state foreground capture separately, confirms that
foreground capture does not depend on the network, checks bounded incremental
rollout reads and exporter batching, and reports peak memory. A numeric
regression threshold may be added only after representative measurements make
the budget defensible.

Plugin-specific benchmark workloads, comparison rules, and executable entrypoints
live inside the plugin that owns the behavior. Repository commands and CI may
invoke those entrypoints, but do not reproduce the plugin's internal path
resolution or benchmark logic.

Release validation installs each Python-backed plugin from a fresh copied
artifact using only locked runtime dependencies before exercising its public
entrypoints. Cross-platform helpers run this validation on Linux, macOS, and
native Windows. The isolated live Langfuse ingestion procedure remains release
evidence for that plugin's external service boundary; it is not replaced by
mocked CI tests.
