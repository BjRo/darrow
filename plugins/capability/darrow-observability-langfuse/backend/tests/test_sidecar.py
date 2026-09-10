from __future__ import annotations

import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from darrow_observability_langfuse.sidecar import (
    discard_provisional_attribution_snapshots,
    load_attribution_snapshots,
    load_provisional_attribution_snapshots,
    mark_exported_turns,
    pending_document,
    record_attribution_snapshot,
    record_provisional_attribution_snapshot,
)


class SidecarTest(unittest.TestCase):
    def test_concurrent_provisional_snapshots_do_not_lose_updates(self):
        snapshot = {"work_item_id": None, "source": "none", "branch": None, "head": None}
        with tempfile.TemporaryDirectory() as directory:
            plugin_data = Path(directory)
            with ThreadPoolExecutor(max_workers=8) as executor:
                list(executor.map(lambda index: record_provisional_attribution_snapshot(
                    plugin_data, "session", str(index), snapshot), range(32)))
            self.assertEqual(set(load_provisional_attribution_snapshots(plugin_data, "session")),
                             {str(index) for index in range(32)})

    def test_provisional_snapshot_is_private_immutable_and_discardable(self):
        snapshot = {
            "work_item_id": "issue-45",
            "source": "git_branch",
            "branch": "feat/issue-45-first",
            "head": "a" * 40,
        }
        with tempfile.TemporaryDirectory() as directory:
            plugin_data = Path(directory) / "plugin-data"

            record_provisional_attribution_snapshot(
                plugin_data, "session-main", "turn-1", snapshot
            )
            record_provisional_attribution_snapshot(
                plugin_data, "session-main", "turn-1", snapshot
            )

            self.assertEqual(
                load_provisional_attribution_snapshots(plugin_data, "session-main"),
                {"turn-1": snapshot},
            )
            files = list((plugin_data / "attribution-snapshots").glob("*.json"))
            self.assertEqual(len(files), 1)
            self.assertEqual(os.stat(files[0]).st_mode & 0o777, 0o600)
            with self.assertRaisesRegex(ValueError, "immutable"):
                record_provisional_attribution_snapshot(
                    plugin_data,
                    "session-main",
                    "turn-1",
                    {**snapshot, "work_item_id": "issue-60"},
                )

            discard_provisional_attribution_snapshots(
                plugin_data, "session-main", {"turn-1"}
            )

            self.assertEqual(
                load_provisional_attribution_snapshots(plugin_data, "session-main"),
                {},
            )
            self.assertEqual(
                list((plugin_data / "attribution-snapshots").glob("*.json")), []
            )

    def test_semantically_invalid_attribution_snapshots_are_refused(self):
        valid = {
            "work_item_id": "issue-45",
            "source": "git_branch",
            "branch": "feat/issue-45-first",
            "head": "a" * 40,
        }
        invalid_states = (
            {
                "version": True,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {"turn-1": valid},
            },
            {
                "version": 2,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {"turn-1": valid},
            },
            {
                "uploaded_turn_ids": [],
                "attribution_snapshots": {"turn-1": valid},
            },
            {
                "version": 1,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {
                    "turn-1": {**valid, "work_item_id": "invalid work item"}
                },
            },
            {
                "version": 1,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {
                    "turn-1": {**valid, "branch": "feat/issue-45\nforged"}
                },
            },
            {
                "version": 1,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {"turn-1": {**valid, "head": "not-a-sha"}},
            },
            {
                "version": 1,
                "uploaded_turn_ids": [],
                "attribution_snapshots": {
                    "turn-1": {**valid, "branch": None}
                },
            },
        )
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text("{}\n", encoding="utf-8")
            sidecar = Path(f"{rollout}.darrow-langfuse")
            for state in invalid_states:
                with self.subTest(state=state):
                    sidecar.write_text(json.dumps(state), encoding="utf-8")
                    with self.assertRaisesRegex(ValueError, "sidecar"):
                        load_attribution_snapshots(rollout)

            sidecar.write_text(
                json.dumps({"uploaded_turn_ids": ["legacy-turn"]}),
                encoding="utf-8",
            )
            self.assertEqual(load_attribution_snapshots(rollout), {})

    def test_attribution_snapshot_survives_export_marking_and_is_immutable(self):
        snapshot = {
            "work_item_id": "issue-45",
            "source": "git_branch",
            "branch": "feat/issue-45-first",
            "head": "a" * 40,
        }
        document = {
            "status": "dry-run",
            "traces": [
                {
                    "name": "Codex Turn",
                    "metadata": {"codex.turn_id": "turn-1", "codex.completed": True},
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text("{}\n", encoding="utf-8")

            record_attribution_snapshot(rollout, "turn-1", snapshot)
            record_attribution_snapshot(rollout, "turn-1", snapshot)
            mark_exported_turns(rollout, document)

            self.assertEqual(
                load_attribution_snapshots(rollout),
                {"turn-1": snapshot},
            )
            with self.assertRaisesRegex(ValueError, "immutable"):
                record_attribution_snapshot(
                    rollout,
                    "turn-1",
                    {**snapshot, "work_item_id": "issue-60"},
                )
            self.assertEqual(
                os.stat(Path(f"{rollout}.darrow-langfuse")).st_mode & 0o777,
                0o600,
            )

    def test_completed_turn_is_not_exported_twice(self):
        document = {
            "status": "dry-run",
            "traces": [
                {
                    "name": "Codex Turn",
                    "metadata": {"codex.turn_id": "turn-1", "codex.completed": True},
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            rollout = Path(directory) / "rollout.jsonl"
            rollout.write_text("{}\n", encoding="utf-8")

            self.assertEqual(len(pending_document(document, rollout)["traces"]), 1)
            mark_exported_turns(rollout, pending_document(document, rollout))

            self.assertEqual(pending_document(document, rollout)["traces"], [])
            sidecar = Path(f"{rollout}.darrow-langfuse")
            self.assertEqual(json.loads(sidecar.read_text())["uploaded_turn_ids"], ["turn-1"])
            self.assertEqual(os.stat(sidecar).st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
