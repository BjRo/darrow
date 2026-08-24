# Darrow Langfuse Observability

This independently installable plugin reconstructs OpenAI Codex turns from the
rollout transcript supplied to Codex's `Stop` hook and exports them as Langfuse
traces. Its trace model is explicitly oriented on
[`langfuse/codex-observability-plugin`](https://github.com/langfuse/codex-observability-plugin):
one trace per turn, nested model generations and tool calls, token usage, and
spawned subagent turns. All turn traces from one Codex conversation are grouped
under a native Langfuse session keyed by the Codex session/thread identifier.

It adds Darrow-specific work-item attribution without depending on another
plugin. The hook never contacts or mutates a tracker.

## Runtime exception

Darrow plugin mechanics normally use portable Bash only. ADR-0008 records the
contained exception here: `hooks/stop.sh` is a portable launcher, while
transcript reconstruction and Langfuse export run in Python managed by UV. The
plugin commits `backend/pyproject.toml` and `backend/uv.lock`; no sibling plugin
or repository runtime is required.

First execution may let UV download the locked Python runtime dependencies and
create `backend/.venv` inside the installed plugin. Pre-warm it from the plugin
root with:

```sh
uv sync --frozen --project backend
```

## Install for Codex

Add the Darrow marketplace and install only this plugin:

```sh
codex plugin marketplace add BjRo/darrow
codex plugin add darrow-observability-langfuse@darrow
```

Enable plugin hooks in `~/.codex/config.toml` or a project `.codex/config.toml`:

```toml
[features]
plugin_hooks = true
```

Start a new Codex session after installation. UV and a UV-managed Python
`>=3.10,<3.14` are required. The locked Langfuse Python SDK requires a
compatible Langfuse server; current SDK compatibility is documented by
Langfuse and should be checked before connecting an older self-hosted server.

## Configure

Tracing is disabled until explicitly enabled. Environment variables override
the repository file, which overrides the user file, which overrides defaults.

| Environment variable              | File key          | Default                      | Purpose                                                   |
| --------------------------------- | ----------------- | ---------------------------- | --------------------------------------------------------- |
| `DARROW_LANGFUSE_ENABLED`         | `enabled`         | `false`                      | Opt into network export                                   |
| `DARROW_LANGFUSE_CAPTURE_CONTENT` | `capture_content` | `false`                      | Include prompt/reasoning/message/tool content             |
| `DARROW_LANGFUSE_WORK_ITEM_ID`    | `work_item_id`    | branch inference             | Explicit external ticket or work-item identifier          |
| `DARROW_LANGFUSE_MAX_CHARS`       | `max_chars`       | `20000`                      | Maximum captured characters per string                    |
| `DARROW_LANGFUSE_DRY_RUN`         | `dry_run`         | `false`                      | Print reconstructed JSON without export or sidecar writes |
| `DARROW_LANGFUSE_DEBUG`           | `debug`           | `false`                      | Emit bounded diagnostics to stderr                        |
| `DARROW_LANGFUSE_STRICT`          | `strict`          | `false`                      | Make refusals/export failures nonzero for tests           |
| `LANGFUSE_BASE_URL`               | `base_url`        | `https://cloud.langfuse.com` | Langfuse Cloud or self-hosted base URL                    |
| `LANGFUSE_PUBLIC_KEY`             | `public_key`      | none                         | Project-scoped public key                                 |
| `LANGFUSE_SECRET_KEY`             | `secret_key`      | none                         | Project-scoped secret key                                 |

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

Every trace in the native Langfuse session carries `darrow.work_item_id` as
trace metadata when an identifier is available. Langfuse propagates it to the
trace's observations so the complete session remains associated with the work
item:

1. explicit environment or configuration-file value;
2. a bounded token inferred from the current Git branch; or
3. no attribution.

Explicit configuration always wins. Conventional tokens such as `DAR-123`,
`ABC_42`, `issue-45`, and a leading numeric branch token are supported.
Detached HEAD, malformed tokens, and non-ticket branches yield no identifier.

## Privacy and security

Export and raw-content capture are separate opt-ins. With content capture off,
the plugin sends observation structure, names, status, model identity, token
counts, timing metadata, session/turn IDs, and optional work-item attribution.
With it on, prompts, reasoning summaries, assistant text, and tool inputs and
outputs are also eligible for export.

Configured credential strings and values under sensitive keys such as
`authorization`, `token`, `secret`, `password`, and `api_key` are redacted
before export. This is best-effort protection, not a data-loss-prevention
system. Review transcript content, use `DARROW_LANGFUSE_MAX_CHARS`, and apply
appropriate Langfuse project access and retention controls before enabling raw
content capture.

The secret key is used only for Langfuse authentication. It is not included in
trace metadata, dry-run output, the deduplication sidecar, or plugin diagnostics.

## Trace and failure behavior

Malformed JSONL records are skipped. A missing/unreadable transcript, invalid
hook JSON or configuration, missing UV/credentials, and export failure are safe
refusals. Normal hook operation fails open so observability cannot block the
Codex turn. Strict mode makes the same condition nonzero for deterministic
installation and failure testing.

Completed turn IDs are written atomically with mode `0600` to
`<rollout>.darrow-langfuse` only after the exporter returns successfully.
Repeated Stop hooks filter those IDs. In-progress turns are not marked and may
be reconstructed again when Codex later records completion.

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
bash tests/package.test.sh
bash hooks/stop.test.sh
bash hooks/export-failure.test.sh
bash hooks/refusal.test.sh
uv run --frozen --project backend python -m unittest discover -s backend/tests
```

Run each shell test with both `bash` and `/bin/bash` in repository development.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
