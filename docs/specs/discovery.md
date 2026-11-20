# Discovery retirement

Standalone `darrow-discovery` is retired under [migration #328](https://github.com/BjRo/darrow/issues/328)
and [ticket #338](https://github.com/BjRo/darrow/issues/338). Its retained
responsibilities are supplied by the [Matt Pocock bundle](matt-pocock.md).

Use its selected grilling, wayfinder, grill-with-docs and specification/planning workflows. Their upstream activation and publication boundaries replace the former unified read-only protocol; the frontier renderer and exact subject-question contract are retired.

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

- [Former plugin](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/capability/darrow-discovery)
- [Former contract](https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/discovery.md)
