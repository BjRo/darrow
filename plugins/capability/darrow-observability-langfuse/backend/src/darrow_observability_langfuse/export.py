from __future__ import annotations

import base64
from collections.abc import Callable
from importlib.metadata import version
from typing import Any

from opentelemetry.sdk.trace.export import SpanExporter

from .config import Config

_CLIENTS: dict[str, tuple[Any, Any, Config]] = {}


class DeliveryError(RuntimeError):
    def __init__(self, outcome: str, message: str) -> None:
        super().__init__(message)
        self.outcome = outcome


class SingleAttemptExporter:
    """OTLP HTTP without retries after ambiguous acceptance."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self.failure: DeliveryError | None = None
        self.accepted = 0

    def export(self, spans: Any) -> Any:
        from opentelemetry.sdk.trace.export import SpanExportResult

        try:
            response = self._post(spans)
            self._validate_response(response)
            self.accepted += len(spans)
            return SpanExportResult.SUCCESS
        except Exception as error:
            self.failure = self._classify_failure(error)
        return SpanExportResult.FAILURE

    def _post(self, spans: Any) -> Any:
        import requests
        from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans

        credentials = base64.b64encode(
            f"{self.config.public_key}:{self.config.secret_key}".encode()
        ).decode()
        return requests.post(
            f"{self.config.base_url.rstrip('/')}/api/public/otel/v1/traces",
            data=encode_spans(spans).SerializeToString(),
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-protobuf",
                "x-langfuse-sdk-name": "python",
                "x-langfuse-sdk-version": version("langfuse"),
                "x-langfuse-public-key": self.config.public_key or "",
                "x-langfuse-ingestion-version": "4",
            },
            timeout=(5, 5),
            allow_redirects=False,
        )

    def _validate_response(self, response: Any) -> None:
        if response.status_code != 200:
            self._reject_status(response.status_code)
        if response.content:
            self._validate_content(response)

    def _reject_status(self, status_code: int) -> None:
        definite = status_code in {400, 401, 403, 404, 405, 413, 415, 422, 429}
        outcome = "pending" if definite and not self.accepted else "uncertain"
        raise DeliveryError(outcome, f"Langfuse HTTP rejection ({status_code})")

    @staticmethod
    def _validate_content(response: Any) -> None:
        from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
            ExportTraceServiceResponse,
        )

        result = ExportTraceServiceResponse()
        if "json" in response.headers.get("Content-Type", "").lower():
            _parse_json_response(response.json(), result)
        else:
            result.ParseFromString(response.content)
        if (
            result.partial_success.rejected_spans
            or result.partial_success.error_message
        ):
            raise DeliveryError("uncertain", "Langfuse reported partial ingestion")

    def _classify_failure(self, error: Exception) -> DeliveryError:
        import requests

        if isinstance(error, DeliveryError):
            return error
        if isinstance(error, _pre_request_errors(requests)):
            outcome = "pending" if not self.accepted else "uncertain"
            return DeliveryError(outcome, "Langfuse request could not be started")
        if isinstance(error, requests.exceptions.ConnectionError):
            outcome = (
                "pending"
                if _connection_refused(error, set()) and not self.accepted
                else "uncertain"
            )
            return DeliveryError(outcome, "Langfuse connection failed")
        return DeliveryError("uncertain", "Langfuse response was not confirmed")

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return True

    def shutdown(self) -> None:
        return None


def _parse_json_response(body: Any, result: Any) -> None:
    from google.protobuf.json_format import ParseDict

    queued = _queued_response(body)
    if queued and isinstance(body, dict):
        partial = {
            key: value
            for key, value in body.items()
            if key in {"partialSuccess", "partial_success"}
        }
        if partial:
            ParseDict(partial, result)
    elif not queued:
        ParseDict(body, result)


def _queued_response(body: Any) -> bool:
    return (
        isinstance(body, dict)
        and body.get("name") == "otel-ingestion-job"
        and isinstance(body.get("data"), dict)
        and isinstance(body["data"].get("id"), str)
    )


def _pre_request_errors(requests: Any) -> tuple[type[Exception], ...]:
    return (
        requests.exceptions.InvalidURL,
        requests.exceptions.InvalidSchema,
        requests.exceptions.MissingSchema,
        requests.exceptions.InvalidHeader,
        requests.exceptions.URLRequired,
        requests.exceptions.ConnectTimeout,
    )


def _connection_refused(value: BaseException, seen: set[int]) -> bool:
    from urllib3.exceptions import NewConnectionError

    if id(value) in seen:
        return False
    seen.add(id(value))
    children = (
        getattr(value, "reason", None),
        getattr(value, "__cause__", None),
        *getattr(value, "args", ()),
    )
    return isinstance(value, NewConnectionError) or any(
        _connection_refused(child, seen)
        for child in children
        if isinstance(child, BaseException)
    )


class _RecordingExporter(SpanExporter):
    def __init__(self, delegate: SingleAttemptExporter) -> None:
        self.delegate = delegate
        self.results: list[Any] = []
        self.count = 0

    def reset(self) -> None:
        self.results.clear()
        self.count = 0
        self.delegate.accepted = 0
        self.delegate.failure = None

    def export(self, spans: Any) -> Any:
        from opentelemetry.sdk.trace.export import SpanExportResult

        if self.delegate.failure is not None:
            return SpanExportResult.FAILURE
        result = self.delegate.export(spans)
        self.results.append(result)
        if result is SpanExportResult.SUCCESS:
            self.count += len(spans)
        return result

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return self.delegate.force_flush(timeout_millis=timeout_millis)

    def shutdown(self) -> None:
        self.delegate.shutdown()

    def failed(self) -> bool:
        from opentelemetry.sdk.trace.export import SpanExportResult

        return any(result is not SpanExportResult.SUCCESS for result in self.results)

    def failure(self) -> DeliveryError | None:
        return self.delegate.failure


def _new_recording_client(config: Config) -> tuple[Any, _RecordingExporter]:
    from langfuse import Langfuse

    key = config.public_key or ""
    if key in _CLIENTS:
        client, exporter, original = _CLIENTS[key]
        if original != config:
            raise ValueError("Langfuse configuration changed within a delivery process")
        exporter.reset()
        return client, exporter
    delegate = SingleAttemptExporter(config)
    exporter = _RecordingExporter(delegate)
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


def _export_children(
    parent: Any, children: list[dict[str, Any]], ended: Callable[[], None]
) -> None:
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
    recording_exporter: Any | None = None
    if client is None:
        client, recording_exporter = _new_recording_client(config)
    traces = _validated_traces(document)
    counter = _EndedCounter(client)
    for trace in traces:
        _export_trace(client, trace, counter)
    client.flush()
    _verify_recording(recording_exporter, counter.count)
    return len(traces)


def _validated_traces(document: dict[str, Any]) -> list[dict[str, Any]]:
    traces = document.get("traces")
    if not isinstance(traces, list):
        raise ValueError("trace document is missing traces")
    if any(not isinstance(trace, dict) for trace in traces):
        raise ValueError("trace document contains an invalid trace")
    return traces


class _EndedCounter:
    def __init__(self, client: Any) -> None:
        self.client = client
        self.count = 0

    def __call__(self) -> None:
        self.count += 1
        if self.count % 512 == 0:
            self.client.flush()


def _export_trace(client: Any, trace: dict[str, Any], ended: _EndedCounter) -> None:
    from langfuse import propagate_attributes

    attributes = _observation_attributes(_root_value(trace))
    delivery_id = (trace.get("metadata") or {}).get("darrow.delivery_id")
    if delivery_id:
        attributes["trace_context"] = {"trace_id": delivery_id[:32]}
    with (
        client.start_as_current_observation(**attributes) as root,
        propagate_attributes(
            session_id=trace.get("session_id"),
            metadata=_trace_metadata(trace) or None,
        ),
    ):
        _export_children(root, trace.get("observations") or [], ended)
    ended()


def _root_value(trace: dict[str, Any]) -> dict[str, Any]:
    return {
        **trace,
        "type": "agent",
        "metadata": {
            **(trace.get("metadata") or {}),
            "codex.session_id": trace.get("session_id"),
        },
    }


def _trace_metadata(trace: dict[str, Any]) -> dict[str, Any]:
    metadata = trace.get("metadata") or {}
    keys = (
        "codex.thread_id",
        "darrow.attribution_epoch",
        "darrow.attribution_source",
        "darrow.work_item_id",
        "darrow.delivery_id",
        "darrow.expected_observation_count",
        "git.branch",
        "git.head",
    )
    return {key: metadata[key] for key in keys if metadata.get(key) is not None}


def _verify_recording(recording_exporter: Any | None, ended_count: int) -> None:
    if recording_exporter is None:
        return
    if recording_exporter.failed():
        raise recording_exporter.failure() or DeliveryError(
            "uncertain", "Langfuse exporter rejected the trace batch"
        )
    if recording_exporter.count != ended_count:
        raise DeliveryError("uncertain", "Langfuse observation count was not confirmed")
