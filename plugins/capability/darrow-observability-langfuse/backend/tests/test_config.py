from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from darrow_observability_langfuse.config import (
    infer_work_item_id,
    infer_work_item_id_from_branch,
    load_config,
)


class ConfigTest(unittest.TestCase):
    def test_environment_overrides_repository_and_user_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            home = root / "home"
            repo = root / "repo"
            (home / ".codex").mkdir(parents=True)
            (repo / ".codex").mkdir(parents=True)
            (home / ".codex" / "darrow-langfuse.json").write_text(
                json.dumps({"enabled": False, "work_item_id": "GLOBAL-1"}),
                encoding="utf-8",
            )
            (repo / ".codex" / "darrow-langfuse.json").write_text(
                json.dumps({"enabled": True, "work_item_id": "LOCAL-2"}),
                encoding="utf-8",
            )

            config = load_config(
                str(repo),
                home=str(home),
                env={
                    "DARROW_LANGFUSE_ENABLED": "true",
                    "DARROW_LANGFUSE_CAPTURE_CONTENT": "false",
                    "DARROW_LANGFUSE_WORK_ITEM_ID": "ENV-3",
                    "LANGFUSE_PUBLIC_KEY": "pk-test",
                    "LANGFUSE_SECRET_KEY": "sk-test",
                },
            )

        self.assertTrue(config.enabled)
        self.assertFalse(config.capture_content)
        self.assertEqual(config.work_item_id, "ENV-3")
        self.assertEqual(config.public_key, "pk-test")
        self.assertEqual(config.secret_key, "sk-test")

    def test_branch_inference_handles_ticket_and_absent_states(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            subprocess.run(
                ["git", "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "--allow-empty", "-m", "init"],
                check=True,
            )

            subprocess.run(["git", "-C", str(repo), "checkout", "-q", "-b", "feat/DAR-123-export"], check=True)
            self.assertEqual(infer_work_item_id(str(repo)), "DAR-123")

            subprocess.run(["git", "-C", str(repo), "checkout", "-q", "-B", "feat/45-export"], check=True)
            self.assertEqual(infer_work_item_id(str(repo)), "45")

            subprocess.run(["git", "-C", str(repo), "checkout", "-q", "-B", "feat/langfuse-export"], check=True)
            self.assertIsNone(infer_work_item_id(str(repo)))

            subprocess.run(["git", "-C", str(repo), "checkout", "-q", "--detach", "HEAD"], check=True)
            self.assertIsNone(infer_work_item_id(str(repo)))

    def test_branch_inference_uses_only_the_exact_leading_token(self):
        self.assertEqual(
            infer_work_item_id_from_branch("fix/issue-64-preserve-ticket-identifiers"),
            "issue-64",
        )
        self.assertEqual(
            infer_work_item_id_from_branch("feat/DAR-123-retry-logic"), "DAR-123"
        )
        self.assertIsNone(
            infer_work_item_id_from_branch("fix/preserve-ticket-identifiers-issue-64")
        )
        self.assertEqual(
            infer_work_item_id_from_branch("fix/issue-64-preserve-DAR-123"),
            "issue-64",
        )

if __name__ == "__main__":
    unittest.main()
