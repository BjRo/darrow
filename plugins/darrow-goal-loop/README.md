# Darrow Goal Loop

This plugin is a bounded adaptive loop for one local engineering goal. It
chooses the shortest safe route from the shape and risk of the work instead of
forcing every task through the same sequence. A mechanical change may need only
an executor; ambiguous or architectural work can add planning; ordinary code
changes receive independent verification.

The loop is an explicitly invoked composition of native child agents. It is not
a daemon, queue, autonomous backlog worker, or general workflow runtime.

## What it provides

### `pursue-goal`

Runs one bounded goal to a verified local working tree. It assigns fresh
planner, executor, verifier, and optional repair roles as needed, permits only
one active writer, and allows at most one repair followed by fresh verification.
The controller keeps packets and orchestration state outside the target
repository.

Example: _“Use pursue-goal to add CSV export with regression coverage.”_

### `check-goal-readiness`

Reports which same-harness and cross-harness routes are ready, degraded, or
blocked. It checks static executables, configuration, credentials presence, and
host capabilities without making a model call or changing setup.

Example: _“Check goal-loop readiness for Codex.”_

### `bin/goal-loop`

A portable Bash control-plane helper. It performs preflight checks, selects
model/effort routes from `config/routes.tsv`, creates and validates role
packets, snapshots the working tree, validates results and gates, bridges to a
supported alternate harness, and emits optional OpenTelemetry evidence.

### Role and result protocols

The `pursue-goal` skill includes explicit child, repair, and result protocols.
They give each fresh role a bounded packet and make the final outcome
mechanically comparable without persisting a workflow database in the
repository.

## How the loop adapts

- Complete mechanical work can take the executor-only fast path.
- Clear code or behavior changes use executor then independent verifier.
- Cross-cutting, risky, or materially ambiguous work adds a fresh planner.
- One actionable verification failure may route to one repair executor and a
  new verifier; a second failure ends the run honestly.

## Design boundaries

- The loop may edit only the local working tree. It never branches, commits,
  pushes, opens a pull request, merges, releases, deploys, or mutates another
  external system.
- Planning and verification roles are read-only for product files.
- Human gates and unavailable evidence stop the loop rather than being routed
  around.
- Telemetry is optional and contains orchestration evidence, not repository
  contents or secrets.
