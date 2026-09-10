from __future__ import annotations

import base64
from importlib.metadata import version
from typing import Any

from .config import Config

_CLIENTS: dict[str, tuple[Any, Any, Config]] = {}

class DeliveryFailure(RuntimeError):
    def __init__(self, outcome: str, message: str):
        super().__init__(message)
        self.outcome = outcome


class SingleAttemptExporter:
    """OTLP HTTP without retries after ambiguous acceptance."""
    def __init__(self, config: Config):
        self.config = config
        self.failure = None
        self.accepted = 0

    def export(self, spans):
        import requests
        from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
        from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceResponse
        from opentelemetry.sdk.trace.export import SpanExportResult
        from urllib3.exceptions import NewConnectionError

        config = self.config
        credentials = base64.b64encode(f"{config.public_key}:{config.secret_key}".encode()).decode()
        try:
            response = requests.post(
                f"{config.base_url.rstrip('/')}/api/public/otel/v1/traces",
                data=encode_spans(spans).SerializeToString(),
                headers={"Authorization": f"Basic {credentials}",
                         "Content-Type": "application/x-protobuf",
                         "x-langfuse-sdk-name": "python",
                         "x-langfuse-sdk-version": version("langfuse"),
                         "x-langfuse-public-key": config.public_key or "",
                         "x-langfuse-ingestion-version": "4"},
                timeout=(5, 5), allow_redirects=False,
            )
            if response.status_code != 200:
                definite = response.status_code in {400, 401, 403, 404, 405, 413, 415, 422, 429}
                raise DeliveryFailure("pending" if definite and not self.accepted else "uncertain",
                                      f"Langfuse HTTP rejection ({response.status_code})")
            if response.content:
                result = ExportTraceServiceResponse()
                if "json" in response.headers.get("Content-Type", "").lower():
                    from google.protobuf.json_format import ParseDict
                    body = response.json()
                    # Langfuse v4's accepted queue response is a BullMQ job,
                    # while standard OTLP servers return ExportTraceServiceResponse.
                    queued = (isinstance(body, dict)
                              and body.get("name") == "otel-ingestion-job"
                              and isinstance(body.get("data"), dict)
                              and isinstance(body["data"].get("id"), str))
                    if queued and ("partialSuccess" in body or "partial_success" in body):
                        ParseDict({key: value for key, value in body.items()
                                   if key in {"partialSuccess", "partial_success"}}, result)
                    elif not queued:
                        ParseDict(body, result)
                else:
                    result.ParseFromString(response.content)
                if result.partial_success.rejected_spans or result.partial_success.error_message:
                    raise DeliveryFailure("uncertain", "Langfuse reported partial ingestion")
            self.accepted += len(spans)
            return SpanExportResult.SUCCESS
        except DeliveryFailure as error:
            self.failure = error
        except (requests.exceptions.InvalidURL, requests.exceptions.InvalidSchema,
                requests.exceptions.MissingSchema, requests.exceptions.InvalidHeader,
                requests.exceptions.URLRequired, requests.exceptions.ConnectTimeout):
            outcome = "pending" if not self.accepted else "uncertain"
            self.failure = DeliveryFailure(outcome, "Langfuse request could not be started")
        except requests.exceptions.ConnectionError as error:
            def refused(value, seen=None):
                seen = seen or set()
                if id(value) in seen:
                    return False
                seen.add(id(value))
                return isinstance(value, NewConnectionError) or any(
                    refused(child, seen) for child in (
                        getattr(value, "reason", None), getattr(value, "__cause__", None),
                        *getattr(value, "args", ())) if isinstance(child, BaseException))
            outcome = "pending" if refused(error) and not self.accepted else "uncertain"
            self.failure = DeliveryFailure(outcome, "Langfuse connection failed")
        except Exception:
            self.failure = DeliveryFailure("uncertain", "Langfuse response was not confirmed")
        return SpanExportResult.FAILURE

    def force_flush(self, timeout_millis=30000):
        return True

    def shutdown(self):
        pass


def _new_recording_client(config: Config) -> tuple[Any, Any]:
    from langfuse import Langfuse
    from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

    key = config.public_key or ""
    if key in _CLIENTS:
        client, exporter, original = _CLIENTS[key]
        if original != config:
            raise ValueError("Langfuse configuration changed within a delivery process")
        exporter.reset()
        return client, exporter
    delegate = SingleAttemptExporter(config)

    class RecordingExporter(SpanExporter):
        def __init__(self) -> None:
            self.results: list[Any] = []
            self.count = 0

        def reset(self):
            self.results.clear()
            self.count = 0
            delegate.accepted = 0
            delegate.failure = None

        def export(self, spans: Any) -> Any:
            if delegate.failure is not None:
                return SpanExportResult.FAILURE
            result = delegate.export(spans)
            self.results.append(result)
            if result is SpanExportResult.SUCCESS:
                self.count += len(spans)
            return result

        def force_flush(self, timeout_millis: int = 30_000) -> bool:
            return delegate.force_flush(timeout_millis=timeout_millis)

        def shutdown(self) -> None:
            delegate.shutdown()

        def failed(self) -> bool:
            return any(result is not SpanExportResult.SUCCESS for result in self.results)

        def failure(self):
            return delegate.failure

    exporter = RecordingExporter()
    client = Langfuse(
        public_key=config.public_key,
        secret_key=config.secret_key,
        base_url=config.base_url,
        debug=config.debug,
        timeout=5,
        flush_at=512,
        flush_interval=86400,
        sample_rate=1,
        tracing_enabled=True,
        span_exporter=exporter,
    )
    _CLIENTS[key] = (client, exporter, config)
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


def _export_children(parent: Any, children: list[dict[str, Any]], ended) -> None:
    for child_value in children:
        child = parent.start_observation(**_observation_attributes(child_value))
        _export_children(child, child_value.get("children") or [], ended)
        child.end()
        ended()


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

    ended_count = 0

    def ended():
        nonlocal ended_count
        ended_count += 1
        # Explicit flush bounds the SDK queue even for very large turn trees.
        if ended_count % 512 == 0:
            client.flush()

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
        attributes = _observation_attributes(root_value)
        delivery_id = (trace.get("metadata") or {}).get("darrow.delivery_id")
        if delivery_id:
            attributes["trace_context"] = {"trace_id": delivery_id[:32]}
        with client.start_as_current_observation(**attributes) as root:
            metadata = trace.get("metadata") or {}
            trace_metadata = {
                key: metadata[key]
                for key in (
                    "codex.thread_id",
                    "darrow.attribution_epoch",
                    "darrow.attribution_source",
                    "darrow.work_item_id",
                    "darrow.delivery_id",
                    "darrow.expected_observation_count",
                    "git.branch",
                    "git.head",
                )
                if metadata.get(key) is not None
            }
            with propagate_attributes(
                session_id=trace.get("session_id"),
                metadata=trace_metadata or None,
            ):
                _export_children(root, trace.get("observations") or [], ended)
        ended()

    client.flush()
    if recording_exporter is not None and recording_exporter.failed():
        raise recording_exporter.failure() or DeliveryFailure("uncertain", "Langfuse exporter rejected the trace batch")
    if recording_exporter is not None and recording_exporter.count != ended_count:
        raise DeliveryFailure("uncertain", "Langfuse observation count was not confirmed")
    return len(traces)
