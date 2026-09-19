# Issue 77 verification and matched benchmark

Measured on 2026-09-10, macOS arm64, UV-managed Python 3.13.14, Langfuse
SDK 4.14.4. Control is commit `17b8617090c3d005d7cf29f8bdb5053345580787`;
candidate is the implementation in this change. Three fresh-process trials per
condition, interleaved control/candidate at 100, 500, and 1,000 turns. Production
candidate code, including the closed-set review repairs, was held constant
throughout these retained trials. These measurements supersede the pre-review
and first-repair runs.

## Inputs and measurement boundary

Both implementations receive identical deterministic append-only JSONL. Every
turn has one root, one generation, two tools, and valid token usage. One
subagent with one generation is attached every 100 turns (fan-out one on those
turns, zero otherwise). Content export is disabled. The source/hash checks below
include the main rollout and generated subagent content.

Both use the locked Langfuse SDK and the same in-process counting SpanExporter:
no network delay, rejection, or actual remote ingestion in this benchmark.
Control uses its original `flush_at=1`, full reconstruction, sidecar filtering,
and synchronous export. Candidate uses transactional incremental capture,
bounded batching, and a separate drain call after foreground capture returns.
Acknowledgment here means acceptance by that counting exporter.

Bytes count main/subagent rollout payload reads, including repeated historical
reads; filesystem metadata, directory enumeration, SQLite, and legacy sidecar
I/O are excluded. Foreground time is cumulative across Stop captures and includes
control's synchronous export. Total time includes drain work and fixture append
work. UV/Python/SDK startup is outside wall timing; peak RSS includes the entire
worker process. Each workload is generated and run in a fresh temporary directory.

## Results

Medians of three trials; peak RSS is the median of per-process high-water marks.
All trials acknowledged every turn and produced the same observation count.

| Turns | Implementation | Rollout bytes read | Exporter calls | Observations | Foreground s | Total s | Peak RSS MiB | Delivery               |
| ----- | -------------- | -----------------: | -------------: | -----------: | -----------: | ------: | -----------: | ---------------------- |
| ----- | -------------- | -----------------: | -------------: | -----------: | -----------: | ------: | -----------: | ---------------------- |
| 100   | control        |            5574195 |            402 |          402 |       1.9654 |  1.9774 |        61.22 | 100/100 acknowledged   |
| 100   | candidate      |             109746 |            100 |          402 |       1.7251 |  2.1333 |        61.72 | 100/100 acknowledged   |
| 500   | control        |          137647995 |           2010 |         2010 |      13.6322 | 13.6968 |        68.80 | 500/500 acknowledged   |
| 500   | candidate      |             548934 |            500 |         2010 |       8.5024 | 10.3959 |        63.53 | 500/500 acknowledged   |
| 1000  | control        |          549783495 |           4020 |         4020 |      37.6966 | 37.8334 |        71.19 | 1000/1000 acknowledged |
| 1000  | candidate      |            1097919 |           1000 |         4020 |      17.6872 | 21.5595 |        64.75 | 1000/1000 acknowledged |

### Retained trial measurements

| Turns | Implementation | Trial | Foreground s | Total s | Peak RSS bytes |
| ----- | -------------- | ----- | -----------: | ------: | -------------: |
| ----- | -------------- | ----- | -----------: | ------: | -------------: |
| 100   | control        | 1     |       2.0747 |  2.0882 |       64356352 |
| 100   | candidate      | 1     |       1.7496 |  2.1397 |       64667648 |
| 500   | control        | 1     |      13.7097 | 13.7759 |       72302592 |
| 500   | candidate      | 1     |       8.4663 | 10.3289 |       66617344 |
| 1000  | control        | 1     |      37.6966 | 37.8334 |       76578816 |
| 1000  | candidate      | 1     |      18.0397 | 21.9648 |       64716800 |
| 100   | control        | 2     |       1.9654 |  1.9774 |       64159744 |
| 100   | candidate      | 2     |       1.6483 |  2.0316 |       64716800 |
| 500   | control        | 2     |      13.6282 | 13.6922 |       72138752 |
| 500   | candidate      | 2     |       8.9464 | 10.9212 |       64667648 |
| 1000  | control        | 2     |      38.3887 | 38.5283 |       73891840 |
| 1000  | candidate      | 2     |      17.6872 | 21.5595 |       67895296 |
| 100   | control        | 3     |       1.9247 |    1.94 |       64192512 |
| 100   | candidate      | 3     |       1.7251 |  2.1333 |       64897024 |
| 500   | control        | 3     |      13.6322 | 13.6968 |       71483392 |
| 500   | candidate      | 3     |       8.5024 | 10.3959 |       66682880 |
| 1000  | control        | 3     |      37.3474 |  37.473 |       74645504 |
| 1000  | candidate      | 3     |      17.5365 | 21.4153 |       68091904 |

### Input SHA-256

- 100 turns: `71483221c68dff66e52eeaf6d4732d55a181616d52b52580151f4621a496bbdc`
- 500 turns: `9d68377da9aa8d266e36a89087605710651db4452bda3a4e5090d161784af2d9`
- 1000 turns: `1fda5c1a4b2cb7fc135b1092b172b2d22e57c988d033ded36a6a717e58833b1d`

## Reproduce

From the repository root, export the control source into an empty temporary
directory:

```sh
control_dir=$(mktemp -d /tmp/darrow-77-control.XXXXXX)
git archive 17b8617090c3d005d7cf29f8bdb5053345580787 plugins/capability/darrow-observability-langfuse/backend/src |
  tar -x -C "$control_dir"
```

For each of 100, 500, and 1000 turns, run each command three times in fresh
processes, substituting the chosen turn count. The retained run interleaved the
two commands for each size before advancing to the next trial.

```sh
uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend \
  python plugins/capability/darrow-observability-langfuse/backend/tests/benchmark_capture.py \
  --source "$control_dir/plugins/capability/darrow-observability-langfuse/backend/src" \
  --mode control --turns 1000

uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend \
  python plugins/capability/darrow-observability-langfuse/backend/tests/benchmark_capture.py \
  --source "$PWD/plugins/capability/darrow-observability-langfuse/backend/src" \
  --mode candidate --turns 1000
```

## Regression and failure evidence

The original counting-exporter reproducer failed with 201 one-span calls for
one root plus 200 observations. The candidate passes with one 201-span batch.
The real HTTP test additionally exports 3,001 observations in batches no larger
than 512 without losing spans.

The backend suite covers incremental/repeated reads; incomplete trailing lines;
parser version rebuild, replacement and truncation; legacy migration;
subagent/model/token parity; attribution epochs and retry snapshots; duplicate
turn IDs; opt-in privacy and credentials; reordered concurrent capture;
single-drainer ownership; capture during delayed delivery; process termination
during capture and delivery; atomic rollback; definite connection refusal and
HTTP rejection; response loss after acceptance; standard and Langfuse queue
responses; partial ingestion; quarantine without blind retries; and later
SessionStart/UserPromptSubmit backlog recovery. Foreground invocation returns
without making any request to the controlled delayed endpoint, and succeeds
against an unavailable endpoint.

```sh
uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend \
  python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -q
```

Run the package, Stop reconstruction, and failure checks with
`uv run --quiet --frozen --all-groups --project backend pytest backend/tests/test_packaged_hooks.py backend/tests/test_hook_failures.py`,
relative to the plugin root. The launcher scenarios run under both `bash` and
`/bin/bash` through pytest.
The export-failure launcher check now supplies valid session/turn IDs and checks
successful local capture followed by a failing background drain, rather than
mistaking malformed input for exporter failure.

## Closed-set review repair evidence

The comprehensive review reported three blockers: premature provisional freezing,
a generic index row mistaken for final-capture completion, and definite invalid-URL
failures quarantined as uncertain. The user resolved the lifecycle choice explicitly:
own Stop is authoritative while live, Interrupt is abortion, SessionEnd seals
remaining gaps locally, and later asynchronous session/prompt hooks drain them.
The spec was updated before these repairs. Fourteen lifecycle tests also cover
SQLite-lock-independent terminal writes, capture/receipt ordering with a blocked
foreground transaction, terminal receipt survival after cancelled materialization,
replacement and resumed append boundaries, frozen content policy, and late-hook
idempotence. Existing historical-delivery tests were adjusted only where the
approved gap policy now requires an own Stop or terminal watermark.

Observed test-first slices, in execution order:

### Out-of-order final attribution

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: exported the earlier provisional trace before its own Stop.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 1 test passed.

### SessionEnd local sealing

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: refused SessionEnd because turn_id was missing.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 2 tests passed.

### Cross-session recovery

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: a new session exported no prior sealed backlog.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 3 tests passed.

### Active-turn watermark boundary

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: a resumed append left the sealed active turn undelivered.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 8 tests passed.

### Invalid URL pre-request failure

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_delivery.py -k invalid_url -q`: classified the envelope uncertain instead of pending.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_delivery.py -k invalid_url -q`: 1 test passed.

### Terminal hook packaging

Red — `bash plugins/capability/darrow-observability-langfuse/tests/package.test.sh`: Interrupt had no bounded synchronous local registration.

Green — `bash plugins/capability/darrow-observability-langfuse/tests/package.test.sh`: package tests passed.

### Missing terminal attribution stays missing

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: used the TOO-LATE provisional work item after sealing.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 9 tests passed.

### Repeated Stop after terminal sealing

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: did not recognize the already durable terminal receipt.

Green — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -q`: 13 tests passed.

### Delayed Stop without task_complete

The first fix verification resolved all three original findings but found a
direct regression: a delayed Stop receipt did not complete an earlier stored
turn already closed by a later task_started. The user authorized one additional
closed-set repair. That transaction now also marks the stored turn completed;
it does not replace existing terminal receipts or finalized envelopes.

Red — `uv run --quiet --frozen --project plugins/capability/darrow-observability-langfuse/backend python -m unittest discover -s plugins/capability/darrow-observability-langfuse/backend/tests -p test_lifecycle.py -k delayed_stop -v`: exported no turns instead of both authoritative turns.

Green — the same command: 1 test passed. It also checks ordered attribution,
no foreground export, and repeated-hook idempotence. The first verifier's exact
two-task_started/no-task_complete counterexample passes unchanged.

Final backend result: `Ran 58 tests in 9.227s — OK`. Both Bash launcher suites,
ShellCheck, and the final formatted documentation/manifests are checked again
against the pinned repair target before independent fix verification.

## Real isolated Langfuse ingestion

Docker Engine 29.3.1 and Compose 5.1.1 were available. The
[official Compose definition](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml)
was started as isolated project `darrow-77-smoke-repair2-20260910`, with an independent
project/key fixture and web port `127.0.0.1:23077`; unrelated existing containers
were untouched. Health reported Langfuse 4.16.0.

`backend/tests/smoke_ingestion.py` captured and drained the nested fixture using
project-scoped test credentials supplied by environment. It returned:

```json
{
  "state": "acknowledged",
  "trace_id": "e6a1f59354c2c30cfa384bde1c029341",
  "expected_observations": 6,
  "bytes_read": 3720,
  "rebuilt": 1
}
```

A read-only query of that isolated deployment's `events_full` table found all
six observations, three generations, one tool, the single attribution session,
and `SMOKE-77` work-item metadata. The trace ID matched the envelope's
deterministic ID. Only this smoke project's six containers, network, and five
temporary volumes were removed afterward; its test data is disposable and can
be recreated by the smoke procedure.

The real server returned a JSON `otel-ingestion-job` receipt, which differs
from the standard OTLP protobuf response. Initial smoke probes quarantined that
unrecognized response despite server acceptance. Support and a regression case
were added, and the retained successful smoke used a fresh session identity.
No uncertain probe was blindly retried.

## Limits

The benchmark supplies each turn's own Stop in order. Terminal watermarks,
out-of-order gaps, and cross-session registry recovery are exercised by the
lifecycle suite, not this timing workload. Terminal handlers have Codex's
three-second maximum and avoid capture/database locks; a cold UV/dependency
startup or abnormal process termination can still prevent a receipt from being
written. Receipt persistence is not a guarantee that a future lifecycle event
will occur. Dependent turns wait while a session is live; SessionEnd seals them
locally, and a later asynchronous session/prompt hook performs delivery.

These are three deterministic trials on one machine, not a production latency
or reliability distribution. Small generated turns and sparse fan-out do not
cover every real conversation shape. Network-independent foreground behavior
is proved separately from the benchmark; the timing table is not a WAN
throughput claim. Native hook registration and cancellation mechanics are
tested at configuration/process boundaries, not by changing this user's
installed/trusted Codex hooks.

Initial indexing still reads existing history. An active turn or referenced
subagent can itself be large; disk storage retains envelopes and index evidence.
Filesystem identity/size checks detect replacement and observed truncation;
a file truncated and rewritten past its previous length between captures on
the same inode is outside the append-only rollout assumption. HTTP acceptance
acknowledges a request, not a guarantee of every downstream storage operation.
Unknown outcomes remain quarantined for manual reconciliation using the
delivery ID and expected observation count. There is no exactly-once claim.
