# Verification retirement

Standalone `darrow-verification` is retired under [migration #328](https://github.com/BjRo/darrow/issues/328)
and [ticket #338](https://github.com/BjRo/darrow/issues/338). Its retained
responsibilities are supplied by the [Adaptive Goal acceptance accounting](adaptive-goal.md#acceptance-accounting-and-independent-review).

The active goal owner maps every material criterion to current evidence or an explicit gap, preserves assessment and repair history, and consumes independent [Review](code-review.md) through its public contract. Review clearance alone does not establish acceptance. The standalone coordinator, renderer and provider aliases are retired.

## Retirement invariants

- Remove the standalone plugin payload, public entrypoints, exclusive backends,
  eval suites, runtime profiles, inventory registrations and CI obligations.
  Keep no executable alias or compatibility shell.
- Migrate active consumers before removing their old provider. Keep shared
  assessment, evidence, fixture and evaluation tools with surviving callers.
- Preserve historical reports and snapshots unchanged. Retain ignored developer
  caches and user-owned configuration; an ignored directory is not a maintained
  plugin package.
- Verify absence at the repository cutover boundary and retained behavior at the
  existing package and public-operation seams. Package checks do not establish
  native activation or task success.
- Coordinate marketplace removal and consumer uninstall/reinstall and fresh-session
  instructions with the parent migration's final cutover.

## Immutable source

The former implementation and contract remain available at the migration baseline:

- [Former plugin](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-verification)
- [Former contract](https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/verification.md)

[Original standalone acceptance observations](../../evals/experiments/verification/snapshots/retired-acceptance-evidence.md)
are preserved byte for byte. Their commands target the former source revision.
