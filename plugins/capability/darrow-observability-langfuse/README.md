# Darrow Langfuse Observability

This independently installable plugin reconstructs OpenAI Codex turns from the
rollout transcript supplied to Codex's lifecycle hooks and exports them as
Langfuse traces. Its trace model is explicitly oriented on
[`langfuse/codex-observability-plugin`](https://github.com/langfuse/codex-observability-plugin):
one trace per turn, nested model generations and tool calls, token usage, and
spawned subagent turns. Turn traces are grouped into ticket-coherent native
Langfuse session segments, one per attribution epoch. Every trace retains the
original Codex session/thread identifier as the conversation key across those
segments.

It adds Darrow-specific work-item attribution without depending on another
plugin. The hook never contacts or mutates a tracker.

## Runtime

Codex selects `hooks/stop.sh` through Bash on Linux and macOS and
`hooks/stop.ps1` through Windows PowerShell on native Windows. Transcript
reconstruction and Langfuse export run in Python managed by UV on every
platform. The plugin commits `backend/pyproject.toml` and `backend/uv.lock`; no
sibling plugin or repository runtime is required.

To prepare the hook environment before its first execution, run from the plugin
root:

```sh
uv sync --frozen --project backend
```

## Install for Codex

Add the Darrow marketplace and install only this plugin:

```sh
codex plugin marketplace add BjRo/darrow
codex plugin add darrow-observability-langfuse@darrow
```

Review and trust the plugin's hooks when Codex prompts you, then start a new
Codex session after installation. You can inspect the registered hooks with
`/hooks`. Check [hosts and prerequisites](#hosts-and-prerequisites) before
enabling export. Delivery uses the supported
OTLP traces endpoint and the v4 ingestion header. Codex must support native
asynchronous command hooks and `commandWindows` (verified with CLI 0.154.0).

## Configure

Tracing is disabled until explicitly enabled. Environment variables override
the repository file, which overrides the user file, which overrides defaults.

| Environment variable              | File key          | Default                      | Purpose                                                                      |
| --------------------------------- | ----------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| --------------------------------- | ----------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `DARROW_LANGFUSE_ENABLED`         | `enabled`         | `false`                      | Opt into network export                                                      |
| `DARROW_LANGFUSE_CAPTURE_CONTENT` | `capture_content` | `false`                      | Include prompt/reasoning/message/tool content and detailed invocation labels |
| `DARROW_LANGFUSE_WORK_ITEM_ID`    | `work_item_id`    | branch inference             | Automatic-mode default external ticket or work-item identifier               |
| `DARROW_LANGFUSE_MAX_CHARS`       | `max_chars`       | `20000`                      | Maximum captured characters per string                                       |
| `DARROW_LANGFUSE_DRY_RUN`         | `dry_run`         | `false`                      | Print reconstructed JSON without export or sidecar writes                    |
| `DARROW_LANGFUSE_DEBUG`           | `debug`           | `false`                      | Emit bounded diagnostics to stderr                                           |
| `DARROW_LANGFUSE_STRICT`          | `strict`          | `false`                      | Make refusals/export failures nonzero for tests                              |
| `LANGFUSE_BASE_URL`               | `base_url`        | `https://cloud.langfuse.com` | Langfuse Cloud or self-hosted base URL                                       |
| `LANGFUSE_PUBLIC_KEY`             | `public_key`      | none                         | Project-scoped public key                                                    |
| `LANGFUSE_SECRET_KEY`             | `secret_key`      | none                         | Project-scoped secret key                                                    |

Configuration files are JSON objects at
`~/.codex/darrow-langfuse.json` and `<project>/.codex/darrow-langfuse.json`:

```json
{
  "enabled": true,
  "capture_content": false,
  "base_url": "http://localhost:3000",
  "work_item_id": "OPS-42"
}
```

Prefer environment variables or an OS secret manager for credentials. Do not
commit API keys to the repository file.

## Work-item attribution

Start an attribution epoch by putting one directive on the first non-empty line
of a Codex prompt. The rest of that prompt may contain the task:

```text
@darrow.attribution set ISSUE-60
@darrow.attribution clear
@darrow.attribution auto
```

- `set` attributes the current and subsequent turns to the supplied bounded
  work-item ID.
- `clear` makes the current and subsequent turns explicitly unattributed.
- `auto` returns the current and subsequent turns to configuration and then Git
  branch inference.

A directive later in a prompt is ordinary text and does not change attribution.
Every valid directive starts a new epoch, including one that repeats the active
mode or value. In automatic mode, `DARROW_LANGFUSE_WORK_ITEM_ID` or the
configuration-file `work_item_id` wins over branch inference. Conventional
leading tokens such as `DAR-123`, `ABC_42`, `issue-45`, and a numeric token are
supported only immediately after the conventional branch type. Later
ticket-like text is ignored. Detached HEAD, malformed tokens, and non-ticket
branches yield no identifier.

Every trace records `darrow.attribution_source` and `codex.thread_id`.
Session-grouped traces also record `darrow.attribution_epoch`. Traces record
`darrow.work_item_id`, `git.branch`, and `git.head` when available. The epoch ID
is the trace's native Langfuse `session.id`, so a conversation that moves from
one work item to another becomes multiple ticket-coherent session segments.
Use `codex.thread_id` to query or correlate the complete conversation across
segments.

At UserPromptSubmit, the plugin records the current turn's provisional
automatic fallback, branch, and HEAD under Codex's plugin data directory. It
does not persist the submitted prompt. At live Stop, the plugin records final
evidence in `<rollout>.darrow-langfuse.sqlite3`; that final snapshot supersedes the
current turn's provisional evidence. A failed export therefore retries with
the original evidence even if the configuration, branch, or HEAD changes
afterward. An interrupted turn that never reaches Stop uses its provisional
snapshot. Before export, that evidence is promoted into the rollout sidecar so
later turns retain the same epoch numbering. If no snapshot exists, the trace
remains available by `codex.thread_id` but is not attached to a Langfuse
session and does not create a false attribution epoch. Explicit directives
remain in the rollout itself, so replay reconstructs the same ordered timeline.
This state is entirely local; the plugin never contacts a tracker.

A completed turn without its own final Stop receipt stays local while the
session is live. Later turns depending on that attribution gap also stay local.
Its own Stop resolves the gap with final evidence; Interrupt records explicit
abortion and uses provisional evidence. SessionEnd seals any remaining
missing-Stop turns from the provisional evidence present at its terminal
rollout byte boundary. Missing evidence stays missing, not replaced by the
configuration of a later session. Resumed turns appended after that watermark
are live again and need their own terminal evidence.

## Privacy and security

Export and raw-content capture are separate opt-ins. With content capture off,
the plugin sends observation structure, names, status, model identity, token
counts, timing metadata, session/turn IDs, and optional work-item attribution.
With it on, prompts, reasoning summaries, assistant text, and tool inputs and
outputs are also eligible for export. Tool observation names then use concise
invocation labels such as `git status` or `ctx_read {path:"README.md"}`, while
the complete captured parameters remain in the observation input. With content
capture off, tool names remain generic and contain no parameters.

Configured credential strings and values under sensitive keys such as
`authorization`, `token`, `secret`, `password`, and `api_key` are redacted
before export. This is best-effort protection, not a data-loss-prevention
system. Review transcript content, use `DARROW_LANGFUSE_MAX_CHARS`, and apply
appropriate Langfuse project access and retention controls before enabling raw
content capture.

The secret key is used only for Langfuse authentication. It is not included in
trace metadata, dry-run output, provisional attribution state, the
deduplication sidecar, or plugin diagnostics.

## Trace and failure behavior

Malformed JSONL records are skipped. A missing/unreadable transcript, invalid
hook JSON or configuration, missing UV/credentials, and export failure are safe
refusals. Normal hook operation fails open so observability cannot block the
Codex turn. Strict mode makes the same condition nonzero for deterministic
installation and failure testing.
File-based `strict: true` and environment values `1`, `true`, `yes`, and `on`
(case-insensitive, with surrounding whitespace allowed) remain nonzero through
the launcher. If UV or Python cannot start, only the environment setting is
available; startup failures still fail open by default.

The UserPromptSubmit payload's `turn_id` identifies the turn about to start and
records a mode-`0600` provisional snapshot under `PLUGIN_DATA`. The Stop
payload's `turn_id` identifies the turn being completed, including when the
rollout does not yet contain its trailing `task_complete` record. Final Stop,
explicit abortion, or SessionEnd sealing makes a captured turn eligible for
ordered finalization. The final current-turn snapshot and receipt, incremental
parser cursor, and resolved-prefix envelopes are committed together in a private
SQLite sidecar. Unresolved turns remain local parser data. Stop does local
capture only. It reads appended JSONL bytes after initial indexing, retaining
an incomplete trailing line and active parser state. Rollout replacement,
truncation, or an incompatible parser version rebuilds the index while keeping
delivery evidence. Existing version-1 and legacy `.darrow-langfuse` sidecars
are validated and imported; their uploaded-turn evidence is preserved.

Separate Codex-native asynchronous Stop, UserPromptSubmit, and SessionStart
hooks drain the backlog. One process lock serializes delivery; remote waits do
not hold the capture transaction. Background hooks can finish out of order or
be cancelled when Codex ends a session. Interrupt and SessionEnd are synchronous,
local-only hooks with Codex's three-second maximum. They atomically write small
immutable receipts under `<rollout>.darrow-langfuse-events`, without waiting
for the capture database lock. SessionEnd never starts network delivery. A later
asynchronous prompt/session hook finishes local finalization and catches up.
Private `PLUGIN_DATA/langfuse-rollouts` registry entries let a different session
recover earlier sealed backlogs. Terminal receipts survive a cancelled
finalization attempt; no timer assumes a missing Stop will never arrive.
No background daemon or collector runs between lifecycle invocations.

Recovery requires the same canonical project directory, user/repository
configuration file locations, and destination fingerprint (endpoint and public
project key) as the original capture. Hooks from another project leave the
backlog local, even when both projects use the same Langfuse destination.
Endpoint or public-key changes refuse capture and delivery for that rollout;
restore the original context to resume it. A secret-key rotation within the
same Langfuse project can resume delivery. Content policy remains frozen per
receipt/envelope. Credentials and raw endpoint values are not stored in the
binding.
An immutable `<rollout>.darrow-langfuse-context` file reserves that binding
before capture or a terminal receipt. Concurrent hooks cannot choose different
origins. Terminal hooks check it without waiting for the capture transaction;
a cancelled first capture retains the binding for a retry in the same context.

On upgrade from 0.4.1, existing unbound SQLite capture state and terminal
receipts stay local for manual reconciliation. They cannot safely inherit the
next hook's destination. Preserve that evidence and inspect the original
Langfuse project before deciding how to recover it; use a new Codex session
for newly bound captures. Legacy uploaded-turn sidecars still prevent duplicate
delivery when imported into a fresh capture store.

An envelope is `pending`, `acknowledged`, or `uncertain`. Confirmed complete
request acceptance acknowledges it; downstream storage is verified separately.
Invalid URLs and other definite pre-request failures, connection refusal, and definite HTTP rejection
leave pending work for a later invocation. The drainer records uncertainty
before attempting delivery, so process termination, response loss, and partial
ingestion quarantine the affected envelopes instead of blindly retrying them.
Other pending envelopes can still drain. This does not promise exactly-once
delivery. Each frozen envelope retains `darrow.delivery_id`, a deterministic
trace ID, and `darrow.expected_observation_count` for manual reconciliation
against the destination. Uncertain work stays quarantined; there is no automatic
reset-to-pending command. Inspect the destination and retain the local evidence
before deciding how to recover it.

The SQLite file contains frozen privacy-filtered envelopes and local parser
state, including unfinished and unresolved rollout content; protect it like the original
rollout. Configured credential strings are redacted from persisted parser data.
Retention follows the local rollout's retention; no automatic deletion runs.
Dry-run remains read-only and reconstructs the full document for inspection.

## Verify

For a network-free inspection, set `DARROW_LANGFUSE_ENABLED=true` and
`DARROW_LANGFUSE_DRY_RUN=true`, then invoke the installed hook with a real
absolute rollout path. Dry run prints the trace JSON, needs no credentials, and
does not write the sidecar. It proves reconstruction only—not authentication or
ingestion.

For live verification, use valid keys from the same Langfuse project, run a
Codex turn, and retrieve the resulting trace from that project. Local testing
follows Langfuse's official
[Docker Compose deployment guide](https://langfuse.com/self-hosting/deployment/docker-compose).
The release smoke procedure starts an isolated Compose project, provisions a
project/key pair, exports a fixture turn, verifies the trace and work-item
metadata in Langfuse, and stops only that project. Langfuse v4 deployments use
the events-only storage model, so verify the exported events rather than the
legacy trace-list API.

## Development checks

```sh
uv run --quiet --frozen --all-groups --project backend pytest backend/tests/test_packaged_hooks.py backend/tests/test_hook_failures.py
uv run --quiet --frozen --no-dev --project backend python backend/tests/fresh_install.py
bun run check:python
```

The hook tests invoke both `bash` and `/bin/bash` on Unix and Windows PowerShell
on native Windows. The copied-artifact check executes the registered host
command on its current platform. The repository command verifies the UV lock,
formatting, lint, strict typing, tests, property tests, and separate statement
and branch coverage gates.

## When to use

Configure or explain Codex turn telemetry, privacy, and attribution. Do not use it to monitor arbitrary applications, deploy Langfuse, or operate tickets.

## Hosts and prerequisites

Codex is the observed runtime. Linux, macOS, and native Windows are supported.
Export requires Codex async hooks and `commandWindows` support,
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
and a compatible Langfuse v4 server or Langfuse Cloud. Linux and macOS require
Bash. Native Windows requires Windows PowerShell 5.1 or later and does not
require Bash, WSL, or a POSIX compatibility layer. Backend and sidecar locks
use the platform's native cross-process file locking. Claude Code turns are not
exported.
Claude installation and guidance invocation are unverified: Claude Code 2.1.223
rejects this package's Codex-specific `Interrupt` hook during native validation.
The presence of a Claude manifest is not a compatibility guarantee.

## Installation

For Codex, install `darrow-observability-langfuse@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Explain what Codex data this plugin exports.

To select it explicitly, choose `configure-langfuse-observability` from Codex's
`$` skill menu, followed by your request. Do not assume Claude Code can load the
package; see the host limitation above.

## Expected result

Guidance is read-only by default. Explicit configuration changes affect the named file; enabled hooks write local state and export approved telemetry. Raw content is a separate opt-in.

## Troubleshooting

Use Trace and failure behavior and Verify above. Dry run proves reconstruction, not ingestion. Preserve uncertain delivery evidence and inspect the destination before recovery; do not replay blindly or share credentials.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
