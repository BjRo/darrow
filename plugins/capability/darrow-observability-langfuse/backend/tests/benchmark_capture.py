"""Matched, deterministic control/candidate capture and export benchmark.

Use --source to select the control or candidate backend source tree. Each
invocation is a fresh process, with generated append-only input and an in-process
counting OTLP exporter (zero network delay and no remote ingestion claim).
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import resource
import sys
import tempfile
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any, cast

from langfuse import Langfuse
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult


class _Counter(SpanExporter):
    def __init__(self) -> None:
        self.requests = 0
        self.observations = 0

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        self.requests += 1
        self.observations += len(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        return None


def main() -> None:
    args = _arguments()
    sys.path.insert(0, args.source)
    modules = {
        name: importlib.import_module(f"darrow_observability_langfuse.{name}")
        for name in ("capture", "config", "delivery", "export", "rollout", "sidecar")
    }
    result = _Benchmark(args.mode, args.turns, modules).run()
    print(json.dumps(result))


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--mode", choices=["control", "candidate"], required=True)
    parser.add_argument("--turns", type=int, required=True)
    return parser.parse_args()


def _event(kind: str, **payload: Any) -> dict[str, Any]:
    return {
        "timestamp": "2026-09-10T10:00:00Z",
        "type": "event_msg",
        "payload": {"type": kind, **payload},
    }


class _Benchmark:
    def __init__(self, mode: str, turns: int, modules: dict[str, Any]) -> None:
        self.mode = mode
        self.turns = turns
        self.capture_module = modules["capture"]
        self.delivery_module = modules["delivery"]
        self.export_module = modules["export"]
        self.reconstruction = modules["rollout"]
        self.sidecar = modules["sidecar"]
        self.config = modules["config"].Config(
            enabled=True,
            public_key="pk-benchmark",
            secret_key="sk-benchmark",
            work_item_id="TEST-77",
        )
        self.counter = _Counter()
        self.client = Langfuse(
            public_key=self.config.public_key,
            secret_key=self.config.secret_key,
            flush_at=1 if mode == "control" else 512,
            flush_interval=86400,
            span_exporter=self.counter,
        )
        self.snapshots: dict[str, dict[str, Any]] = {}
        self.bytes_read = 0
        self.foreground_samples: list[float] = []
        self.input_bytes = 0
        self.outcome = 0
        self.digest = hashlib.sha256()
        self._instrument_loads()

    def _instrument_loads(self) -> None:
        original_load = self.reconstruction.load_rollout

        def measured_load(path: Path) -> list[dict[str, Any]]:
            self.bytes_read += path.stat().st_size
            return cast("list[dict[str, Any]]", original_load(path))

        self.reconstruction.load_rollout = measured_load

    def run(self) -> dict[str, Any]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "main.jsonl"
            self._write_header(path)
            start = time.perf_counter()
            for index in range(self.turns):
                identifier = str(index)
                self._append_turn(root, path, index)
                self._measure(path, directory, identifier)
            self._finish_candidate(path)
            elapsed = time.perf_counter() - start
        self._validate()
        return self._result(elapsed)

    def _write_header(self, path: Path) -> None:
        header = (
            json.dumps({"type": "session_meta", "payload": {"id": "benchmark-session"}})
            + "\n"
        )
        path.write_text(header)
        self.input_bytes += len(header.encode())
        self.digest.update(header.encode())

    def _append_turn(self, root: Path, path: Path, index: int) -> None:
        records = self._turn_records(index)
        if index % 100 == 0:
            child = f"child-{index}"
            self._write_child(root, child)
            records.append(_event("collab_agent_spawn_end", new_thread_id=child))
        records.extend(self._turn_end_records())
        content = "".join(json.dumps(row) + "\n" for row in records)
        self.input_bytes += len(content.encode())
        self.digest.update(content.encode())
        with path.open("a") as handle:
            handle.write(content)

    @staticmethod
    def _turn_records(index: int) -> list[dict[str, Any]]:
        records = [
            _event("task_started", turn_id=str(index)),
            {"type": "turn_context", "payload": {"model": "benchmark-model"}},
            _event("user_message", message="A fixed prompt of bounded length."),
        ]
        for tool in range(2):
            records.extend(_tool_records(tool))
        return records

    def _write_child(self, root: Path, child: str) -> None:
        content = "".join(json.dumps(row) + "\n" for row in _child_records(child))
        (root / f"rollout-{child}.jsonl").write_text(content)
        self.input_bytes += len(content.encode())
        self.digest.update(content.encode())

    @staticmethod
    def _turn_end_records() -> list[dict[str, Any]]:
        return [
            _event(
                "token_count",
                info={
                    "last_token_usage": {
                        "input_tokens": 20,
                        "output_tokens": 4,
                        "total_tokens": 24,
                    }
                },
            ),
            _event("task_complete"),
        ]

    def _measure(self, path: Path, directory: str, identifier: str) -> None:
        tick = time.perf_counter()
        if self.mode == "control":
            self._measure_control(path, directory, identifier)
        else:
            self._measure_candidate(path, directory, identifier)
        self.foreground_samples.append(time.perf_counter() - tick)

    def _measure_control(self, path: Path, directory: str, identifier: str) -> None:
        self.snapshots[identifier] = self.reconstruction.attribution_snapshot(
            self.config, directory
        )
        self.sidecar.record_attribution_snapshot(
            path, identifier, self.snapshots[identifier]
        )
        document = self.reconstruction.trace_document(
            path, self.config, directory, attribution_snapshots=self.snapshots
        )
        document = self.sidecar.pending_document(document, path)
        self.outcome += self._export(document, self.config)
        self.sidecar.mark_exported_turns(path, document)

    def _measure_candidate(self, path: Path, directory: str, identifier: str) -> None:
        metrics = self.capture_module.capture(
            path, self.config, directory, "benchmark-session", identifier, None
        )
        self.bytes_read += metrics["bytes_read"]
        self.delivery_module.drain(
            path, self.config, cwd=directory, exporter=self._export
        )

    def _export(self, document: dict[str, Any], settings: Any) -> int:
        return int(
            self.export_module.export_document(document, settings, client=self.client)
        )

    def _finish_candidate(self, path: Path) -> None:
        if self.mode == "candidate":
            rows = self.capture_module.delivery_rows(path)
            self.outcome = sum(row["state"] == "acknowledged" for row in rows)

    def _validate(self) -> None:
        expected = 4 * self.turns + 2 * ((self.turns + 99) // 100)
        assert self.outcome == self.turns, (self.outcome, self.turns)
        assert self.counter.observations == expected
        expected_requests = expected if self.mode == "control" else self.turns
        assert self.counter.requests == expected_requests
        if self.mode == "candidate":
            assert self.bytes_read <= self.input_bytes * 2

    def _result(self, elapsed: float) -> dict[str, Any]:
        peak = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        if sys.platform != "darwin":
            peak *= 1024
        startup = self.foreground_samples[0] if self.foreground_samples else 0.0
        steady = sum(self.foreground_samples[1:])
        steady_count = max(0, len(self.foreground_samples) - 1)
        return {
            "mode": self.mode,
            "turns": self.turns,
            "input_sha256": self.digest.hexdigest(),
            "bytes_read": self.bytes_read,
            "input_bytes": self.input_bytes,
            "exporter_requests": self.counter.requests,
            "observations": self.counter.observations,
            "startup_foreground_seconds": round(startup, 4),
            "steady_state_foreground_seconds": round(steady, 4),
            "steady_state_seconds_per_turn": round(
                steady / steady_count if steady_count else 0.0, 6
            ),
            "total_seconds": round(elapsed, 4),
            "peak_rss_bytes": int(peak),
            "acknowledged_turns": self.outcome,
        }


def _tool_records(tool: int) -> list[dict[str, Any]]:
    return [
        {
            "type": "response_item",
            "payload": {
                "type": "function_call",
                "call_id": str(tool),
                "name": "exec_command",
                "arguments": '{"cmd":"true"}',
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call_output",
                "call_id": str(tool),
                "output": "ok",
            },
        },
    ]


def _child_records(child: str) -> list[dict[str, Any]]:
    return [
        {
            "type": "session_meta",
            "payload": {"id": child, "parent_thread_id": "benchmark-session"},
        },
        _event("task_started", turn_id=f"{child}-turn"),
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "Child result"}],
            },
        },
        _event("task_complete"),
    ]


if __name__ == "__main__":
    main()
