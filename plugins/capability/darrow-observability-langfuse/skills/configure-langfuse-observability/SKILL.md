---
name: configure-langfuse-observability
description: Configure or explain Darrow's Langfuse observability for Codex, including setup, privacy, in-session work-item attribution, verification, and failure diagnosis. Use for requests about enabling, inspecting, controlling attribution, or troubleshooting this plugin. Do not use for generic application monitoring, deploying Langfuse itself, or tracker operations.
---

# Configure Langfuse observability

Help the user understand or prepare one bounded configuration. The plugin
observes Codex rollout transcripts; it does not observe arbitrary applications,
administer Langfuse, or contact a ticket tracker.

Default to read-only guidance. Requests phrased as “help me configure,” “set
up,” or “what should I set” do not authorize file edits or hook execution. Edit
only when the user explicitly says to create or update one exact configuration
file. Run the hook only when the installed plugin root and a readable absolute
rollout path are both supplied or already verified in the current environment.

## 1. Establish the requested outcome

Distinguish configuration, in-session attribution control, privacy explanation,
verification, and diagnosis. For a configuration request, establish:

- whether UV is installed and usable;
- the Langfuse base URL, public key, and secret key source;
- whether raw prompts, reasoning, assistant text, and tool payloads may leave
  the machine; and
- whether work-item attribution is explicit, branch-inferred, or intentionally
  absent.

Never invent, request in chat, print, test, or persist a secret key. A missing
runtime, endpoint, credential source, or data-export decision prevents a claim
that tracing is configured. Name every currently missing prerequisite together
and stop before editing configuration or running verification. For an
incomplete setup request, use a `Missing prerequisites` list that explicitly
names `UV`, `LANGFUSE_BASE_URL`, the `LANGFUSE_PUBLIC_KEY` and
`LANGFUSE_SECRET_KEY` source, and the raw-content export decision whenever each
is unverified. Read the bundled [README](../../README.md) when exact
installation, configuration-file, or troubleshooting detail is needed.

## 2. Preserve authority and privacy defaults

Keep explanation and diagnosis read-only. Edit a user or repository
configuration file only when the user explicitly asks for that exact effect and
the destination is known. Do not turn tracing on merely because the plugin is
installed.

Tracing defaults off. `DARROW_LANGFUSE_ENABLED=true` opts into export. Raw
content capture is a separate opt-in and defaults off;
`DARROW_LANGFUSE_CAPTURE_CONTENT=true` permits prompts, reasoning, assistant
text, and tool inputs/outputs to be sent after configured-credential and
sensitive-key redaction. Explain that redaction is best effort and the user
must apply the destination's access and retention policy.

For every privacy-explanation request, explicitly cover all five points before
completion: tracing/export defaults off; raw-content capture defaults off as a
separate choice; eligible content includes prompts, reasoning, assistant text,
and tool inputs/outputs; redaction is best effort; and exported data may be
stored by Langfuse, so the destination's access and retention controls apply.

Configuration resolves as defaults, user file
`~/.codex/darrow-langfuse.json`, repository file
`<cwd>/.codex/darrow-langfuse.json`, then environment variables. Environment
variables win. For guidance, prefer one explicit environment block over
silently choosing a file. Include `DARROW_LANGFUSE_ENABLED`,
`DARROW_LANGFUSE_CAPTURE_CONTENT`, `DARROW_LANGFUSE_WORK_ITEM_ID` when explicit
attribution is requested, `LANGFUSE_BASE_URL`, and credential placeholders
named `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`. Never fill those placeholders.

## 3. Resolve attribution explicitly

Use a rollout directive when the user wants to start, change, clear, or restore
automatic attribution without restarting Codex. The directive must be the
first non-empty line of the user's prompt. Give the applicable line exactly,
without a shell wrapper, environment assignment, Markdown prefix, or invented
identifier:

```text
@darrow.attribution set ISSUE-60
@darrow.attribution clear
@darrow.attribution auto
```

Replace `ISSUE-60` only with the bounded identifier the user supplied. Never
infer an identifier from a title or contact a tracker to fill one in. If the
user asks to set attribution but supplies no identifier, ask for it. Distinguish
`clear`, which explicitly keeps the current and subsequent turns unattributed,
from `auto`, which returns the current and subsequent turns to configuration and
then Git-branch fallback. Do not claim that natural-language prose or a
directive shown later in a prompt changes attribution.

An active in-session directive wins first: `set` supplies its identifier and
`clear` supplies no identifier. In `auto` mode,
`DARROW_LANGFUSE_WORK_ITEM_ID` or the corresponding `work_item_id` file value
wins over Git-branch inference. Without a configured value, a bounded token
such as `DAR-123`, `issue-45`, or a leading numeric branch token may be
inferred. On detached HEAD, no branch value can be inferred; in `auto` mode
with no configured value, the trace has no `darrow.work_item_id`. A non-ticket
branch, unreadable Git state, or malformed input has the same no-inference
result.

Every valid directive starts a new attribution epoch. Explain that Langfuse
uses the epoch as its native session segment and that `codex.thread_id` remains
the stable conversation key across segments. Session-grouped traces record the
attribution source and epoch plus branch and HEAD provenance when available. An
interrupted turn uses its prompt-time provisional snapshot when no final Stop
snapshot exists. If neither snapshot exists, the trace remains discoverable by
`codex.thread_id` but is not attached to a Langfuse session and does not create
an attribution epoch.

For an interrupted-turn diagnosis, state the resulting grouping explicitly.
An interruption alone does not start a new epoch: when the provisional
snapshot's attribution source and work-item value match the snapshot-backed
turns around it, those turns share one `darrow.attribution_epoch` and one native
Langfuse session segment. If the snapshot is missing, only that turn is
ungrouped. In either case, identify `codex.thread_id` as the stable conversation
key used to find and correlate turns across session segments and ungrouped
gaps.

An in-session attribution-control answer is incomplete unless it includes the
applicable exact directive lines, their current-and-subsequent-turn scope, the
epoch-to-Langfuse-session mapping, and `codex.thread_id` as the conversation key
across those session segments. End that answer with a concise `Session policy`
statement that uses both field names literally: `darrow.attribution_epoch` is
the Langfuse session segment, while `codex.thread_id` is the conversation key
across segments. Do not replace either field name with a prose-only synonym.

## 4. Verify without overstating success

Use `DARROW_LANGFUSE_DRY_RUN=true` with
`DARROW_LANGFUSE_ENABLED=true` to inspect the reconstructed trace JSON without
network export or credentials. Keep content capture false unless the user has
approved that data. A manual dry run also needs the installed plugin root and a
readable absolute rollout path. If either is absent, provide the environment
block and verification procedure only; do not search plugin caches, invent a
path, run the hook, or create configuration as a substitute.

Use `DARROW_LANGFUSE_STRICT=true` only for installation/testing so missing UV,
invalid input/configuration, and exporter failure return nonzero. Normal hook
operation fails open so telemetry cannot block a Codex turn. Debug diagnostics
are opt-in with `DARROW_LANGFUSE_DEBUG=true` and must never include credential
values.

Do not claim live ingestion from a dry run, a successful hook exit, or saved
configuration. A live verification requires a reachable compatible Langfuse
instance, valid project-scoped keys, a real export, and retrieval of the trace
from that same project.

## Completion

Return the exact configuration or explanation requested, distinguish verified
facts from untested prerequisites, state the content-capture decision and
attribution source or directive mode, and name the next safe verification. Do
not imply that the plugin, UV, credentials, network, or ingestion works unless
directly observed.
