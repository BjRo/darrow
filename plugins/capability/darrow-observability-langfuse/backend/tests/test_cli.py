from __future__ import annotations

import json
import tempfile
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from darrow_observability_langfuse.cli import run
from darrow_observability_langfuse.config import Config


class CliTest(unittest.TestCase):
    def test_repeated_stop_exports_each_turn_once_before_task_complete_is_written(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            records = [
                {
                    "timestamp": "2026-08-24T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.000Z",
                    "type": "event_msg",
                    "payload": {"type": "task_started", "turn_id": "turn-1"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.100Z",
                    "type": "turn_context",
                    "payload": {"model": "gpt-5.6-sol"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.200Z",
                    "type": "event_msg",
                    "payload": {"type": "user_message", "message": "First turn"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.300Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": "First response"}],
                    },
                },
            ]
            rollout.write_text(
                "".join(f"{json.dumps(record)}\n" for record in records),
                encoding="utf-8",
            )
            exported: list[dict] = []

            self._run_stop(rollout, "turn-1", exported)

            records.extend(
                [
                    {
                        "timestamp": "2026-08-24T10:00:02.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:03.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:03.100Z",
                        "type": "turn_context",
                        "payload": {"model": "gpt-5.6-sol"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:03.200Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Second turn"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:03.300Z",
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "assistant",
                            "content": [
                                {"type": "output_text", "text": "Second response"}
                            ],
                        },
                    },
                ]
            )
            rollout.write_text(
                "".join(f"{json.dumps(record)}\n" for record in records),
                encoding="utf-8",
            )

            self._run_stop(rollout, "turn-2", exported)

        self.assertEqual(
            [
                [trace["metadata"]["codex.turn_id"] for trace in document["traces"]]
                for document in exported
            ],
            [["turn-1"], ["turn-2"]],
        )

    def test_stop_does_not_export_an_unrelated_incomplete_turn(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            records = [
                {
                    "timestamp": "2026-08-24T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.000Z",
                    "type": "event_msg",
                    "payload": {"type": "task_started", "turn_id": "interrupted"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.100Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": "Partial"}],
                    },
                },
                {
                    "timestamp": "2026-08-24T10:00:02.000Z",
                    "type": "event_msg",
                    "payload": {"type": "task_started", "turn_id": "current"},
                },
                {
                    "timestamp": "2026-08-24T10:00:02.100Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": "Complete"}],
                    },
                },
            ]
            rollout.write_text(
                "".join(f"{json.dumps(record)}\n" for record in records),
                encoding="utf-8",
            )
            exported: list[dict] = []

            self._run_stop(rollout, "current", exported)

        self.assertEqual(
            [
                trace["metadata"]["codex.turn_id"]
                for trace in exported[0]["traces"]
            ],
            ["current"],
        )

    def _run_stop(
        self, rollout: Path, turn_id: str, exported: list[dict]
    ) -> None:
        payload = {
            "session_id": "session-main",
            "turn_id": turn_id,
            "cwd": str(rollout.parent),
            "transcript_path": str(rollout),
            "hook_event_name": "Stop",
        }
        config = Config(
            enabled=True,
            public_key="pk-test",
            secret_key="sk-test",
            work_item_id="TEST-1",
        )

        def record_export(document: dict, _config: Config) -> int:
            exported.append(document)
            return len(document["traces"])

        with (
            patch("sys.stdin", StringIO(json.dumps(payload))),
            patch(
                "darrow_observability_langfuse.cli.load_config",
                return_value=config,
            ),
            patch(
                "darrow_observability_langfuse.cli.export_document",
                side_effect=record_export,
            ),
        ):
            self.assertEqual(run(), 0)


if __name__ == "__main__":
    unittest.main()
