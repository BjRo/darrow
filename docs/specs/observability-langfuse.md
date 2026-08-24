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
- model generations and their model name, reasoning summary, output, and valid
  token counts;
- tool observations with inputs, outputs, timing, and error state; and
- subagent turns nested below the turn that spawned them when the referenced
  rollout is readable.

Completed turn identifiers are recorded in a plugin-owned sidecar next to the
rollout so repeated Stop events do not export the same completed turn twice.
Malformed JSONL records are ignored, but an unreadable transcript or a payload
without `transcript_path` is a refusal rather than a fabricated success.

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
token counts remain observable. Credential values and configuration secrets
must never be copied into trace metadata or diagnostic output. Content capture
is an explicit data-export decision; documentation must describe the data sent,
the destination's retention boundary, truncation, and the limits of automatic
redaction.

## Work-item attribution

Each exported root trace may carry one `darrow.work_item_id` metadata value.
Resolution is deterministic:

1. a non-empty identifier supplied explicitly by environment or configuration;
2. an identifier inferred from the current Git branch; or
3. no attribution.

Explicit configuration always wins, including when it conflicts with branch
inference. Branch inference recognizes a bounded ticket token such as
`DAR-123`, `ABC_42`, `issue-45`, or `45` when the token is delimited within a
conventional branch name. Detached HEAD, unreadable Git state, malformed
identifiers, and branches without a bounded token yield no inferred value.
Inference is local mechanics and does not call a tracker or require a ticket
plugin.

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
work-item precedence and branch-only inference, detached and non-ticket Git
state, rollout reconstruction, deduplication, content privacy, malformed input,
missing runtime or configuration, and exporter failure. Backend checks run
through UV. Portable hook-launcher tests run with both supported Bash
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
3. **OLF-P3 — Coherent trace.** Turn, generation, tool, token, and subagent
   evidence is represented in one correctly nested trace tree.
4. **OLF-P4 — Deterministic attribution.** Explicit work-item configuration
   wins over branch inference; absent or malformed evidence produces no ID.
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
