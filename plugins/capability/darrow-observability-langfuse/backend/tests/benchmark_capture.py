"""Matched, deterministic control/candidate capture and export benchmark.

Use --source to select the control or candidate backend source tree. Each
invocation is a fresh process, with generated append-only input and an in-process
counting OTLP exporter (zero network delay and no remote ingestion claim).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import resource
import sys
import tempfile
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--mode", choices=["control", "candidate"], required=True)
    parser.add_argument("--turns", type=int, required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.source)
    from langfuse import Langfuse
    from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
    from darrow_observability_langfuse.config import Config
    from darrow_observability_langfuse.export import export_document
    from darrow_observability_langfuse import rollout as reconstruction
    from darrow_observability_langfuse.sidecar import pending_document, mark_exported_turns, record_attribution_snapshot

    class Counter(SpanExporter):
        requests = 0
        observations = 0
        def export(self, spans):
            self.requests += 1
            self.observations += len(spans)
            return SpanExportResult.SUCCESS
        def shutdown(self):
            pass

    config = Config(enabled=True, public_key="pk-benchmark", secret_key="sk-benchmark", work_item_id="TEST-77")
    counter = Counter()
    client = Langfuse(public_key=config.public_key, secret_key=config.secret_key,
                      flush_at=1 if args.mode == "control" else 512,
                      flush_interval=86400, span_exporter=counter)
    snapshots = {}
    bytes_read = 0
    foreground = 0
    outcome = 0
    original_load = reconstruction.load_rollout
    def measured_load(path):
        nonlocal bytes_read
        bytes_read += path.stat().st_size
        return original_load(path)
    reconstruction.load_rollout = measured_load
    if args.mode == "candidate":
        from darrow_observability_langfuse.capture import capture, delivery_rows
        from darrow_observability_langfuse.delivery import drain
    def export(document, settings):
        return export_document(document, settings, client=client)
    def event(kind, **payload):
        return {"timestamp": "2026-09-10T10:00:00Z", "type": "event_msg", "payload": {"type": kind, **payload}}
    digest = hashlib.sha256()
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        path = root / "main.jsonl"
        header = json.dumps({"type": "session_meta", "payload": {"id": "benchmark-session"}}) + "\n"
        path.write_text(header)
        digest.update(header.encode())
        start = time.perf_counter()
        for index in range(args.turns):
            identifier = str(index)
            records = [event("task_started", turn_id=identifier),
                       {"type": "turn_context", "payload": {"model": "benchmark-model"}},
                       event("user_message", message="A fixed prompt of bounded length.")]
            for tool in range(2):
                records.append({"type": "response_item", "payload": {"type": "function_call", "call_id": str(tool), "name": "exec_command", "arguments": '{"cmd":"true"}'}})
                records.append({"type": "response_item", "payload": {"type": "function_call_output", "call_id": str(tool), "output": "ok"}})
            if index % 100 == 0:
                child = f"child-{index}"
                child_records = [{"type": "session_meta", "payload": {"id": child, "parent_thread_id": "benchmark-session"}},
                                 event("task_started", turn_id=f"{child}-turn"),
                                 {"type": "response_item", "payload": {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "Child result"}]}},
                                 event("task_complete")]
                content = "".join(json.dumps(row) + "\n" for row in child_records)
                (root / f"rollout-{child}.jsonl").write_text(content)
                digest.update(content.encode())
                records.append(event("collab_agent_spawn_end", new_thread_id=child))
            records.extend([event("token_count", info={"last_token_usage": {"input_tokens": 20, "output_tokens": 4, "total_tokens": 24}}), event("task_complete")])
            content = "".join(json.dumps(row) + "\n" for row in records)
            digest.update(content.encode())
            with path.open("a") as handle:
                handle.write(content)
            tick = time.perf_counter()
            if args.mode == "control":
                snapshots[identifier] = reconstruction.attribution_snapshot(config, directory)
                record_attribution_snapshot(path, identifier, snapshots[identifier])
                document = reconstruction.trace_document(path, config, directory, attribution_snapshots=snapshots)
                document = pending_document(document, path)
                outcome += export(document, config)
                mark_exported_turns(path, document)
                foreground += time.perf_counter() - tick
            else:
                metrics = capture(path, config, directory, "benchmark-session", identifier, None)
                bytes_read += metrics["bytes_read"]
                foreground += time.perf_counter() - tick
                drain(path, config, cwd=directory, exporter=export)
        if args.mode == "candidate":
            outcome = sum(row["state"] == "acknowledged" for row in delivery_rows(path))
        elapsed = time.perf_counter() - start
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform != "darwin":
        peak *= 1024
    expected_observations = 4 * args.turns + 2 * ((args.turns + 99) // 100)
    assert outcome == args.turns, (outcome, args.turns)
    assert counter.observations == expected_observations
    assert counter.requests == (expected_observations if args.mode == "control" else args.turns)
    print(json.dumps({"mode": args.mode, "turns": args.turns, "input_sha256": digest.hexdigest(),
                      "bytes_read": bytes_read, "exporter_requests": counter.requests,
                      "observations": counter.observations, "foreground_seconds": round(foreground, 4),
                      "total_seconds": round(elapsed, 4), "peak_rss_bytes": peak,
                      "acknowledged_turns": outcome}))


if __name__ == "__main__":
    main()
