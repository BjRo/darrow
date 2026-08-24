---
name: configure-langfuse-observability
description: Configure or explain Darrow's Langfuse observability for Codex, including setup, privacy, work-item attribution, dry-run verification, and failure diagnosis. Use for requests about enabling, inspecting, or troubleshooting this plugin. Do not use for generic application monitoring, deploying Langfuse itself, or tracker operations.
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

Distinguish configuration, privacy explanation, verification, and diagnosis.
For a configuration request, establish:

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

`DARROW_LANGFUSE_WORK_ITEM_ID` or the corresponding `work_item_id` file value
always wins over Git-branch inference. Without an explicit value, a bounded
token such as `DAR-123`, `issue-45`, or a leading numeric branch token may be
inferred. Detached HEAD, a non-ticket branch, unreadable Git state, or malformed
input produces no `darrow.work_item_id`. Never query or mutate a tracker to fill
the gap.

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
attribution source, and name the next safe verification. Do not imply that the
plugin, UV, credentials, network, or ingestion works unless directly observed.
