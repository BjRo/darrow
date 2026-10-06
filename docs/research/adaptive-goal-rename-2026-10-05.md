# Adaptive Goal naming change

Adaptive Goal 0.25.0 renames the orchestration plugin and its public entrypoints.
Its [normative contract](../specs/adaptive-goal.md) retains main-thread native goal
ownership, risk-selected bounded implementation, separate verification and review
coordination, reviewer model selection and the shared two-attempt repair allowance.

## Current names

| Surface               | Previous name                                           | Current name                                    |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Plugin                | `darrow-adaptive-delivery`                              | `darrow-adaptive-goal`                          |
| Orchestration skill   | `adaptive-delivery`                                     | `adaptive-goal`                                 |
| Diagnostic skill      | `doctor-adaptive-delivery`                              | `doctor-adaptive-goal`                          |
| Preflight command     | `adaptive-delivery-preflight`                           | `adaptive-goal-preflight`                       |
| Fixture command       | `adaptive-delivery-fixture`                             | `adaptive-goal-fixture`                         |
| Python package/module | `darrow-adaptive-delivery` / `darrow_adaptive_delivery` | `darrow-adaptive-goal` / `darrow_adaptive_goal` |

The marketplace, both host manifests, scoped Claude agent names, active skill and
eval bindings, package inventory, CI jobs and current documentation use the new
identity. Ticket-to-PR and Artificer reference Adaptive Goal through their existing
capability boundaries. No new runtime, continuation loop or routing policy is added.

## Historical evidence

Research prose uses the current name. Historical report filenames, recorded
commands and identifiers, frozen snapshots, hashes, local result paths and trial
counts retain their recorded values. Naming notes identify that distinction in
updated research reports. A historical `adaptive-delivery` invocation is evidence
about its recorded candidate, not a fresh trial of the renamed release.

The eval runner retains the exact historical shell-helper filename used by its
separate-owner control. That lookup is not an alias or fallback for the current
Python entrypoint. Previously saved evidence is not rewritten or regraded by this
rename, and the rename does not establish a behavioral reliability improvement.

## Installation

Follow the [plugin upgrade instructions](../../plugins/orchestration/darrow-adaptive-goal/README.md#upgrade-from-adaptive-delivery).
Install the new plugin, remove the old plugin registration and update any explicit
local bindings. Installed host caches and user configuration are outside this
repository change; they are not modified automatically.

## Validation

- Documentation validation passes for 272 Markdown pages and 16 plugins, including
  runtime launchers and both repository-guide entrypoints.
- The full Python quality gate passes for all 12 registered packages: frozen
  resolution, formatting, lint, strict typing, tests and coverage thresholds.
- The affected runner tests and selection tests pass: 388 tests across 23 files.
  Initial attempts hit interpreter-bootstrap timeouts in the isolated checks,
  where UV could discover only Python 3.9.6. Subsequent checks expose the already
  installed compatible Python on the test process's PATH; the readiness test
  command allows 30 seconds for cold bootstrap. No runner source or product
  prerequisite was changed to accommodate that environment.
- The fresh copied-plugin smoke passes host diagnosis, both hosts' routes,
  scoped Claude agent names, linked worktrees and isolated fixture entrypoints.
- Marketplace installation checks pass with both tested Bash executables. Guide
  fixtures, Python inventory and CI package-selection checks also pass.
- TypeScript typing, scoped lint, changed-file formatting, SVG parsing and
  `git diff --check` pass. All 135 owning-plugin files are accounted for; all
  23 frozen snapshot files are byte-identical, and recorded fenced code and
  result paths are preserved across the research reports.

No live model evals or installed-host activation trials were run for this rename.
These deterministic checks establish naming and packaging consistency, not a new
behavioral pass rate.
