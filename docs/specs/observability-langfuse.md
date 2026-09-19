# Capability: Langfuse observability

## Purpose

Darrow should provide an independently installable Codex plugin that turns
completed Codex rollout turns into coherent Langfuse traces. The plugin is
oriented on `langfuse/codex-observability-plugin`, while adding externally
meaningful work-item attribution without depending on any other Darrow plugin.

The plugin is observability infrastructure, not orchestration. It observes host
lifecycle data and must never create work, alter a ticket, or control a Codex
session.

## Plugin boundary

`darrow-observability-langfuse` is a self-contained capability plugin. Its
manifests, hook registration, executable hook, Python package, UV lock,
configuration guidance, tests, evals, and documentation all live inside its
plugin directory. It does not reference another Darrow plugin or skill.

This capability is an explicit, issue-authorized exception to Darrow's default
portable-Bash plugin-runtime boundary. The deterministic host launcher uses
Bash on Linux and macOS and native Windows PowerShell on Windows; trace
reconstruction and export use Python managed by UV on every platform. The
plugin declares and locks its Python dependencies and refuses safely when UV
or the managed environment is unavailable. This exception is local to this
plugin and does not change the default boundary for other plugins.

## Runtime contract

Codex invokes the plugin on `UserPromptSubmit` to capture provisional
attribution and on foreground `Stop` to finalize attribution and local capture.
`Interrupt` records explicit abortion; `SessionEnd` records a terminal watermark.
Separate asynchronous lifecycle hooks deliver the captured envelopes. Hooks supply
a JSON object on standard input. The Stop hook accepts a readable absolute
`transcript_path` to a Codex rollout JSONL file. It reads that file without
modifying it and reconstructs:

- one trace for each observed turn;
- one native Langfuse session segment for each attribution epoch in a Codex
  conversation, while preserving the Codex session/thread identifier on every
  trace as the cross-segment conversation key;
- model generations and their model name, reasoning summary, output, and valid
  token counts;
- tool observations with inputs, outputs, timing, error state, and concise
  invocation labels derived from their parameters when content capture is
  enabled; and
- subagent turns nested below the turn that spawned them when the referenced
  rollout is readable.

The UserPromptSubmit payload's non-empty `turn_id` identifies the turn about to
start. The hook records only its provisional fallback attribution and Git
provenance in the plugin's writable data directory; it never persists the
submitted prompt. The Stop payload's non-empty `turn_id` identifies the turn
being completed and is authoritative even when the rollout writer has not
appended its trailing `task_complete` record yet. Only rollout-completed turns,
the current Stop turn, and turns sealed by Interrupt or SessionEnd are eligible
for export. Before export, Stop records
the current turn's final fallback attribution and Git provenance atomically in
a plugin-owned sidecar next to the rollout, replacing its provisional evidence
for reconstruction. While the session is live, a completed non-aborted turn
without its own final Stop receipt remains local. Dependent later turns remain
local too, so their ordered attribution epochs are not frozen prematurely.
A rollout-aborted turn that never reaches Stop uses its
provisional snapshot. Before exporting that completed turn, Stop promotes the
provisional snapshot into the rollout sidecar so later reconstruction cannot
renumber an already-exported epoch. If neither snapshot exists, the trace
retains its Codex thread identifier but receives no attribution epoch or native
Langfuse session association; missing evidence never creates an epoch
transition.

Confirmed request acceptance acknowledges the immutable turn envelope in the
rollout sidecar so repeated Stop events do not export it again. Attribution evidence
survives a failed export and makes a later retry independent of subsequent
configuration, branch, or HEAD changes. Malformed JSONL records are ignored,
but an unreadable `transcript_path`, missing original Codex thread ID, invalid
plugin state, or a `turn_id` that does not match exactly one reconstructed turn
is a refusal rather than a fabricated success.

The hook fails open by default: configuration, parsing, dependency, network, or
export failures do not block the Codex turn. An explicit strict test/debug
setting may make those failures nonzero so installation and exporter failures
are observable.

## Incremental capture and durable delivery

Foreground Stop performs only local capture. It commits its authoritative final
receipt together with captured turn data before background delivery may contact
Langfuse. It materializes the resolved ordered prefix as immutable delivery
envelopes; turns behind an unresolved attribution gap remain local capture data,
not prematurely frozen envelopes. A turn's own Stop supersedes provisional
evidence and resolves that gap. Repeated Stop receipts retain the first final
snapshot for retry stability. A generic index row is never a final-capture receipt.
Codex-native asynchronous command hooks drain those envelopes at Stop and at
later session/prompt lifecycle events. No daemon, collector, or per-tool
streaming is introduced. A cancelled background hook leaves durable work for
the next lifecycle invocation.

Interrupt is explicit abortion and resolves its turn from provisional evidence
unless final Stop evidence already exists. SessionEnd is the terminal watermark
for the observed rollout identity and byte boundary: it seals remaining
missing-Stop turns from the provisional evidence available at that boundary.
It never substitutes current configuration or Git state for missing evidence.
Terminally sealed or delivered evidence is not retroactively changed by a late
hook. Appended turns after that watermark belong to the resumed live session
and require new terminal evidence.

Interrupt and SessionEnd handlers perform bounded durable local receipt writes
only, respecting Codex's three-second maximum; SessionEnd never starts remote
delivery. The next asynchronous session or prompt lifecycle hook resumes local
indexing/materialization from those receipts, then drains the backlog. A private
plugin-data registry retains rollout locations so a later session can recover
an earlier session's sealed backlog. Termination during finalization leaves the
receipt available for another lifecycle attempt.

Capture persists a versioned JSONL cursor: rollout identity, committed byte
offset, incomplete trailing bytes, active parser/turn state, attribution mode,
epoch, previous effective attribution, and referenced subagent cursors. After
initial indexing it reads only appended bytes and newly referenced subagent
data. Replacement, truncation, or an incompatible parser version causes a safe
rebuild from available evidence; it never invents a session, turn, or epoch.
Validated legacy sidecars remain evidence of previously uploaded turns and
already-final snapshots. Local unresolved turns retain redacted parser data
until an authoritative receipt allows privacy-filtered envelope materialization.

Local capture transactions and each session's single background drainer use
separate cross-process locks on Linux, macOS, and native Windows. State updates
are atomic and durable. Concurrent and reordered hooks cannot overwrite another
hook's capture or acknowledge work they did not deliver. Network waits never
hold the capture lock.

Every envelope has a stable identity, an expected observation count, a frozen
privacy-filtered trace document, and exactly one state: `pending`,
`acknowledged`, or `uncertain`. Definite pre-acceptance failures retain pending
work. Confirmed complete acceptance acknowledges it. Before a network attempt,
delivery durably records uncertainty so process termination cannot turn an
ambiguous attempt into an automatic retry. Response loss, partial ingestion,
or interruption after an attempt begins leaves the envelope quarantined as
uncertain, with identity and expected count available for reconciliation.
Uncertain envelopes are never blindly retried; this is not an exactly-once
delivery guarantee.

OTLP export uses bounded batches at the supported traces endpoint and retains
the Langfuse SDK/version and current-ingestion headers. A trace containing one
root and 200 observations must require exactly one exporter request. Foreground
completion must be independent of remote delay or unavailability. Dry-run
retains its existing full-document output and makes no durable or remote writes.

## Configuration and privacy

Tracing is disabled until explicitly enabled and valid Langfuse credentials are
available. Configuration may come from environment variables, a user-level
Codex configuration file, or a repository-level Codex configuration file. More
specific sources override defaults in this order: user file, repository file,
then environment.

Raw prompts, reasoning, tool inputs, tool outputs, and assistant text are not
exported unless content capture is separately enabled. When content capture is
disabled, observation structure, names, status, timing, model identity, and
token counts remain observable, but tool names stay generic and contain no
parameters. When content capture is enabled, tool observation names may include
concise command lines or parameter summaries while the complete captured input
remains available on the observation. Credential values and configuration
secrets must never be copied into trace metadata or diagnostic output. Content
capture is an explicit data-export decision; documentation must describe the
data sent, the destination's retention boundary, truncation, and the limits of
automatic redaction.

Durable capture, terminal receipts, and registry entries bind to the canonical
originating project directory, user configuration directory, and a nonsecret
fingerprint of the endpoint and Langfuse public project key. Recovery only uses
a matching current context; another project's hooks leave that backlog local.
Capture and delivery both enforce the binding, including direct Stop delivery.
Changing a secret key alone may resume delivery to the same project. Changing
the destination or configuration location cannot rebind existing work. Legacy
unbound capture databases and terminal receipts require manual reconciliation;
they must never acquire a destination from the next hook's settings.
An atomic first-writer context reservation precedes capture and terminal
receipts. A mismatched terminal hook refuses before writing evidence, including
while initial capture is uncommitted. Terminal receipts in the matching context
remain independent of the capture transaction lock. Cancellation may retain
the reservation; retries must use its original context.

The launcher preserves the backend's resolved strict failure from file or
environment configuration. Supported environment boolean spellings have the
same meaning before backend startup. Startup failures remain fail-open by
default; file settings cannot be resolved if the backend cannot start.

## Work-item attribution

Attribution is an ordered timeline reconstructed from the rollout and its
sidecar snapshots. A user starts an explicit epoch by making the first non-empty
line of a prompt exactly one of:

```text
@darrow.attribution set <work-item-id>
@darrow.attribution clear
@darrow.attribution auto
```

`set` applies the bounded identifier to the current and subsequent turns,
`clear` makes the current and subsequent turns explicitly unattributed, and
`auto` returns the current and subsequent turns to fallback resolution. A valid
directive starts a new epoch even when it repeats the previous mode or value.
Text elsewhere in a prompt is not a directive. A malformed namespaced first
line is refused instead of being guessed.

For each turn, resolution follows this precedence:

1. a directive on the current turn;
2. the active explicit epoch reconstructed from earlier directives;
3. a non-empty identifier supplied by environment or configuration and
   snapshotted when the turn stops, or provisionally when it starts if Stop
   never occurs;
4. an identifier inferred from the Git branch at the same final or provisional
   snapshot boundary;
5. no attribution.

Every trace records `darrow.attribution_source` and `codex.thread_id`.
Session-grouped traces also record `darrow.attribution_epoch`; traces lacking
both final and provisional automatic-attribution evidence remain ungrouped and
omit that field. A trace records
`darrow.work_item_id`, `git.branch`, and `git.head` when those values are
available. Explicit attribution, including an explicit unattributed gap, wins
over configuration and branch inference. Branch inference recognizes only the
exact leading ticket token after a conventional branch type, such as
`feat/DAR-123-retry`, `fix/issue-45-retry`, or `fix/45-retry`. It never selects
a later ticket-like substring. Detached HEAD, unreadable Git state, malformed
identifiers, and branches without a leading token yield no inferred value.
Inference is local mechanics and does not call a tracker or require a ticket
plugin.

An interruption does not start an attribution epoch by itself. When an
interrupted turn's provisional snapshot has the same attribution source and
work-item value as the snapshot-backed turns around it, all of those turns
remain in one epoch and one native Langfuse session segment. A missing snapshot
still leaves only that turn ungrouped; `codex.thread_id` remains the stable
conversation key for finding and correlating turns across grouped segments and
ungrouped gaps.

Each epoch has a deterministic identifier derived from the original Codex
thread ID and its ordered position. That identifier is both the
`darrow.attribution_epoch` metadata value and the native Langfuse `session.id`.
Consequently one Codex conversation may span several ticket-coherent Langfuse
session segments, while `codex.thread_id` provides the stable conversation key
across all of them. A change in effective automatic attribution also starts a
new segment so branch fallback cannot group different work items together.

## Installation and refusal behavior

Installation documentation names the required Codex hook support, UV,
supported Python version, Langfuse server/SDK compatibility, configuration
files and variables, first-run dependency behavior, and verification command.
The hook registration resolves the packaged launcher through Codex's
`PLUGIN_ROOT` environment variable and selects a native Windows command through
`commandWindows`. Each launcher then resolves its own plugin root and uses the
committed UV lock. Neither launcher may assume the source checkout location or
another plugin installation. Native Windows operation requires PowerShell, not
Bash, WSL, or a POSIX compatibility layer.

The hook exits successfully without export when tracing is disabled. Missing
UV, missing credentials, malformed hook input, unreadable transcript, invalid
configuration, and exporter failure produce bounded diagnostics only when
debugging is enabled. Strict mode turns the same refusal or failure into a
nonzero exit for deterministic testing.

## Verification

Deterministic tests cover installation paths, configuration precedence,
same-session topic changes, explicit clearing and unattributed gaps, return to
automatic attribution, branch-only fallback, mid-session branch changes,
export retry snapshots, prompt-time provisional attribution, interrupted-turn
continuity, missing-snapshot quarantine, epoch session segmentation, detached
and non-ticket Git state, rollout reconstruction, deduplication, content
privacy, malformed input, missing runtime or configuration, and exporter
failure. Backend checks run through UV. Hook-launcher tests run with both
supported Bash executables on Unix and the registered PowerShell command on
native Windows. The backend conforms to the repository-wide [Python quality
standard](python-quality.md), including separate 95% statement and branch
coverage gates on every supported Python and CI platform. Fresh copied-artifact
verification exercises the registered hook command on Linux, macOS, and native
Windows.

Performance evidence distinguishes startup from steady-state foreground
capture, confirms network-independent foreground completion, bounded
incremental reads and exporter batching, and reports peak memory for a stated
workload. Release evidence includes a fresh artifact install with runtime-only
locked dependencies. The isolated live Langfuse smoke test remains the release
check for actual ingestion.

Participant-visible colocated evals cover configuration/help intent, refusal to
claim tracing without prerequisites, privacy disclosure, work-item precedence,
interrupted-turn attribution, and the boundary against unrelated monitoring or
ticket mutation. A real local smoke test uses Langfuse's official self-hosted
Docker Compose deployment, exports a fixture turn, and retrieves the ingested
trace and work-item metadata.

## Proof obligations

1. **OLF-P1 — Independent plugin.** The plugin installs without, and contains
   no reference to, another Darrow plugin or skill.
2. **OLF-P2 — Host lifecycle seam.** Codex UserPromptSubmit captures
   provisional turn attribution, and a Stop payload naming a rollout is
   sufficient to finalize the current turn and durably capture its envelope;
   asynchronous lifecycle hooks subsequently deliver it.
3. **OLF-P3 — Coherent session and trace.** Each attribution epoch is one native
   Langfuse session segment whose turn, generation, tool, token, and subagent
   evidence is represented as correctly nested per-turn trace trees; every
   segment retains the original Codex thread ID.
4. **OLF-P4 — Deterministic attribution.** Ordered rollout directives start,
   change, clear, or restore automatic attribution without retroactively
   changing earlier epochs. Final Stop evidence supersedes provisional
   prompt-time evidence; provisional evidence covers interrupted turns that
   never stop without creating an epoch boundary when its effective
   attribution matches the surrounding turns. Snapshotted configuration and
   Git provenance keep branch fallback and export retries stable, while absent
   evidence produces no ID or session segment.
5. **OLF-P5 — Privacy by opt-in.** Export and raw-content capture are separate
   explicit choices, and credential values never become trace metadata.
   Durable work binds to its originating project, configuration locations, and
   destination identity; recovery cannot export it through another context or
   automatically adopt unbound legacy work.
6. **OLF-P6 — Safe failure.** Runtime and exporter failures fail open by
   default and become nonzero only under the explicit strict setting. The
   launcher preserves backend-resolved file and environment strict failures,
   while unresolved startup failures remain fail-open by default.
7. **OLF-P7 — Runtime exception containment.** Python and UV are confined to
   this plugin, declared, locked, documented, and exercised through the
   plugin-local launcher.
8. **OLF-P8 — Real ingestion.** When Docker infrastructure is available, an
   isolated official Langfuse Compose deployment accepts and exposes a trace
   emitted by the plugin.
9. **OLF-P9 — Python quality.** The backend passes the registered-package
   formatting, lint, strict typing, deterministic tests, separate statement
   and branch coverage, supported-platform CI, performance, and fresh-install
   obligations in the repository Python quality standard.
