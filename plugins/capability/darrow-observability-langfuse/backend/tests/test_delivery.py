from __future__ import annotations

import json
import multiprocessing
import socket
import sqlite3
import tempfile
import threading
import time
import unittest
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from typing import Any, ClassVar
from unittest.mock import patch

from darrow_observability_langfuse.capture import capture, delivery_rows
from darrow_observability_langfuse.cli import run
from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.delivery import await_capture, drain
from darrow_observability_langfuse.export import DeliveryError, export_document


class _EndpointHandler(BaseHTTPRequestHandler):
    mode = "ok"
    delay = 0.0
    recorded: ClassVar[list[tuple[str, dict[str, str], bytes]]] = []

    def log_message(self, _format: str, *_args: Any) -> None:
        return None

    def do_POST(self) -> None:
        data = self.rfile.read(int(self.headers["Content-Length"]))
        self.recorded.append((self.path, dict(self.headers), data))
        if self.delay:
            time.sleep(self.delay)
        if self._close_lost_connection():
            return
        self.send_response(401 if self.mode == "reject" else 200)
        self._write_response()

    def _close_lost_connection(self) -> bool:
        if self.mode != "loss":
            return False
        self.connection.shutdown(socket.SHUT_RDWR)
        self.connection.close()
        return True

    def _write_response(self) -> None:
        if self.mode in {"json", "queue", "queue-partial"}:
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        bodies = {
            "json": b"{}",
            "queue": b'{"name":"otel-ingestion-job","data":{"id":"accepted-job"}}',
            "queue-partial": b'{"name":"otel-ingestion-job","data":{"id":"accepted-job"},"partialSuccess":{"rejectedSpans":1}}',
        }
        if self.mode in bodies:
            self.wfile.write(bodies[self.mode])
        if self.mode == "partial":
            self.wfile.write(_partial_response())


def _partial_response() -> bytes:
    from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
        ExportTraceServiceResponse,
    )

    result = ExportTraceServiceResponse()
    result.partial_success.rejected_spans = 1
    return result.SerializeToString()


def rollout(path: Path, count: int = 1) -> None:
    records = [{"type": "session_meta", "payload": {"id": "session"}}]
    for index in range(count):
        records.extend(
            [
                {
                    "type": "event_msg",
                    "payload": {"type": "task_started", "turn_id": str(index)},
                },
                {"type": "event_msg", "payload": {"type": "task_complete"}},
            ]
        )
    path.write_text("".join(json.dumps(row) + "\n" for row in records))


def capture_worker(path: str, turn: str) -> None:
    capture(
        Path(path), Config(enabled=True), str(Path(path).parent), "session", turn, None
    )


def terminate_worker(path: str, config: Config, started: Any) -> None:
    def exporter(_document: dict[str, Any], _config: Config) -> int:
        started.set()
        time.sleep(30)
        return 0

    drain(Path(path), config, cwd=str(Path(path).parent), exporter=exporter)


def terminate_capture_worker(path: str, config: Config, started: Any) -> None:
    from darrow_observability_langfuse import capture as module

    def paused(connection: sqlite3.Connection, key: str, value: Any) -> None:
        started.set()
        time.sleep(30)

    module._put = paused
    module.capture(Path(path), config, str(Path(path).parent), "session", "0", None)


@contextmanager
def endpoint(
    mode: str = "ok", delay: float = 0
) -> Iterator[tuple[str, list[tuple[str, dict[str, str], bytes]]]]:
    requests: list[tuple[str, dict[str, str], bytes]] = []
    handler = type(
        "EndpointHandler",
        (_EndpointHandler,),
        {"mode": mode, "delay": delay, "recorded": requests},
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class DeliveryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "rollout.jsonl"
        rollout(self.path)

    def tearDown(self) -> None:
        self.directory.cleanup()

    def config(self, url: str = "http://127.0.0.1:1") -> Config:
        return Config(
            enabled=True,
            strict=True,
            public_key="pk-" + uuid.uuid4().hex,
            secret_key="sk-private",
            base_url=url,
        )

    def capture(self, config: Config) -> dict[str, int]:
        return capture(self.path, config, self.directory.name, "session", "0", None)

    def test_session_start_and_prompt_hooks_recover_pending_work(self) -> None:
        for event in ("SessionStart", "UserPromptSubmit"):
            with self.subTest(event=event), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "rollout.jsonl"
                rollout(path)
                config = self.config()
                capture(path, config, directory, "session", "0", None)
                payload = {
                    "hook_event_name": event,
                    "session_id": "session",
                    "cwd": directory,
                    "transcript_path": str(path),
                }
                with (
                    patch("sys.stdin", StringIO(json.dumps(payload))),
                    patch(
                        "darrow_observability_langfuse.cli.load_config",
                        return_value=config,
                    ),
                    patch(
                        "darrow_observability_langfuse.cli.export_document",
                        return_value=1,
                    ) as exporter,
                ):
                    self.assertEqual(run(background=True), 0)
                    exporter.assert_called_once()
                self.assertEqual(delivery_rows(path)[0]["state"], "acknowledged")

    def test_foreground_never_contacts_delayed_or_unavailable_endpoint(self) -> None:
        for delay in (0, 0.5):
            with endpoint(delay=delay) as (url, requests):
                config = self.config(url)
                self.path = Path(self.directory.name) / f"rollout-{delay}.jsonl"
                rollout(self.path)
                payload = {
                    "hook_event_name": "Stop",
                    "session_id": "session",
                    "turn_id": "0",
                    "cwd": self.directory.name,
                    "transcript_path": str(self.path),
                }
                with (
                    patch("sys.stdin", StringIO(json.dumps(payload))),
                    patch(
                        "darrow_observability_langfuse.cli.load_config",
                        return_value=config,
                    ),
                ):
                    start = time.monotonic()
                    self.assertEqual(run(), 0)
                    self.assertLess(time.monotonic() - start, 2)
                self.assertEqual(requests, [])
        self.assertEqual(delivery_rows(self.path)[0]["state"], "pending")

    def test_real_otlp_batch_headers_and_large_queue(self) -> None:
        from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
            ExportTraceServiceRequest,
        )

        with endpoint() as (url, requests):
            config = self.config(url)
            for count in (200, 3000):
                requests.clear()
                document = {
                    "traces": [
                        {
                            "name": "root",
                            "observations": [
                                {"name": "tool", "type": "tool"} for _ in range(count)
                            ],
                        }
                    ]
                }
                self.assertEqual(export_document(document, config), 1)
                sizes = []
                for path, headers, body in requests:
                    self.assertEqual(path, "/api/public/otel/v1/traces")
                    self.assertEqual(headers["x-langfuse-ingestion-version"], "4")
                    self.assertIn("x-langfuse-sdk-version", headers)
                    message = ExportTraceServiceRequest.FromString(body)
                    sizes.append(
                        sum(
                            len(scope.spans)
                            for resource in message.resource_spans
                            for scope in resource.scope_spans
                        )
                    )
                self.assertEqual(sum(sizes), count + 1)
                self.assertTrue(all(size <= 512 for size in sizes))
                if count == 200:
                    self.assertEqual(sizes, [201])

    def test_http_rejection_response_loss_partial_ingestion_and_success(self) -> None:
        for mode, expected in (
            ("reject", "pending"),
            ("loss", "uncertain"),
            ("partial", "uncertain"),
            ("queue-partial", "uncertain"),
            ("ok", "acknowledged"),
            ("json", "acknowledged"),
            ("queue", "acknowledged"),
        ):
            with (
                self.subTest(mode=mode),
                tempfile.TemporaryDirectory() as directory,
                endpoint(mode) as (url, requests),
            ):
                path = Path(directory) / "rollout.jsonl"
                rollout(path)
                config = self.config(url)
                capture(path, config, directory, "session", "0", None)
                if mode in {"ok", "json", "queue"}:
                    self.assertEqual(drain(path, config, cwd=directory), 1)
                else:
                    with self.assertRaises(DeliveryError):
                        drain(path, config, cwd=directory)
                row = delivery_rows(path)[0]
                self.assertEqual(row["state"], expected)
                self.assertEqual(row["expected_count"], 1)
                self.assertEqual(len(requests), 1)
                if expected == "uncertain":
                    self.assertEqual(drain(path, config, cwd=directory), 0)
                    self.assertEqual(len(requests), 1)

    def test_connection_refusal_is_retryable_and_snapshot_is_stable(self) -> None:
        config = self.config()
        self.capture(config)
        before = delivery_rows(self.path)[0]
        with self.assertRaises(DeliveryError) as caught:
            drain(self.path, config, cwd=self.directory.name)
        self.assertEqual(caught.exception.outcome, "pending")
        self.assertEqual(delivery_rows(self.path)[0]["document"], before["document"])
        self.assertEqual(
            drain(
                self.path,
                config,
                cwd=self.directory.name,
                exporter=lambda doc, cfg: len(doc["traces"]),
            ),
            1,
        )

    def test_invalid_url_before_request_remains_pending_without_destination_rebinding(
        self,
    ) -> None:
        config = self.config("not-a-url")
        self.capture(config)
        before = delivery_rows(self.path)[0]
        with self.assertRaises(DeliveryError) as caught:
            drain(self.path, config, cwd=self.directory.name)
        self.assertEqual(caught.exception.outcome, "pending")
        self.assertEqual(delivery_rows(self.path)[0]["state"], "pending")
        with endpoint() as (url, requests):
            with self.assertRaisesRegex(ValueError, "delivery context"):
                drain(self.path, self.config(url), cwd=self.directory.name)
            self.assertEqual(requests, [])
        after = delivery_rows(self.path)[0]
        self.assertEqual(
            (after["identity"], after["document"], after["expected_count"]),
            (before["identity"], before["document"], before["expected_count"]),
        )

    def test_single_drainer_does_not_block_foreground_capture(self) -> None:
        config = self.config()
        self.capture(config)
        started, finish = threading.Event(), threading.Event()

        def slow_export(doc: dict[str, Any], _config: Config) -> int:
            started.set()
            finish.wait(5)
            return len(doc["traces"])

        thread = threading.Thread(
            target=lambda: drain(
                self.path, config, cwd=self.directory.name, exporter=slow_export
            )
        )
        thread.start()
        try:
            self.assertTrue(started.wait(2))
            self.assertEqual(
                drain(
                    self.path,
                    config,
                    cwd=self.directory.name,
                    exporter=lambda *args: self.fail("second drainer exported"),
                ),
                0,
            )
            self.assertEqual(self.capture(config)["bytes_read"], 0)
        finally:
            finish.set()
            thread.join()

    def test_terminated_delivery_is_uncertain_and_backlog_recovers(self) -> None:
        config = self.config()
        self.capture(config)
        context = multiprocessing.get_context("spawn")
        started = context.Event()
        process = context.Process(
            target=terminate_worker, args=(str(self.path), config, started)
        )
        process.start()
        self.assertTrue(started.wait(5))
        process.terminate()
        process.join(5)
        self.assertFalse(process.is_alive())
        self.assertEqual(delivery_rows(self.path)[0]["state"], "uncertain")
        rollout(self.path, 3)
        capture(self.path, config, self.directory.name, "session", "1", None)
        capture(self.path, config, self.directory.name, "session", "2", None)
        self.assertEqual(
            drain(
                self.path,
                config,
                cwd=self.directory.name,
                exporter=lambda doc, cfg: len(doc["traces"]),
            ),
            2,
        )
        self.assertEqual(
            [row["state"] for row in delivery_rows(self.path)],
            ["uncertain", "acknowledged", "acknowledged"],
        )

    def test_terminated_capture_rolls_back_atomic_local_state(self) -> None:
        config = self.config()
        context = multiprocessing.get_context("spawn")
        started = context.Event()
        process = context.Process(
            target=terminate_capture_worker, args=(str(self.path), config, started)
        )
        process.start()
        self.assertTrue(started.wait(5))
        process.terminate()
        process.join(5)
        self.assertFalse(process.is_alive())
        self.assertEqual(delivery_rows(self.path), [])
        self.assertEqual(self.capture(config)["bytes_read"], self.path.stat().st_size)

    def test_reordered_concurrent_capture_and_early_background_hook(self) -> None:
        rollout(self.path, 8)
        ready = []
        thread = threading.Thread(
            target=lambda: ready.append(await_capture(self.path, "7", timeout=5))
        )
        thread.start()
        context = multiprocessing.get_context("spawn")
        processes = [
            context.Process(target=capture_worker, args=(str(self.path), str(index)))
            for index in (7, 0, 4, 7)
        ]
        for process in processes:
            process.start()
        for process in processes:
            process.join(10)
            self.assertEqual(process.exitcode, 0)
        thread.join(5)
        self.assertEqual(ready, [True])
        self.assertEqual(len(delivery_rows(self.path)), 1)
        from darrow_observability_langfuse.lifecycle import record_terminal

        record_terminal(
            self.path,
            "session",
            "SessionEnd",
            None,
            Config(enabled=True),
            None,
            cwd=self.directory.name,
        )
        capture(
            self.path, Config(enabled=True), self.directory.name, "session", None, None
        )
        self.assertEqual(len(delivery_rows(self.path)), 8)


if __name__ == "__main__":
    unittest.main()
