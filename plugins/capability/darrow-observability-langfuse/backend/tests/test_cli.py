from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from darrow_observability_langfuse.cli import run
from darrow_observability_langfuse.config import Config


class CliTest(unittest.TestCase):
    def test_exported_interrupted_snapshot_preserves_future_epoch_numbers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rollout = root / "rollout.jsonl"
            plugin_data = root / "plugin-data"
            records = [
                {
                    "timestamp": "2026-08-26T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                }
            ]
            self._write_rollout(rollout, records)
            exported: list[dict] = []

            def invoke(event: str, turn_id: str, work_item_id: str) -> int:
                payload = {
                    "session_id": "session-main",
                    "turn_id": turn_id,
                    "cwd": str(root),
                    "transcript_path": str(rollout),
                    "hook_event_name": event,
                }
                config = Config(
                    enabled=True,
                    public_key="pk-test",
                    secret_key="sk-test",
                    work_item_id=work_item_id,
                )

                def record_export(document: dict, _config: Config) -> int:
                    exported.append(document)
                    return len(document["traces"])

                with (
                    patch("sys.stdin", StringIO(json.dumps(payload))),
                    patch.dict(os.environ, {"PLUGIN_DATA": str(plugin_data)}),
                    patch(
                        "darrow_observability_langfuse.cli.load_config",
                        return_value=config,
                    ),
                    patch(
                        "darrow_observability_langfuse.cli.export_document",
                        side_effect=record_export,
                    ),
                ):
                    return run()

            self.assertEqual(invoke("UserPromptSubmit", "turn-1", "ITEM-1"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:01.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-1"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:01.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "First"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:01.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "Done"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(invoke("Stop", "turn-1", "ITEM-1"), 0)
            records.append(
                {
                    "timestamp": "2026-08-26T10:00:01.300Z",
                    "type": "event_msg",
                    "payload": {"type": "task_complete", "turn_id": "turn-1"},
                }
            )

            self.assertEqual(invoke("UserPromptSubmit", "turn-2", "ITEM-2"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:02.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Interrupted"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.200Z",
                        "type": "event_msg",
                        "payload": {"type": "turn_aborted", "turn_id": "turn-2"},
                    },
                ]
            )
            self._write_rollout(rollout, records)

            self.assertEqual(invoke("UserPromptSubmit", "turn-3", "ITEM-3"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:03.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-3"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Third"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "Done"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(invoke("Stop", "turn-3", "ITEM-3"), 0)
            records.append(
                {
                    "timestamp": "2026-08-26T10:00:03.300Z",
                    "type": "event_msg",
                    "payload": {"type": "task_complete", "turn_id": "turn-3"},
                }
            )

            self.assertEqual(invoke("UserPromptSubmit", "turn-4", "ITEM-3"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:04.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-4"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:04.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Fourth"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:04.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "Done"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(invoke("Stop", "turn-4", "ITEM-3"), 0)

        self.assertEqual(
            [
                [
                    (trace["metadata"]["codex.turn_id"], trace["session_id"])
                    for trace in document["traces"]
                ]
                for document in exported
            ],
            [
                [("turn-1", "session-main:attribution:0")],
                [
                    ("turn-2", "session-main:attribution:1"),
                    ("turn-3", "session-main:attribution:2"),
                ],
                [("turn-4", "session-main:attribution:2")],
            ],
        )

    def test_missing_interrupted_snapshot_is_exported_without_a_session(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            records = [
                {
                    "timestamp": "2026-08-26T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                },
                {
                    "timestamp": "2026-08-26T10:00:01.000Z",
                    "type": "event_msg",
                    "payload": {"type": "task_started", "turn_id": "turn-1"},
                },
                {
                    "timestamp": "2026-08-26T10:00:01.100Z",
                    "type": "event_msg",
                    "payload": {"type": "user_message", "message": "First turn"},
                },
                {
                    "timestamp": "2026-08-26T10:00:01.200Z",
                    "type": "event_msg",
                    "payload": {"type": "agent_message", "message": "First response"},
                },
            ]
            self._write_rollout(rollout, records)
            exported: list[dict] = []
            config = Config(
                enabled=True,
                public_key="pk-test",
                secret_key="sk-test",
                work_item_id="TEST-1",
            )
            with patch.dict(os.environ, {"PLUGIN_DATA": ""}):
                self._run_stop(rollout, "turn-1", exported, config=config)

            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:01.300Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Interrupted turn"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.200Z",
                        "type": "event_msg",
                        "payload": {"type": "turn_aborted", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-3"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Current turn"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "Current response"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            with patch.dict(os.environ, {"PLUGIN_DATA": ""}):
                self._run_stop(rollout, "turn-3", exported, config=config)

        interrupted, current = exported[1]["traces"]
        self.assertEqual(interrupted["metadata"]["codex.turn_id"], "turn-2")
        self.assertIsNone(interrupted["session_id"])
        self.assertNotIn("darrow.attribution_epoch", interrupted["metadata"])
        self.assertEqual(
            interrupted["metadata"]["darrow.attribution_source"], "none"
        )
        self.assertEqual(current["metadata"]["codex.turn_id"], "turn-3")
        self.assertEqual(current["session_id"], "session-main:attribution:0")
        self.assertEqual(current["metadata"]["darrow.work_item_id"], "TEST-1")

    def test_interrupted_turn_uses_prompt_snapshot_without_splitting_epoch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repo = root / "repo"
            repo.mkdir()
            self._git(repo, "init", "-q")
            self._git(repo, "config", "user.email", "test@example.com")
            self._git(repo, "config", "user.name", "Test User")
            (repo / "README.md").write_text("fixture\n", encoding="utf-8")
            self._git(repo, "add", "README.md")
            self._git(repo, "commit", "-qm", "initial")
            self._git(repo, "checkout", "-qb", "feat/issue-45-observability")

            rollout = repo / "rollout.jsonl"
            plugin_data = root / "plugin-data"
            records = [
                {
                    "timestamp": "2026-08-26T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                }
            ]
            self._write_rollout(rollout, records)
            exported: list[dict] = []
            config = Config(
                enabled=True,
                public_key="pk-test",
                secret_key="sk-test",
            )

            def invoke(event: str, turn_id: str) -> int:
                payload = {
                    "session_id": "session-main",
                    "turn_id": turn_id,
                    "cwd": str(repo),
                    "transcript_path": str(rollout),
                    "hook_event_name": event,
                    "prompt": "private prompt content",
                }

                def record_export(document: dict, _config: Config) -> int:
                    exported.append(document)
                    return len(document["traces"])

                with (
                    patch("sys.stdin", StringIO(json.dumps(payload))),
                    patch.dict(os.environ, {"PLUGIN_DATA": str(plugin_data)}),
                    patch(
                        "darrow_observability_langfuse.cli.load_config",
                        return_value=config,
                    ),
                    patch(
                        "darrow_observability_langfuse.cli.export_document",
                        side_effect=record_export,
                    ),
                ):
                    return run()

            self.assertEqual(invoke("UserPromptSubmit", "turn-1"), 0)
            provisional_files = list(
                (plugin_data / "attribution-snapshots").glob("*.json")
            )
            self.assertEqual(len(provisional_files), 1)
            self.assertNotIn(
                "private prompt content",
                provisional_files[0].read_text(encoding="utf-8"),
            )
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:01.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-1"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:01.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "First turn"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:01.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "First response"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(invoke("Stop", "turn-1"), 0)
            records.append(
                {
                    "timestamp": "2026-08-26T10:00:01.300Z",
                    "type": "event_msg",
                    "payload": {"type": "task_complete", "turn_id": "turn-1"},
                }
            )

            self.assertEqual(invoke("UserPromptSubmit", "turn-2"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:02.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Interrupted turn"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:02.200Z",
                        "type": "event_msg",
                        "payload": {"type": "turn_aborted", "turn_id": "turn-2"},
                    },
                ]
            )
            self._write_rollout(rollout, records)

            self.assertEqual(invoke("UserPromptSubmit", "turn-3"), 0)
            records.extend(
                [
                    {
                        "timestamp": "2026-08-26T10:00:03.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-3"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Current turn"},
                    },
                    {
                        "timestamp": "2026-08-26T10:00:03.200Z",
                        "type": "event_msg",
                        "payload": {"type": "agent_message", "message": "Current response"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(invoke("Stop", "turn-3"), 0)

        self.assertEqual(
            [
                [trace["metadata"]["codex.turn_id"] for trace in document["traces"]]
                for document in exported
            ],
            [["turn-1"], ["turn-2", "turn-3"]],
        )
        traces = [trace for document in exported for trace in document["traces"]]
        self.assertEqual(
            {trace["metadata"].get("darrow.work_item_id") for trace in traces},
            {"issue-45"},
        )
        self.assertEqual(
            {trace["metadata"]["darrow.attribution_source"] for trace in traces},
            {"git_branch"},
        )
        self.assertEqual(
            {trace["session_id"] for trace in traces},
            {"session-main:attribution:0"},
        )

    def test_same_session_directives_create_ordered_attribution_epochs(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            records = [
                {
                    "timestamp": "2026-08-24T10:00:00.000Z",
                    "type": "session_meta",
                    "payload": {"id": "session-main"},
                }
            ]
            messages = [
                "@darrow.attribution set ISSUE-60\nStart issue 60",
                "Continue issue 60",
                "@darrow.attribution set ISSUE-61\nSwitch topics",
                "@darrow.attribution clear\nStart an unattributed gap",
                "Continue the unattributed gap",
                "@darrow.attribution auto\nReturn to the configured default",
            ]
            for index, message in enumerate(messages, start=1):
                records.extend(
                    [
                        {
                            "timestamp": f"2026-08-24T10:00:{index:02d}.000Z",
                            "type": "event_msg",
                            "payload": {
                                "type": "task_started",
                                "turn_id": f"turn-{index}",
                            },
                        },
                        {
                            "timestamp": f"2026-08-24T10:00:{index:02d}.100Z",
                            "type": "event_msg",
                            "payload": {"type": "user_message", "message": message},
                        },
                        {
                            "timestamp": f"2026-08-24T10:00:{index:02d}.200Z",
                            "type": "event_msg",
                            "payload": {
                                "type": "agent_message",
                                "message": f"Response {index}",
                            },
                        },
                        {
                            "timestamp": f"2026-08-24T10:00:{index:02d}.300Z",
                            "type": "event_msg",
                            "payload": {
                                "type": "task_complete",
                                "turn_id": f"turn-{index}",
                            },
                        },
                    ]
                )
            rollout.write_text(
                "".join(f"{json.dumps(record)}\n" for record in records),
                encoding="utf-8",
            )
            exported: list[dict] = []

            self._run_stop(
                rollout,
                "turn-6",
                exported,
                config=Config(
                    enabled=True,
                    public_key="pk-test",
                    secret_key="sk-test",
                    work_item_id="DEFAULT-1",
                ),
            )

        traces = exported[0]["traces"]
        self.assertEqual(
            [trace["metadata"].get("darrow.work_item_id") for trace in traces],
            ["ISSUE-60", "ISSUE-60", "ISSUE-61", None, None, "DEFAULT-1"],
        )
        self.assertEqual(
            [trace["metadata"]["darrow.attribution_source"] for trace in traces],
            [
                "explicit",
                "explicit",
                "explicit",
                "explicit",
                "explicit",
                "configuration",
            ],
        )
        self.assertEqual(
            [trace["metadata"]["darrow.attribution_epoch"] for trace in traces],
            [
                "session-main:attribution:1",
                "session-main:attribution:1",
                "session-main:attribution:2",
                "session-main:attribution:3",
                "session-main:attribution:3",
                "session-main:attribution:4",
            ],
        )
        self.assertEqual(
            [trace["session_id"] for trace in traces],
            [trace["metadata"]["darrow.attribution_epoch"] for trace in traces],
        )
        self.assertEqual(
            {trace["metadata"]["codex.thread_id"] for trace in traces},
            {"session-main"},
        )

    def test_export_retry_preserves_branch_fallback_and_git_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / "repo"
            repo.mkdir()
            self._git(repo, "init", "-q")
            self._git(repo, "config", "user.email", "test@example.com")
            self._git(repo, "config", "user.name", "Test User")
            (repo / "README.md").write_text("fixture\n", encoding="utf-8")
            self._git(repo, "add", "README.md")
            self._git(repo, "commit", "-qm", "initial")
            self._git(repo, "checkout", "-qb", "feat/issue-45-first")
            (repo / "issue-45.txt").write_text("first\n", encoding="utf-8")
            self._git(repo, "add", "issue-45.txt")
            self._git(repo, "commit", "-qm", "issue 45")
            first_head = self._git(repo, "rev-parse", "HEAD")

            rollout = repo / "rollout.jsonl"
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
                    "type": "event_msg",
                    "payload": {"type": "user_message", "message": "First topic"},
                },
                {
                    "timestamp": "2026-08-24T10:00:01.200Z",
                    "type": "event_msg",
                    "payload": {"type": "task_complete", "turn_id": "turn-1"},
                },
            ]
            self._write_rollout(rollout, records)
            config = Config(
                enabled=True,
                public_key="pk-test",
                secret_key="sk-test",
            )

            def reject_export(_document: dict, _config: Config) -> int:
                raise RuntimeError("temporary export failure")

            self.assertEqual(
                self._invoke_stop(rollout, repo, "turn-1", config, reject_export),
                0,
            )

            self._git(repo, "checkout", "-qb", "feat/issue-60-next")
            (repo / "issue-60.txt").write_text("second\n", encoding="utf-8")
            self._git(repo, "add", "issue-60.txt")
            self._git(repo, "commit", "-qm", "issue 60")
            second_head = self._git(repo, "rev-parse", "HEAD")
            exported: list[dict] = []

            def record_export(document: dict, _config: Config) -> int:
                exported.append(document)
                return len(document["traces"])

            self.assertEqual(
                self._invoke_stop(rollout, repo, "turn-1", config, record_export),
                0,
            )
            first = exported.pop()["traces"][0]
            self.assertEqual(first["metadata"]["darrow.work_item_id"], "issue-45")
            self.assertEqual(first["metadata"]["darrow.attribution_source"], "git_branch")
            self.assertEqual(first["metadata"]["git.branch"], "feat/issue-45-first")
            self.assertEqual(first["metadata"]["git.head"], first_head)
            self.assertEqual(first["session_id"], "session-main:attribution:0")

            records.extend(
                [
                    {
                        "timestamp": "2026-08-24T10:00:02.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-2"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:02.100Z",
                        "type": "event_msg",
                        "payload": {"type": "user_message", "message": "Second topic"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:02.200Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-2"},
                    },
                ]
            )
            self._write_rollout(rollout, records)
            self.assertEqual(
                self._invoke_stop(rollout, repo, "turn-2", config, record_export),
                0,
            )

        second = exported[0]["traces"][0]
        self.assertEqual(second["metadata"]["darrow.work_item_id"], "issue-60")
        self.assertEqual(second["metadata"]["darrow.attribution_source"], "git_branch")
        self.assertEqual(second["metadata"]["git.branch"], "feat/issue-60-next")
        self.assertEqual(second["metadata"]["git.head"], second_head)
        self.assertEqual(second["session_id"], "session-main:attribution:1")

    def test_explicit_directive_attributes_a_turn_on_main_before_a_ticket_branch(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self._git(repo, "init", "-q")
            self._git(repo, "config", "user.email", "test@example.com")
            self._git(repo, "config", "user.name", "Test User")
            self._git(repo, "symbolic-ref", "HEAD", "refs/heads/main")
            (repo / "README.md").write_text("fixture\n", encoding="utf-8")
            self._git(repo, "add", "README.md")
            self._git(repo, "commit", "-qm", "initial")
            head = self._git(repo, "rev-parse", "HEAD")
            rollout = repo / "rollout.jsonl"
            self._write_rollout(
                rollout,
                [
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
                        "type": "event_msg",
                        "payload": {
                            "type": "user_message",
                            "message": (
                                "@darrow.attribution set ISSUE-60\n"
                                "Begin before the ticket branch exists"
                            ),
                        },
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.200Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                ],
            )
            exported: list[dict] = []

            self._run_stop(
                rollout,
                "turn-1",
                exported,
                config=Config(
                    enabled=True,
                    public_key="pk-test",
                    secret_key="sk-test",
                ),
            )

        trace = exported[0]["traces"][0]
        self.assertEqual(trace["metadata"]["darrow.work_item_id"], "ISSUE-60")
        self.assertEqual(trace["metadata"]["darrow.attribution_source"], "explicit")
        self.assertEqual(trace["metadata"]["git.branch"], "main")
        self.assertEqual(trace["metadata"]["git.head"], head)

    def test_missing_codex_thread_id_refuses_before_export_or_sidecar_write(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            self._write_rollout(
                rollout,
                [
                    {
                        "timestamp": "2026-08-24T10:00:00.000Z",
                        "type": "session_meta",
                        "payload": {},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.000Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "turn-1"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.100Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                ],
            )
            exported: list[dict] = []

            def record_export(document: dict, _config: Config) -> int:
                exported.append(document)
                return len(document["traces"])

            status = self._invoke_stop(
                rollout,
                Path(directory),
                "turn-1",
                Config(
                    enabled=True,
                    strict=True,
                    public_key="pk-test",
                    secret_key="sk-test",
                ),
                record_export,
            )

            self.assertEqual(status, 1)
            self.assertEqual(exported, [])
            self.assertFalse(Path(f"{rollout}.darrow-langfuse").exists())

    def test_missing_subagent_thread_id_refuses_before_export_or_sidecar_write(self):
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            self._write_rollout(
                rollout,
                [
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
                        "type": "event_msg",
                        "payload": {
                            "type": "collab_agent_spawn_end",
                            "new_thread_id": "child-1",
                        },
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.200Z",
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                ],
            )
            self._write_rollout(
                Path(directory) / "rollout-child-1.jsonl",
                [
                    {
                        "timestamp": "2026-08-24T10:00:01.100Z",
                        "type": "session_meta",
                        "payload": {"parent_thread_id": "session-main"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.110Z",
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": "child-turn"},
                    },
                    {
                        "timestamp": "2026-08-24T10:00:01.120Z",
                        "type": "event_msg",
                        "payload": {
                            "type": "task_complete",
                            "turn_id": "child-turn",
                        },
                    },
                ],
            )
            exported: list[dict] = []

            def record_export(document: dict, _config: Config) -> int:
                exported.append(document)
                return len(document["traces"])

            status = self._invoke_stop(
                rollout,
                Path(directory),
                "turn-1",
                Config(
                    enabled=True,
                    strict=True,
                    public_key="pk-test",
                    secret_key="sk-test",
                ),
                record_export,
            )

            self.assertEqual(status, 1)
            self.assertEqual(exported, [])
            self.assertFalse(Path(f"{rollout}.darrow-langfuse").exists())

    def test_credentials_are_redacted_from_attribution_metadata_and_sidecar(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self._git(repo, "init", "-q")
            self._git(repo, "config", "user.email", "test@example.com")
            self._git(repo, "config", "user.name", "Test User")
            self._git(repo, "checkout", "-qb", "feat/issue-60-secret")
            (repo / "README.md").write_text("fixture\n", encoding="utf-8")
            self._git(repo, "add", "README.md")
            self._git(repo, "commit", "-qm", "initial")
            rollout = repo / "rollout.jsonl"
            self._write_rollout(
                rollout,
                [
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
                        "type": "event_msg",
                        "payload": {"type": "task_complete", "turn_id": "turn-1"},
                    },
                ],
            )
            exported: list[dict] = []

            def record_export(document: dict, _config: Config) -> int:
                exported.append(document)
                return len(document["traces"])

            self.assertEqual(
                self._invoke_stop(
                    rollout,
                    repo,
                    "turn-1",
                    Config(
                        enabled=True,
                        public_key="pk-test",
                        secret_key="issue-60",
                    ),
                    record_export,
                ),
                0,
            )

            self.assertNotIn("issue-60", json.dumps(exported))
            self.assertNotIn(
                "issue-60",
                Path(f"{rollout}.darrow-langfuse").read_text(encoding="utf-8"),
            )
            trace = exported[0]["traces"][0]
            self.assertNotIn("darrow.work_item_id", trace["metadata"])
            self.assertEqual(trace["metadata"]["darrow.attribution_source"], "none")
            self.assertEqual(trace["metadata"]["git.branch"], "feat/[REDACTED]-secret")

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
        self,
        rollout: Path,
        turn_id: str,
        exported: list[dict],
        *,
        config: Config | None = None,
    ) -> None:
        payload = {
            "session_id": "session-main",
            "turn_id": turn_id,
            "cwd": str(rollout.parent),
            "transcript_path": str(rollout),
            "hook_event_name": "Stop",
        }
        config = config or Config(
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

    def _invoke_stop(
        self,
        rollout: Path,
        cwd: Path,
        turn_id: str,
        config: Config,
        exporter,
    ) -> int:
        payload = {
            "session_id": "session-main",
            "turn_id": turn_id,
            "cwd": str(cwd),
            "transcript_path": str(rollout),
            "hook_event_name": "Stop",
        }
        with (
            patch("sys.stdin", StringIO(json.dumps(payload))),
            patch(
                "darrow_observability_langfuse.cli.load_config",
                return_value=config,
            ),
            patch(
                "darrow_observability_langfuse.cli.export_document",
                side_effect=exporter,
            ),
        ):
            return run()

    @staticmethod
    def _git(repo: Path, *arguments: str) -> str:
        return subprocess.run(
            ["git", "-C", str(repo), *arguments],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    @staticmethod
    def _write_rollout(rollout: Path, records: list[dict]) -> None:
        rollout.write_text(
            "".join(f"{json.dumps(record)}\n" for record in records),
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
