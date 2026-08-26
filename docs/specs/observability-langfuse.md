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
portable-Bash plugin-runtime boundary. The deterministic launcher remains
portable Bash, but trace reconstruction and export use Python managed by UV.
The plugin declares and locks its Python dependencies and refuses safely when
UV or the managed environment is unavailable. This exception is local to this
plugin and does not change the default boundary for other plugins.

## Runtime contract

Codex invokes the plugin on the `Stop` hook and supplies a JSON object on
standard input. The hook accepts a readable absolute `transcript_path` to a
Codex rollout JSONL file. It reads that file without modifying it and
reconstructs:

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

The Stop payload's non-empty `turn_id` identifies the turn being completed and
is authoritative even when the rollout writer has not appended its trailing
`task_complete` record yet. Only rollout-completed turns and the current Stop
turn are eligible for export. Before export, the hook records the current
turn's fallback attribution and Git provenance atomically in a plugin-owned
sidecar next to the rollout. Successful ingestion adds the completed turn
identifier to the same sidecar so repeated Stop events do not export it twice.
The attribution snapshot survives a failed export and makes a later retry
independent of subsequent configuration, branch, or HEAD changes. Malformed
JSONL records are ignored, but an unreadable `transcript_path`, missing original
Codex thread ID, invalid sidecar, or a `turn_id` that does not match exactly one
reconstructed turn is a refusal rather than a fabricated success.

The hook fails open by default: configuration, parsing, dependency, network, or
export failures do not block the Codex turn. An explicit strict test/debug
setting may make those failures nonzero so installation and exporter failures
are observable.

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
   snapshotted when the turn stops;
4. an identifier inferred from the Git branch snapshotted when the turn stops;
5. no attribution.

Every trace records `darrow.attribution_source`,
`darrow.attribution_epoch`, and `codex.thread_id`; it records
`darrow.work_item_id`, `git.branch`, and `git.head` when those values are
available. Explicit attribution, including an explicit unattributed gap, wins
over configuration and branch inference. Branch inference recognizes a bounded
ticket token such as `DAR-123`, `ABC_42`, `issue-45`, or `45` when the token is
delimited within a conventional branch name. Detached HEAD, unreadable Git
state, malformed identifiers, and branches without a bounded token yield no
inferred value. Inference is local mechanics and does not call a tracker or
require a ticket plugin.

Each epoch has a deterministic identifier derived from the original Codex
thread ID and its ordered position. That identifier is both the
`darrow.attribution_epoch` metadata value and the native Langfuse `session.id`.
Consequently one Codex conversation may span several ticket-coherent Langfuse
session segments, while `codex.thread_id` provides the stable conversation key
across all of them. A change in effective automatic attribution also starts a
new segment so branch fallback cannot group different work items together.

## Installation and refusal behavior

Installation documentation names the required Codex plugin-hook feature, UV,
supported Python version, Langfuse server/SDK compatibility, configuration
files and variables, first-run dependency behavior, and verification command.
The hook registration resolves the packaged launcher through Codex's
`PLUGIN_ROOT` environment variable. The launcher then resolves its own plugin
root and uses the committed UV lock. It must not assume the source checkout
location or another plugin installation.

The hook exits successfully without export when tracing is disabled. Missing
UV, missing credentials, malformed hook input, unreadable transcript, invalid
configuration, and exporter failure produce bounded diagnostics only when
debugging is enabled. Strict mode turns the same refusal or failure into a
nonzero exit for deterministic testing.

## Verification

Deterministic tests cover installation paths, configuration precedence,
same-session topic changes, explicit clearing and unattributed gaps, return to
automatic attribution, branch-only fallback, mid-session branch changes,
export retry snapshots, epoch session segmentation, detached and non-ticket
Git state, rollout reconstruction, deduplication, content privacy, malformed
input, missing runtime or configuration, and exporter failure. Backend checks
run through UV. Portable hook-launcher tests run with both supported Bash
executables.

Participant-visible colocated evals cover configuration/help intent, refusal to
claim tracing without prerequisites, privacy disclosure, work-item precedence,
and the boundary against unrelated monitoring or ticket mutation. A real local
smoke test uses Langfuse's official self-hosted Docker Compose deployment,
exports a fixture turn, and retrieves the ingested trace and work-item metadata.

## Proof obligations

1. **OLF-P1 — Independent plugin.** The plugin installs without, and contains
   no reference to, another Darrow plugin or skill.
2. **OLF-P2 — Host lifecycle seam.** A Codex Stop payload naming a rollout is
   sufficient to invoke reconstruction and export.
3. **OLF-P3 — Coherent session and trace.** Each attribution epoch is one native
   Langfuse session segment whose turn, generation, tool, token, and subagent
   evidence is represented as correctly nested per-turn trace trees; every
   segment retains the original Codex thread ID.
4. **OLF-P4 — Deterministic attribution.** Ordered rollout directives start,
   change, clear, or restore automatic attribution without retroactively
   changing earlier epochs. Snapshotted configuration and Git provenance keep
   branch fallback and export retries stable, while absent evidence produces no
   ID.
5. **OLF-P5 — Privacy by opt-in.** Export and raw-content capture are separate
   explicit choices, and credential values never become trace metadata.
6. **OLF-P6 — Safe failure.** Runtime and exporter failures fail open by
   default and become nonzero only under the explicit strict setting.
7. **OLF-P7 — Runtime exception containment.** Python and UV are confined to
   this plugin, declared, locked, documented, and exercised through the
   plugin-local launcher.
8. **OLF-P8 — Real ingestion.** When Docker infrastructure is available, an
   isolated official Langfuse Compose deployment accepts and exposes a trace
   emitted by the plugin.
