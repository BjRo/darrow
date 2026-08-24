from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from darrow_observability_langfuse.sidecar import mark_exported_turns, pending_document


class SidecarTest(unittest.TestCase):
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
