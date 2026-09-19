# Ticket pipeline migration evidence

`reference.json` contains observations from the unmodified 0.2.3 Bash facade,
at source revision `0d5675f06feecf68110afd0718756a0391de720a`,
executing its complete `ticket-pipeline.test.sh` suite on macOS `/bin/bash` 3.2.
It captures 94 individual public command invocations (the original 85 plus
nine baseline-matched review regressions), input snapshots, exit
codes, stdout records, and SHA-256 hashes of candidate ticket bytes. Input
snapshots are deduplicated by hash. Only the temporary root is normalized to
`<ROOT>`; artifact evidence, whitespace, routes, phase state, and ledger order
remain unchanged. Error diagnostics are checked for presence, not exact wording.

Coverage includes initialization, durable launches, uncertain resume, artifact
refusals, refinement/challenge recovery and exhaustion, review/rework and QA/fix
limits, verified finish, escalation, and contradictory retained evidence.
`test_reference.py` replays these observations through the Python command seam
on every native platform without needing the removed Bash implementation.
`test_scenarios.py` ports the meaningful shell assertions into readable Python
integration scenarios through the public CLI: initialization and user-work
preservation, all normal phases, refinement and both repair loops, exhaustion,
escalation, uncertain children, and malformed retained artifacts. The old shell
test is removed. Additional boundary and property tests cover invalid inputs,
Unicode artifact round trips, native filesystem paths, and publication races.

Run from the repository root:

```sh
bun run check:python -- --package plugins/orchestration/darrow-ticket-pipeline/backend
uv run --quiet --frozen --no-dev --project plugins/orchestration/darrow-ticket-pipeline/backend python plugins/orchestration/darrow-ticket-pipeline/backend/tests/fresh_install.py
```

Repository benchmark fixtures remain in the orchestration experiment suite.
The fixture prompts, acceptance oracles, phase skills, result protocol, and
child/interruption counters are unchanged. Compare with the same fixture,
harness version, model, effort, trial count, and checks; record the plugin
version and Python/UV versions because startup cost may differ. Mechanical
parity does not establish a live-model performance improvement or a new
cross-host orchestration success rate.
