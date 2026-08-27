from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.rollout import trace_document


class PrivacyTest(unittest.TestCase):
    def test_content_capture_redacts_credentials_and_sensitive_fields(self):
        records = [
            {"timestamp": "2026-08-24T10:00:00Z", "type": "session_meta", "payload": {"id": "privacy-session"}},
            {"timestamp": "2026-08-24T10:00:01Z", "type": "event_msg", "payload": {"type": "task_started", "turn_id": "privacy-turn"}},
            {"timestamp": "2026-08-24T10:00:02Z", "type": "event_msg", "payload": {"type": "user_message", "message": "use sk-super-secret for the safe query"}},
            {"timestamp": "2026-08-24T10:00:03Z", "type": "response_item", "payload": {"type": "function_call", "name": "web", "call_id": "privacy-call", "arguments": "{\"authorization\":\"Bearer hidden\",\"query\":\"safe query\"}"}},
            {"timestamp": "2026-08-24T10:00:04Z", "type": "response_item", "payload": {"type": "function_call_output", "call_id": "privacy-call", "output": "pk-super-public accepted"}},
            {"timestamp": "2026-08-24T10:00:05Z", "type": "event_msg", "payload": {"type": "token_count", "info": {"last_token_usage": {"input_tokens": 8, "output_tokens": 2, "total_tokens": 10}}}},
            {"timestamp": "2026-08-24T10:00:06Z", "type": "event_msg", "payload": {"type": "task_complete", "turn_id": "privacy-turn"}},
        ]
        config = Config(
            enabled=True,
            capture_content=True,
            public_key="pk-super-public",
            secret_key="sk-super-secret",
        )
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text("\n".join(json.dumps(record) for record in records), encoding="utf-8")
            serialized = json.dumps(trace_document(rollout, config, directory))

        self.assertNotIn("sk-super-secret", serialized)
        self.assertNotIn("pk-super-public", serialized)
        self.assertNotIn("Bearer hidden", serialized)
        self.assertIn("safe query", serialized)
        self.assertIn("[REDACTED]", serialized)

    def test_capture_off_does_not_export_failed_tool_output(self):
        records = [
            {"timestamp": "2026-08-24T10:00:00Z", "type": "session_meta", "payload": {"id": "privacy-session"}},
            {"timestamp": "2026-08-24T10:00:01Z", "type": "event_msg", "payload": {"type": "task_started", "turn_id": "privacy-turn"}},
            {"timestamp": "2026-08-24T10:00:02Z", "type": "response_item", "payload": {"type": "function_call", "name": "exec_command", "call_id": "privacy-call", "arguments": "{}"}},
            {"timestamp": "2026-08-24T10:00:03Z", "type": "event_msg", "payload": {"type": "exec_command_end", "call_id": "privacy-call", "status": "failed", "aggregated_output": "raw tool output SECRET"}},
            {"timestamp": "2026-08-24T10:00:04Z", "type": "event_msg", "payload": {"type": "task_complete", "turn_id": "privacy-turn"}},
        ]
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text("\n".join(json.dumps(record) for record in records), encoding="utf-8")
            document = trace_document(
                rollout,
                Config(enabled=True, capture_content=False),
                directory,
            )

        serialized = json.dumps(document)
        self.assertNotIn("raw tool output SECRET", serialized)
        tool = document["traces"][0]["observations"][0]["children"][0]
        self.assertEqual(tool["name"], "exec_command")
        self.assertNotIn("input", tool)
        self.assertEqual(tool["error"], "tool failed")

    def test_capture_on_labels_nested_tool_invocations_with_parameters(self):
        source = "\n".join(
            (
                "const values = await Promise.all([",
                '  tools.mcp__lean_ctx__ctx_shell({command:"git status"}),',
                '  tools.exec_command({cmd:"lean-ctx -c \'jq --help\'"}),',
                '  tools.mcp__lean_ctx__ctx_read({path:"/repo/README.md",mode:"full"}),',
                "]);",
            )
        )
        records = [
            {
                "timestamp": "2026-08-24T10:00:00Z",
                "type": "session_meta",
                "payload": {"id": "privacy-session"},
            },
            {
                "timestamp": "2026-08-24T10:00:01Z",
                "type": "event_msg",
                "payload": {"type": "task_started", "turn_id": "privacy-turn"},
            },
            {
                "timestamp": "2026-08-24T10:00:02Z",
                "type": "response_item",
                "payload": {
                    "type": "custom_tool_call",
                    "name": "exec",
                    "call_id": "privacy-call",
                    "input": source,
                },
            },
            {
                "timestamp": "2026-08-24T10:00:03Z",
                "type": "response_item",
                "payload": {
                    "type": "custom_tool_call_output",
                    "call_id": "privacy-call",
                    "output": "completed",
                },
            },
            {
                "timestamp": "2026-08-24T10:00:04Z",
                "type": "event_msg",
                "payload": {"type": "task_complete", "turn_id": "privacy-turn"},
            },
        ]
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text(
                "\n".join(json.dumps(record) for record in records),
                encoding="utf-8",
            )
            document = trace_document(
                rollout,
                Config(enabled=True, capture_content=True),
                directory,
            )

        tool = document["traces"][0]["observations"][0]["children"][0]
        self.assertEqual(
            tool["name"],
            "git status; lean-ctx -c 'jq --help'; "
            'ctx_read {path:"/repo/README.md",mode:"full"}',
        )
        self.assertEqual(tool["input"], source)

    def test_relative_transcript_path_is_rejected_before_resolution(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                Path("rollout.jsonl").write_text("{}\n", encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "absolute"):
                    trace_document(
                        Path("rollout.jsonl"),
                        Config(enabled=True),
                        directory,
                    )
            finally:
                os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
