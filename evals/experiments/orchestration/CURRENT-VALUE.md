# Current Codex value benchmark

Compare the current Adaptive Goal with vanilla on the four historical OSS tasks:
Click streams, Ajv instance paths, go-git insteadOf and Express Link headers.
Measure ticket-to-PR delivery separately against vanilla delivery on those same
engineering requirements. The recipe delegates to the current Adaptive Goal.

The main thread uses `gpt-6.1-sol/medium`; Adaptive Goal chooses implementation
routes using its current policy. Each calibration cell has one trial and a
threshold of 1. Advisory judging is omitted during calibration. Hidden behavior
checks remain the primary code-quality outcome. This is a workflow comparison,
not a skill-only ablation or a reliability claim.

Prepare the pinned upstreams and freeze a new candidate snapshot outside the
repository. The output directory must not exist:

```sh
bun evals/corpus/orchestration/prepare.ts \
  --source click-8.0.0 --source ajv-8.5.0 \
  --source go-git-5.4.2 --source express-4.17.1
bun evals/experiments/orchestration/prepare-value.ts \
  --output /absolute/path/to/current-value-n1
```

The snapshot preserves the historical prompts and source revisions, and uses the
current canonical behavior checks verbatim. Generated implementation cases add the applicable current capabilities.
Delivery cases replace the no-publication authority envelope and expose the
same engineering requirements as isolated GitHub issue 1. Snapshot packaging
omits development tests, evals, caches, Claude scoped-agent descriptors and plugin entry READMEs to fit the
installed runner's artifact and setup-environment limits. Skill instructions,
references, hooks, backend sources, manifests and dependency locks are preserved.
The manifest records these exclusions and the historical case digests.

Run one exact cell at a time. Use `--dry` first, then omit it for the paid trial.
Inspect each failure before starting another cell:

```sh
bun evals/experiments/orchestration/run-value.ts \
  --snapshot /absolute/path/to/current-value-n1 \
  --output /absolute/path/to/current-value-n1/dry-adaptive-express \
  --track implementation --mode adaptive-goal --case express-links --dry
```

Implementation modes are `vanilla` and `adaptive-goal`; delivery modes are
`vanilla` and `ticket-to-pr`. Cases are `ajv-instance-path`, `click-streams`,
`express-links` and `go-git-insteadof`. Use a fresh output directory for every
invocation. Eight implementation cells and eight delivery cells complete N=1.
The caller uses Sevro's native app-server transport and passive observation,
with one worker, a 30-minute native-host limit and retained startup diagnostics. Vanilla mounts no plugins;
candidate cells mount only the skills needed for their track and allow the
current Review, TDD and Tickets reminders. Native activation and capability
consumption must be inspected separately from code acceptance.

Full delivery uses a real local bare Git remote through a local SSH transport,
an isolated forge and one required CI check. Delivery history has an explicit
shallow boundary at the pinned fixture baseline; older partial-clone objects
are not needed for publication. Commit identities and engineering content stay
unchanged.

A per-cell localhost CI fixture runs in the benchmark caller and stops when the
cell ends. It holds the original ticket requirements and check command, runs
that command on the exact clean published checkout, and keeps CI evidence
outside candidate-writable state. The protected grader queries that service;
candidate-written success records cannot satisfy it. The delivery oracle requires
the final checkout, remote branch and open PR to agree, a genuine passing CI
observation for that commit, and a handover naming its commit and PR. No real PR
is published. The forge remains a simulated service, so these results do not
measure GitHub network reliability or hosted CI queue time.

Per-cell `suite-run.json`, Sevro results, quality reports and native observations
remain outside the repository. Report task outcomes, delivery completion,
wall time, tokens, usage completeness, actual routes and human interventions
separately. Missing cost stays unknown. The original August snapshot used other
models, host versions and an older evaluator, so its performance numbers remain
historical context. Full delivery duration measures additional work and is not
a matched latency comparison with the old no-publication runs.

Recover October's retained native token counters without another model call:

```sh
bun evals/experiments/orchestration/recover-value-usage.ts \
  --snapshot /absolute/path/to/2026-10-30-codex-n1.json \
  --output /absolute/path/to/2026-10-30-codex-n1-usage.json
```

This retrospective checks artifact hashes, counts each parent and child session's
final cumulative counters once, and preserves partial captures as lower bounds.
Its dated Standard API-equivalent estimates are separate from actual charges
and do not replace the original host-reported null fields. The source snapshot's
raw evidence paths must still exist. The recorded pricing supports the observed
Sol 6.1 and Luna 6 sessions below 272K input tokens with zero cache writes;
incompatible inputs fail explicitly rather than receiving an invented price.

Keep an interrupted host's `not_assessed` outcome separate from code or delivery
failures. Report its attempted duration, but exclude it from completed-trial
latency means and show the missing task beside paired comparisons. The installed
Sevro 1.1.1 app-server capture has a fixed 8 MiB cumulative event-stream limit;
the October Click delivery attempt reached it before grading. Resolve that host
limit and freeze the changed evaluator before retrying that cell.

The four prompts and upstream pins match the August 7 benchmark. Since then,
Click gained an unflushed-write check, Ajv gained malformed-value path checks,
and go-git gained deterministic serialization coverage and a public config seam
in place of a private helper assertion. Repository inspection guidance and Go
cache setup also changed. Preserve these grading differences beside the model
and evaluator differences when interpreting the historical pass rates.
