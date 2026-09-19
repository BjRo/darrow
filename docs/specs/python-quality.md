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

## Converting existing mechanics

Treat a Bash implementation as evidence of required behavior, not a Python
design template. Establish the public inputs, outputs, refusals, side effects,
and ordering constraints before refactoring. Prefer idiomatic Python and
standard-library operations over hand-written equivalents; replace shell-style
control flow and duplicated mechanics with direct operations and focused reuse
within the owning module or package. Keep abstractions proportional to their
actual callers and keep plugins independently installable.

Audit the complete invocation surface during the conversion. Remove unnecessary
Bash shims, obsolete aliases, and backward-compatibility branches. Update skill
instructions, documentation, callers, fixtures, and tests to the canonical
frozen package entrypoints. Retain an adapter only when an explicitly required
external contract or actual host protocol needs it; an old script path alone
is not such a requirement. Keep shell regression tests as tests, not runtime
entrypoints, and verify the copied plugin without the removed paths.

Use behavioral and differential checks to preserve the required interface while
changing the internals. High coverage is a guard for simplification, not a reason
to keep redundant code or mirror the old implementation in new tests.

The same implementation boundary applies to validation mechanics: substantial
eval fixture providers, structured JSON/TSV evidence checks, and copied-artifact
installation checks belong in the owning plugin's Python package. Keep eval
oracles independent of the implementation they assess. Share fixture mechanics
within that plugin rather than duplicating them across YAML cases; case-specific
input and expectations remain explicit in each case. Use one portable Python
installation check for Unix and Windows, preserving platform-specific probes.
Small host launchers and tests whose subject is shell behavior may remain shell.

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

CI runs the canonical package gate on Linux and macOS for every declared Python
minor version when that package or shared Python-quality infrastructure changes.
Packages that claim native Windows support run the same change-scoped gate in a
package-specific Windows matrix. Manual dispatch runs every package. The
inventory guard runs on every workflow invocation, and a stable aggregate
`Python quality` status verifies that every required scope passed or every
unchanged scope was intentionally skipped. The inventory guard itself is tested
by introducing a temporary unregistered package and proving that the gate
refuses it.

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
