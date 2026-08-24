from __future__ import annotations

import base64
from typing import Any

from .config import Config


def _new_recording_client(config: Config) -> tuple[Any, Any]:
    from langfuse import Langfuse
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

    credentials = base64.b64encode(
        f"{config.public_key}:{config.secret_key}".encode("utf-8")
    ).decode("ascii")
    delegate = OTLPSpanExporter(
        endpoint=f"{config.base_url.rstrip('/')}/api/public/otel/v1/traces",
        headers={
            "Authorization": f"Basic {credentials}",
            "x-langfuse-sdk-name": "python",
            "x-langfuse-public-key": config.public_key or "",
        },
        timeout=5,
    )

    class RecordingExporter(SpanExporter):
        def __init__(self) -> None:
            self.results: list[Any] = []

        def export(self, spans: Any) -> Any:
            result = delegate.export(spans)
            self.results.append(result)
            return result

        def force_flush(self, timeout_millis: int = 30_000) -> bool:
            return delegate.force_flush(timeout_millis=timeout_millis)

        def shutdown(self) -> None:
            delegate.shutdown()

        def failed(self) -> bool:
            return any(result is not SpanExportResult.SUCCESS for result in self.results)

    exporter = RecordingExporter()
    client = Langfuse(
        public_key=config.public_key,
        secret_key=config.secret_key,
        base_url=config.base_url,
        debug=config.debug,
        timeout=5,
        flush_at=1,
        span_exporter=exporter,
    )
    return client, exporter


def _observation_attributes(value: dict[str, Any]) -> dict[str, Any]:
    attributes: dict[str, Any] = {
        "name": value["name"],
        "as_type": value.get("type", "span"),
        "metadata": {
            **(value.get("metadata") or {}),
            "darrow.original_start_time": value.get("start_time"),
            "darrow.original_end_time": value.get("end_time"),
        },
    }
    for key in ("input", "output", "model", "usage_details"):
        if value.get(key) is not None:
            attributes[key] = value[key]
    if value.get("error"):
        attributes["level"] = "ERROR"
        attributes["status_message"] = str(value["error"])
    return attributes


def _export_children(parent: Any, children: list[dict[str, Any]]) -> None:
    for child_value in children:
        child = parent.start_observation(**_observation_attributes(child_value))
        _export_children(child, child_value.get("children") or [])
        child.end()


def export_document(
    document: dict[str, Any],
    config: Config,
    *,
    client: Any | None = None,
) -> int:
    from langfuse import propagate_attributes

    recording_exporter = None
    if client is None:
        client, recording_exporter = _new_recording_client(config)

    traces = document.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")

    for trace in traces:
        if not isinstance(trace, dict):
            raise ValueError("trace document contains an invalid trace")
        root_value = {
            **trace,
            "type": "agent",
            "metadata": {
                **(trace.get("metadata") or {}),
                "codex.session_id": trace.get("session_id"),
            },
        }
        with client.start_as_current_observation(
            **_observation_attributes(root_value)
        ) as root:
            work_item_id = (trace.get("metadata") or {}).get(
                "darrow.work_item_id"
            )
            trace_metadata = (
                {"darrow.work_item_id": work_item_id} if work_item_id else None
            )
            with propagate_attributes(
                session_id=trace.get("session_id"),
                metadata=trace_metadata,
            ):
                _export_children(root, trace.get("observations") or [])

    client.flush()
    if recording_exporter is not None and recording_exporter.failed():
        raise RuntimeError("Langfuse exporter rejected the trace batch")
    return len(traces)
