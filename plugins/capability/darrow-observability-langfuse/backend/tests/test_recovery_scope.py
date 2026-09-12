from __future__ import annotations

import json
import os
import tempfile
import unittest
from dataclasses import replace
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from darrow_observability_langfuse.capture import database, delivery_rows
from darrow_observability_langfuse.cli import run
from darrow_observability_langfuse.config import Config


class RecoveryScopeTest(unittest.TestCase):
    def setUp(self):
        self.reset_fixture()

    def reset_fixture(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.projects = [self.root / name for name in ("A", "B")]
        for project in self.projects:
            project.mkdir()
            records = [
                {"type": "session_meta", "payload": {"id": project.name}},
                {"type": "event_msg", "payload": {"type": "task_started", "turn_id": "0"}},
                {"type": "event_msg", "payload": {"type": "user_message", "message": "PRIVATE-" + project.name}},
                {"type": "event_msg", "payload": {"type": "task_complete"}},
            ]
            (project / "rollout.jsonl").write_text("".join(json.dumps(row) + "\n" for row in records))
        self.config = Config(enabled=True, strict=True, capture_content=True,
                             public_key="pk-A", secret_key="sk-A", base_url="https://A.example")
        self.exports = []

    def invoke(self, project, event, config=None, *, background=False, transcript=True, origin=None, home=None):
        payload = {"hook_event_name": event, "session_id": project.name,
                   "turn_id": "0", "cwd": str(origin or project)}
        if transcript:
            payload["transcript_path"] = str(project / "rollout.jsonl")
        def exporter(document, resolved):
            self.exports.append((document, resolved))
            return len(document["traces"])
        with (patch.dict(os.environ, {"PLUGIN_DATA": str(self.root / "data"), "HOME": str(home or self.root / "home")}, clear=True),
              patch("sys.stdin", StringIO(json.dumps(payload))),
              patch("darrow_observability_langfuse.cli.load_config", return_value=config or self.config),
              patch("darrow_observability_langfuse.cli.export_document", side_effect=exporter)):
            return run(background=background)

    def test_other_project_cannot_export_or_materialize_origin_backlog(self):
        a, b = self.projects
        for capture_event in ("Stop", "SessionEnd", "Interrupt"):
            with self.subTest(capture_event=capture_event):
                # A separate rollout per case avoids an acknowledged prior envelope.
                self.reset_fixture()
                a, b = self.projects
                self.assertEqual(self.invoke(a, capture_event), 0)
                before = delivery_rows(a / "rollout.jsonl")
                foreign = replace(self.config, capture_content=False, public_key="pk-B", secret_key="sk-B", base_url="https://B.example")
                self.assertEqual(self.invoke(b, "Stop", foreign), 0)
                self.assertEqual(self.invoke(b, "SessionStart", foreign, background=True), 0)
                self.assertEqual([doc["traces"][0]["metadata"]["codex.thread_id"] for doc, _ in self.exports], ["B"])
                self.assertEqual(delivery_rows(a / "rollout.jsonl"), before)
                self.assertEqual(self.invoke(a, "UserPromptSubmit", background=True, transcript=False), 0)
                self.assertEqual(self.exports[-1][0]["traces"][0]["input"], "PRIVATE-A")
                self.assertEqual(self.exports[-1][1].base_url, self.config.base_url)
                self.assertEqual(self.invoke(a, "SessionStart", background=True), 0)
                self.assertEqual(len(self.exports), 2)

    def test_direct_hooks_reject_changed_project_destination_or_config_home(self):
        a, b = self.projects
        self.assertEqual(self.invoke(a, "Stop"), 0)
        before = delivery_rows(a / "rollout.jsonl")
        variants = [
            {"origin": b},
            {"home": self.root / "other-home"},
            {"config": replace(self.config, public_key="pk-B")},
            {"config": replace(self.config, base_url="https://B.example")},
        ]
        for variant in variants:
            for event, background in (("Stop", False), ("Stop", True), ("SessionStart", True)):
                with self.subTest(variant=variant, event=event, background=background):
                    self.assertEqual(self.invoke(a, event, background=background, **variant), 1)
                    self.assertEqual(self.exports, [])
                    self.assertEqual(delivery_rows(a / "rollout.jsonl"), before)
        rotated = replace(self.config, secret_key="sk-rotated", base_url="https://A.example/")
        self.assertEqual(self.invoke(a, "Stop", rotated, background=True), 0)
        self.assertEqual(len(self.exports), 1)

    def test_same_destination_does_not_authorize_another_project_registry(self):
        a, b = self.projects
        self.assertEqual(self.invoke(a, "Stop"), 0)
        self.assertEqual(self.invoke(b, "SessionStart", background=True, transcript=False), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(delivery_rows(a / "rollout.jsonl")[0]["state"], "pending")

    def test_changed_context_terminal_hook_cannot_poison_original_recovery(self):
        for first in ("Stop", "SessionEnd", "Interrupt"):
            for later in ("SessionEnd", "Interrupt"):
                with self.subTest(first=first, later=later):
                    self.reset_fixture()
                    a, b = self.projects
                    self.assertEqual(self.invoke(a, first), 0)
                    before = {path: path.read_bytes() for path in self.root.rglob("*.json")}
                    for variant in ({"origin": b}, {"home": self.root / "other-home"},
                                    {"config": replace(self.config, base_url="https://B.example")},
                                    {"config": replace(self.config, public_key="pk-B")}):
                        self.assertEqual(self.invoke(a, later, **variant), 1)
                        self.assertEqual({path: path.read_bytes() for path in self.root.rglob("*.json")}, before)
                    self.assertEqual(self.invoke(a, "SessionStart", background=True), 0)
                    self.assertEqual(len(self.exports), 1)
                    self.assertEqual(self.exports[0][0]["traces"][0]["input"], "PRIVATE-A")

    def test_unbound_legacy_database_is_not_adopted(self):
        a, _ = self.projects
        self.assertEqual(self.invoke(a, "Stop"), 0)
        with database(a / "rollout.jsonl") as connection:
            connection.execute("DELETE FROM state WHERE key='delivery_context'")
        self.assertEqual(self.invoke(a, "SessionStart", background=True), 1)
        self.assertEqual(self.invoke(a, "Stop", background=True), 1)
        self.assertEqual(self.exports, [])
        self.assertEqual(delivery_rows(a / "rollout.jsonl")[0]["state"], "pending")

    def test_unbound_legacy_terminal_receipt_is_not_adopted(self):
        a, _ = self.projects
        self.assertEqual(self.invoke(a, "SessionEnd"), 0)
        for path in self.root.rglob("*.json"):
            value = json.loads(path.read_text())
            value.pop("delivery_context", None)
            path.write_text(json.dumps(value))
        self.assertEqual(self.invoke(a, "SessionStart", background=True, transcript=False), 0)
        self.assertEqual(self.invoke(a, "SessionStart", background=True), 1)
        self.assertEqual(self.exports, [])

    def test_binding_persists_no_credentials_or_raw_endpoint(self):
        a, _ = self.projects
        self.assertEqual(self.invoke(a, "Stop"), 0)
        self.assertEqual(self.invoke(a, "SessionEnd"), 0)
        for path in self.root.rglob("*"):
            if path.is_file() and path.suffix != ".jsonl":
                data = path.read_bytes()
                for value in ("pk-A", "sk-A", "https://A.example"):
                    self.assertNotIn(value.encode(), data)
