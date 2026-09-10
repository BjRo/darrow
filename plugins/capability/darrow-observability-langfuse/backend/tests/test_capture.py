from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.capture import capture, delivery_rows, database


class CaptureTest(unittest.TestCase):
    def test_symlink_capture_and_delivery_share_canonical_state(self):
        from test_delivery import rollout
        from darrow_observability_langfuse.delivery import drain
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            alias = Path(directory) / "alias.jsonl"
            rollout(path, 2)
            alias.symlink_to(path)
            Path(f"{alias}.darrow-langfuse").write_text(json.dumps({"uploaded_turn_ids": ["0"]}))
            config = Config(enabled=True)
            capture(alias, config, directory, "session", "1", None)
            self.assertEqual(len(delivery_rows(path)), 1)
            self.assertEqual(drain(alias, config, exporter=lambda doc, cfg: len(doc["traces"])), 1)
            self.assertEqual(delivery_rows(path)[0]["state"], "acknowledged")

    def test_duplicate_turn_id_is_refused_without_delivery(self):
        from test_delivery import rollout
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            rollout(path, 2)
            path.write_text(path.read_text().replace('"turn_id": "1"', '"turn_id": "0"'))
            with self.assertRaisesRegex(ValueError, "exactly one"):
                capture(path, Config(enabled=True), directory, "session", "0", None)
            self.assertEqual(delivery_rows(path), [])

    def test_active_parser_credentials_are_not_persisted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            records = [{"type": "session_meta", "payload": {"id": "session"}},
                       {"type": "event_msg", "payload": {"type": "task_started", "turn_id": "0"}},
                       {"type": "event_msg", "payload": {"type": "user_message", "message": "private sk-super-secret content"}}]
            path.write_text("".join(json.dumps(row) + "\n" for row in records))
            config = Config(enabled=True, secret_key="sk-super-secret")
            capture(path, config, directory, "session", "0", None)
            with database(path) as connection:
                stored = json.dumps([tuple(row) for row in connection.execute("SELECT * FROM state")])
            self.assertNotIn("sk-super-secret", stored)
            self.assertNotIn("private", delivery_rows(path)[0]["document"])

    def test_append_partial_line_version_rebuild_replacement_and_legacy_migration(self):
        from test_delivery import rollout
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            config = Config(enabled=True)
            rollout(path)
            Path(f"{path}.darrow-langfuse").write_text(json.dumps({"uploaded_turn_ids": ["0"]}))
            capture(path, config, directory, "session", "0", None)
            self.assertEqual(delivery_rows(path), [])
            start = json.dumps({"type": "event_msg", "payload": {"type": "task_started", "turn_id": "1"}}).encode()
            with path.open("ab") as handle:
                handle.write(start[:20])
            self.assertEqual(capture(path, config, directory, "session", "0", None)["bytes_read"], 20)
            with path.open("ab") as handle:
                handle.write(start[20:] + b"\n")
            self.assertEqual(capture(path, config, directory, "session", "1", None)["bytes_read"], len(start) - 19)
            original = delivery_rows(path)[0]["document"]
            with database(path) as connection:
                row = json.loads(connection.execute("SELECT value FROM state WHERE key='rollout'").fetchone()[0])
                row["version"] = -1
                connection.execute("UPDATE state SET value=? WHERE key='rollout'", (json.dumps(row),))
            self.assertEqual(capture(path, config, directory, "session", "1", None)["rebuilt"], 1)
            self.assertEqual(delivery_rows(path)[0]["document"], original)
            replacement = path.with_suffix(".replacement")
            rollout(replacement, 2)
            replacement.replace(path)
            self.assertEqual(capture(path, config, directory, "session", "1", None)["rebuilt"], 1)
            rollout(path)
            with self.assertRaisesRegex(ValueError, "turn_id"):
                capture(path, config, directory, "session", "1", None)
            self.assertEqual(capture(path, config, directory, "session", "0", None)["rebuilt"], 1)
            self.assertEqual(delivery_rows(path)[0]["document"], original)

    def test_invalid_capture_rolls_back_envelopes_and_cursor(self):
        from test_delivery import rollout
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            rollout(path, 3)
            config = Config(enabled=True)
            with patch("darrow_observability_langfuse.capture._put", side_effect=KeyboardInterrupt):
                with self.assertRaises(KeyboardInterrupt):
                    capture(path, config, directory, "session", "2", None)
            self.assertEqual(delivery_rows(path), [])
            self.assertEqual(capture(path, config, directory, "session", "2", None)["bytes_read"], path.stat().st_size)
            self.assertEqual(delivery_rows(path), [])
            capture(path, config, directory, "session", "0", None)
            capture(path, config, directory, "session", "1", None)
            self.assertEqual(len(delivery_rows(path)), 3)

    def test_incremental_reconstruction_preserves_nested_observations(self):
        import shutil
        from darrow_observability_langfuse.rollout import trace_document, attribution_snapshot
        fixture = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "main-rollout.jsonl"
            for source in fixture.glob("*.jsonl"):
                shutil.copyfile(source, Path(directory) / source.name)
            config = Config(enabled=True, capture_content=True, work_item_id="TASK-77")
            snapshots = {"turn-1": attribution_snapshot(config, directory)}
            expected = trace_document(path, config, directory, attribution_snapshots=snapshots)["traces"][0]
            initial = capture(path, config, directory, "session-main", "turn-1", None)
            self.assertGreater(initial["bytes_read"], path.stat().st_size)
            actual = json.loads(delivery_rows(path)[0]["document"])["traces"][0]
            for key in ("darrow.delivery_id", "darrow.expected_observation_count"):
                actual["metadata"].pop(key)
            self.assertEqual(actual, expected)
            self.assertEqual(capture(path, config, directory, "session-main", "turn-1", None)["bytes_read"], 0)

    def test_capture_is_local_incremental_and_immutable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            records = [
                {"type": "session_meta", "payload": {"id": "session"}},
                {"type": "event_msg", "payload": {"type": "task_started", "turn_id": "one"}},
                {"type": "event_msg", "payload": {"type": "task_complete"}},
            ]
            path.write_text("".join(json.dumps(row) + "\n" for row in records))
            config = Config(enabled=True, public_key="pk", secret_key="sk")
            first = capture(path, config, directory, "session", "one", None)
            second = capture(path, config, directory, "session", "one", None)
            self.assertEqual(first["bytes_read"], path.stat().st_size)
            self.assertEqual(second["bytes_read"], 0)
            rows = delivery_rows(path)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["state"], "pending")
            self.assertEqual(rows[0]["expected_count"], 1)


if __name__ == "__main__":
    unittest.main()
