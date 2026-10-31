# ADR-0013: Retire the Langfuse observability plugin

Status: Accepted
Date: 2026-10-31
Summary: Remove darrow-observability-langfuse and use configured native host OpenTelemetry exporters with session-start resource attributes for ticket attribution, accepting the loss of plugin-specific reconstruction and attribution features.
Supersedes: ADR-0008
Revisit when: A concrete telemetry requirement cannot be met by native host exporters and justifies a separately scoped integration with measured evidence.

## Context

**User statement:** The current request on [issue #284](https://github.com/BjRo/darrow/issues/284)
explicitly chooses removal of the whole plugin after testing whether native
telemetry can carry a ticket identifier. The user accepts losing the plugin's
reconstructed turn and generation presentation, mid-session attribution epochs
and grouping, and branch inference and recovery.

**Repository fact:** ADR-0008 authorized the plugin's Python backend and hook
failure semantics. ADR-0009 generalized contained Python and UV mechanics to
other plugins; that broader decision remains in force. The plugin added a
rollout parser, hooks, local state and delivery machinery to maintain alongside
the host. Its Claude registration did not export Claude turns, and its README
documented Claude's incompatible `Interrupt` hook validation.

**Repository fact:** The [native test record](../research/native-otel-issue-284.md)
and [sanitized measurements](../research/native-otel-issue-284-results.json)
retain the 2026-10-31 experiment. Two isolated headless Codex CLI 0.166.0
invocations using the actual model `gpt-6.1-sol` completed the requested turn.
Across those invocations, every captured native
resource group carried both `ticket.id=284` and `darrow.work_item_id=284`.
Langfuse 4.72.0 stored a subset of 512 observations from the second invocation with both values under
`resourceAttributes`. A transparent local proxy forwarded trace JSON unchanged,
adding only authentication and the Langfuse v4 ingestion header.

The constrained Docker VM caused timeouts and incomplete export. This proves
attribute propagation and persisted ingestion for the observed subset; it
does not prove complete delivery, reliability, plugin parity, UI filtering,
subagent behavior, Desktop or Cloud support, or live ticket switching. Native
trace presentation also includes noisy host internals. Current
[Claude monitoring documentation](https://code.claude.com/docs/en/monitoring-usage)
documents resource attributes for metrics/events and beta nested tracing;
there was no new live Claude test.

**Model inference:** Native propagation meets the selected ticket-correlation
need without maintaining a Darrow reconstruction/export runtime. That narrower
benefit supports removal even though the native output differs from the plugin.

## Decision

Remove `darrow-observability-langfuse` completely: both host manifests, skill,
hooks, Python backend and lock, fixtures, tests, evals, active specification,
marketplace entry and coupled repository tooling. Preserve historical research
and decision context, with durable links to the removed implementation.

Use native host OpenTelemetry exporters when telemetry is wanted. Configure
the exporters and destination explicitly; `OTEL_RESOURCE_ATTRIBUTES` alone
does not enable export. Set `ticket.id` and `darrow.work_item_id` in the host
process environment before launching a ticket session. Those attributes apply
at session/process scope; a later shell cannot change its parent host's
environment or recreate the removed mid-session epoch behavior.

Track launch-time environment setup and original-owner resume behavior for
Artificer separately in [issue #285](https://github.com/BjRo/darrow/issues/285).
This retirement does not implement that feature.

## Consequences

- Darrow no longer distributes or maintains the plugin's reconstruction,
  attribution, recovery, delivery, dependency or hook compatibility surface.
- Native telemetry needs explicit host exporter configuration and destination
  credentials. Adopters choose what data to export and the destination's
  retention policy through that configuration.
- The accepted loss of plugin-specific turn trees, epoch session grouping,
  mid-session attribution and branch inference is intentional. Native resource
  attributes are retained metadata; this decision makes no claim that Langfuse
  promotes them into top-level session fields or UI filters.
- Existing installed copies and local plugin state are not removed by a source
  change. The [migration guidance](../research/native-otel-issue-284.md#migration)
  explains how to stop using them and configure native telemetry.
- ADR-0008 is superseded by retirement, preserving its original context and
  consequences as history. ADR-0009 and unaffected plugins retain their policy,
  versions, tests and release checks.
