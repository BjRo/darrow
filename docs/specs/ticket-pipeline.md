# Ticket Pipeline retirement

Ticket Pipeline is retired as an installable runtime and executable benchmark.
Use [Adaptive Goal](adaptive-goal.md) for explicitly requested orchestration.
The retirement implements [migration #328](https://github.com/BjRo/darrow/issues/328)
and [ticket #337](https://github.com/BjRo/darrow/issues/337).

## Retirement invariants

- **TP-R1 — No maintained execution surface.** Remove the
  `plugins/orchestration/darrow-ticket-pipeline` package, its skills, backend,
  colocated evals, and dedicated CI/install checks. Do not retain an executable
  alias, compatibility shell, or active pipeline benchmark condition or mode.
  Verify maintained package payload and public entrypoints are absent. Preserve
  ignored developer caches and other user-owned local state; their containing
  directory alone does not constitute a maintained package.
- **TP-R2 — Preserve historical evidence.** Keep original reports, snapshots,
  dates, limitations, and observations unchanged. Preserve the complete former
  source and contract through the immutable revision below. Historical commands
  describe that revision; they are not supported current entrypoints.
- **TP-R3 — Preserve surviving consumers.** Remove only pipeline-owned
  configuration and fixture state after checking consumers. Shared Sevro
  callers, benchmark policy, corpus fixtures, ticket helpers, and checks remain
  when they serve Adaptive Goal, Review, Artificer, or other surviving work.
- **TP-R4 — Coordinate publication.** Remove the marketplace entry with the
  parent migration's final cutover after compatible survivors are ready.
  Marketplace removal does not uninstall cached copies; the cutover must include
  uninstall/reinstall and fresh-session guidance. No separate legacy release is
  maintained.

## Immutable source and evidence

The last source baseline before this retirement is
`de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89`:

- [Complete former plugin](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/orchestration/darrow-ticket-pipeline)
- [Former contract and invariants](https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/ticket-pipeline.md)
- [Former benchmark configuration and reports](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/evals/experiments/orchestration)
- [Retained 2026-08-07 observations and limitations](../../evals/experiments/orchestration/snapshots/2026-08-07-n1.md)
- [Retained machine-readable results](../../evals/experiments/orchestration/snapshots/2026-08-07-n1.json)

The executable-reference clauses in ADR-0004 and ADR-0012 are superseded by this
retirement. Their native-goal ownership decisions retain their existing status.
Historical pipeline measurements do not establish current host compatibility
or a reproducible supported execution path.
