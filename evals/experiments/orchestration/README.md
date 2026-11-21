# Orchestration experiments

Compare current workflows against explicit controls on pinned engineering tasks.
Active YAML suites, conditions and hidden checks live beside this file. Results
belong outside tracked documentation; completed trial snapshots are in Git history.

Prepare the pinned corpus before running a suite:

```sh
bun run eval:orchestration:prepare
bun run eval:orchestration -- --help
```

Choose a suite and run one focused dry cell before a paid trial. Read
[eval development](../../../docs/eval-development.md) for the live-run controls,
failure ownership and evidence interpretation. Use the suite caller's actual
`--help` for selection, host and result-root options.

The default [suite](suite.yaml) compares vanilla, native-goal and Adaptive Goal
conditions. Other suites exercise routing, profiles and adaptation. These
comparisons do not establish a benefit until measured on matched conditions.

For a frozen current-candidate comparison, follow
[the current-value benchmark](CURRENT-VALUE.md). It tests implementation and
full ticket-to-PR delivery separately using local isolated publication and CI.
Do not compare those tracks as equal amounts of work or infer hosted GitHub
reliability from simulated services.

Record trial count, requested and observed routes, task and delivery outcomes,
usage completeness, wall time and human interventions separately. A single trial
is an observation, not a reliability estimate. Incomplete evidence stays unknown.
