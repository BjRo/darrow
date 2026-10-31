# Native ticket attribution and Langfuse plugin retirement

Native Codex telemetry carried both ticket attributes into local OTLP capture
and the observed Langfuse storage subset. That meets the user's chosen reason
to remove the Darrow plugin, with the limits below. The accepted retirement is
recorded in [ADR-0013](../decisions/ADR-0013-retire-the-langfuse-observability-plugin.md).

## Test and observations

On 2026-10-31, two real headless Codex CLI 0.166.0 invocations used `gpt-6.1-sol`
and each returned `NATIVE_OTEL_284_OK`. The test used an isolated `CODEX_HOME` with
plugins, hooks and apps disabled. The native exporters were configured for a
local HTTP collector, and the process started with:

```sh
OTEL_RESOURCE_ATTRIBUTES='ticket.id=284,darrow.work_item_id=284'
```

This is an attribution setting, not a complete exporter configuration.

The following capture counts aggregate both invocations.

| Native signal | Captured batches | Resource groups | Groups with both attributes |
| ------------- | ---------------: | --------------: | --------------------------: |
| Logs          |               12 |              12 |                          12 |
| Traces        |                5 |               5 |                           5 |
| Metrics       |                2 |               2 |                           2 |

Local Langfuse 4.72.0 ran through Docker. A transparent local HTTP capture
proxy forwarded native OTLP trace JSON unchanged, adding only Basic
authentication and `x-langfuse-ingestion-version: 4` HTTP headers. Logs and
metrics were captured locally and were not forwarded to Langfuse.

A query of ClickHouse `events_full FINAL` found 512 stored observations from
the second invocation:
15 `GENERATION` and 497 `SPAN`. All 512 carried both ticket values at
`resourceAttributes.ticket.id` and `resourceAttributes.darrow.work_item_id`.
The stored subset contained startup/model metadata spans, no nonempty session
IDs and no usage records. It does not represent complete turn delivery.
The [sanitized result JSON](native-otel-issue-284-results.json) preserves counts,
one nonsecret example, versions, successful turn marker and limitations.

## Limits and interpretation

The existing Docker VM had about 3.8 GiB shared with other containers. Memory
pressure caused startup and later export timeouts. The first invocation ran
during Docker startup and all three trace forwarding attempts failed. The
second ran after Langfuse health reported 4.72.0, accepted the first 512 spans,
and timed out on a later batch. This is positive evidence
of native resource-attribute propagation and actual persisted ingestion, not
a reliability or completeness benchmark. Native traces included noisy host
internals rather than the plugin's reconstructed presentation.

Only headless CLI was tested. Desktop, Cloud, subagents, UI ticket filtering,
ticket switching and plugin parity were not tested. Attribute persistence does
not establish automatic top-level Langfuse fields or UI filterability.
There was no new live Claude experiment. Claude's
[current monitoring guide](https://code.claude.com/docs/en/monitoring-usage)
documents `OTEL_RESOURCE_ATTRIBUTES` on metrics/events and beta nested tracing.
The retired plugin did not export Claude turns; its README documented an
`Interrupt` hook validation incompatibility.

Copied authentication material and temporary test containers/volumes were
removed. The user's original configuration was unchanged. The durable JSON
contains no credentials or copied host configuration.

## Migration

Disable or uninstall any installed copy of `darrow-observability-langfuse`
through the host's plugin management interface. Source removal does not change
installed copies or delete local capture state. Treat old backlog as local
evidence to inspect deliberately; the native exporter does not import it.

Configure native exporters using the host's
[Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
or [Claude monitoring guide](https://code.claude.com/docs/en/monitoring-usage),
and the destination's
[Langfuse OpenTelemetry ingestion guide](https://langfuse.com/integrations/native/opentelemetry).
Choose endpoints, credentials, signal types and content settings explicitly.
For a ticket-scoped session, include both identifiers in
`OTEL_RESOURCE_ATTRIBUTES` before launching the host. A later shell's `export`
does not update the already-running parent process. Start a separately
attributed session when changing tickets; the removed plugin's directives,
branch inference and epoch grouping are no longer provided.

[Artificer follow-up #285](https://github.com/BjRo/darrow/issues/285) tracks
setting these values before launch and preserving original-owner attribution
on resume. No Artificer behavior changes in this retirement.

## Historical evidence

The original [issue #77 verification record](langfuse-plugin-issue-77-verification.md)
is preserved byte-for-byte. Its commands describe the retired implementation,
not runnable current entrypoints. The complete plugin, its former specification
and experiment suite remain available at the pre-retirement revision
`f65e81e046b1f5859af781b68a47ba2d3cf2f975`:

- [Plugin and hooks](https://github.com/BjRo/darrow/tree/f65e81e046b1f5859af781b68a47ba2d3cf2f975/plugins/capability/darrow-observability-langfuse)
- [Former specification](https://github.com/BjRo/darrow/blob/f65e81e046b1f5859af781b68a47ba2d3cf2f975/docs/specs/observability-langfuse.md)
- [Former value experiment](https://github.com/BjRo/darrow/blob/f65e81e046b1f5859af781b68a47ba2d3cf2f975/evals/experiments/observability-langfuse/value-suite.yaml)

References in the historical Luna sweep and ADRs describe past evidence and
authority. They do not advertise an installable plugin.
