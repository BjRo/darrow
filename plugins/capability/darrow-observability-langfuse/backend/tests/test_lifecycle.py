from __future__ import annotations

import json
import os
import sqlite3
import tempfile
import threading
import time
import unittest
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from io import StringIO
from pathlib import Path
from typing import Any
from unittest.mock import patch

from darrow_observability_langfuse.capture import capture, database, delivery_rows
from darrow_observability_langfuse.cli import run
from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.delivery import await_capture, drain
from test_delivery import rollout


def _paused_put(
    original: Callable[[sqlite3.Connection, str, Any], None],
    started: threading.Event,
    finish: threading.Event,
    connection: sqlite3.Connection,
    key: str,
    value: Any,
) -> None:
    if key == "delivery_context":
        started.set()
        if not finish.wait(5):
            raise TimeoutError("capture test was not released")
    original(connection, key, value)


def _foreground_capture(
    path: Path,
    config: Config,
    root: Path,
    plugin_data: Path,
    failures: list[BaseException],
) -> None:
    try:
        capture(path, config, str(root), "session", "0", plugin_data)
    except BaseException as error:
        failures.append(error)


class LifecycleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.path = self.root / "rollout.jsonl"
        self.plugin_data = self.root / "plugin-data"
        self.session = "session"
        self.exports: list[dict[str, Any]] = []

    def tearDown(self) -> None:
        self.directory.cleanup()

    def invoke(
        self,
        event: str,
        turn: str | None = None,
        item: str = "FINAL",
        background: bool = False,
    ) -> int:
        payload = {
            "hook_event_name": event,
            "session_id": self.session,
            "cwd": str(self.root),
            "transcript_path": str(self.path),
        }
        if turn is not None:
            payload["turn_id"] = turn
        config = Config(
            enabled=True,
            strict=True,
            public_key="pk-lifecycle",
            secret_key="sk-lifecycle",
            work_item_id=item,
        )

        def export(document: dict[str, Any], _config: Config) -> int:
            self.exports.extend(document["traces"])
            return len(document["traces"])

        with (
            patch("sys.stdin", StringIO(json.dumps(payload))),
            patch.dict(os.environ, {"PLUGIN_DATA": str(self.plugin_data)}),
            patch("darrow_observability_langfuse.cli.load_config", return_value=config),
            patch(
                "darrow_observability_langfuse.cli.export_document", side_effect=export
            ),
        ):
            return run(background=background)

    def test_out_of_order_stop_waits_for_final_attribution_and_ordered_epochs(
        self,
    ) -> None:
        rollout(self.path, 2)
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "PROVISIONAL"), 0)
        self.assertEqual(self.invoke("Stop", "1", "LATER"), 0)
        self.assertEqual(self.invoke("Stop", "1", "LATER", background=True), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(self.invoke("Stop", "0", "AUTHORITATIVE"), 0)
        self.assertEqual(self.invoke("Stop", "0", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["darrow.work_item_id"] for trace in self.exports],
            ["AUTHORITATIVE", "LATER"],
        )
        self.assertEqual(
            [trace["session_id"] for trace in self.exports],
            ["session:attribution:0", "session:attribution:1"],
        )
        self.assertEqual(self.invoke("Stop", "0", "CHANGED"), 0)
        self.assertEqual(self.invoke("Stop", "0", background=True), 0)
        self.assertEqual(len(self.exports), 2)

    def test_delayed_stop_completes_preindexed_turn_without_task_complete(self) -> None:
        rollout(self.path, 2)
        records = [json.loads(line) for line in self.path.read_text().splitlines()]
        self.path.write_text(
            "".join(
                json.dumps(record) + "\n"
                for record in records
                if record["payload"].get("type") != "task_complete"
            )
        )
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "PROVISIONAL"), 0)
        self.assertEqual(self.invoke("Stop", "1", "LATER"), 0)
        self.assertEqual(self.invoke("Stop", "1", background=True), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(self.invoke("Stop", "0", "AUTHORITATIVE"), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(self.invoke("Stop", "0", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["codex.turn_id"] for trace in self.exports], ["0", "1"]
        )
        self.assertEqual(
            [trace["metadata"]["darrow.work_item_id"] for trace in self.exports],
            ["AUTHORITATIVE", "LATER"],
        )
        self.assertEqual(
            [trace["session_id"] for trace in self.exports],
            ["session:attribution:0", "session:attribution:1"],
        )
        self.assertEqual(self.invoke("Stop", "0", "CHANGED"), 0)
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(len(self.exports), 2)

    def test_session_end_seals_missing_stop_locally_then_prompt_drains(self) -> None:
        rollout(self.path, 2)
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "PROVISIONAL"), 0)
        self.assertEqual(self.invoke("Stop", "1", "LATER"), 0)
        self.assertEqual(self.invoke("SessionEnd", item="MUST-NOT-BECOME-FALLBACK"), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(self.invoke("UserPromptSubmit", "2", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["darrow.work_item_id"] for trace in self.exports],
            ["PROVISIONAL", "LATER"],
        )
        self.assertEqual(
            [trace["session_id"] for trace in self.exports],
            ["session:attribution:0", "session:attribution:1"],
        )

    def test_new_session_recovers_prior_terminal_backlog(self) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "OLD-SESSION"), 0)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        self.path = self.root / "new-rollout.jsonl"
        rollout(self.path)
        self.session = "new-session"
        self.path.write_text(
            self.path.read_text().replace('"id": "session"', '"id": "new-session"')
        )
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(
            [trace["metadata"].get("darrow.work_item_id") for trace in self.exports],
            ["OLD-SESSION"],
        )

    def test_interrupt_resolves_active_turn_using_provisional_evidence(self) -> None:
        rollout(self.path)
        lines = self.path.read_text().splitlines()
        self.path.write_text("\n".join(lines[:-1]) + "\n")
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "BEFORE-INTERRUPT"), 0)
        self.assertEqual(self.invoke("Interrupt", "0", "IGNORED"), 0)
        self.assertEqual(self.exports, [])
        self.assertEqual(self.invoke("UserPromptSubmit", "1", background=True), 0)
        self.assertEqual(
            self.exports[0]["metadata"]["darrow.work_item_id"], "BEFORE-INTERRUPT"
        )
        self.assertTrue(self.exports[0]["metadata"]["codex.aborted"])

    def test_preindexed_turn_is_not_a_final_capture_receipt(self) -> None:
        rollout(self.path, 2)
        self.assertEqual(self.invoke("Stop", "1", "LATER"), 0)
        self.assertFalse(await_capture(self.path, "0", timeout=0.05))
        sent: list[dict[str, Any]] = []
        config = Config(
            enabled=True,
            work_item_id="EARLIER",
            public_key="pk-lifecycle",
            secret_key="sk-lifecycle",
        )

        def record(document: dict[str, Any], _config: Config) -> int:
            sent.append(document)
            return len(document["traces"])

        def background() -> None:
            if await_capture(self.path, "0", timeout=3):
                drain(
                    self.path,
                    config,
                    cwd=str(self.root),
                    exporter=record,
                )

        with database(self.path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            foreground = threading.Thread(
                target=lambda: capture(
                    self.path, config, str(self.root), "session", "0", self.plugin_data
                )
            )
            worker = threading.Thread(target=background)
            foreground.start()
            worker.start()
            time.sleep(0.15)
            self.assertEqual(sent, [])
            self.assertTrue(foreground.is_alive())
            connection.execute("COMMIT")
        foreground.join(3)
        worker.join(3)
        self.assertFalse(foreground.is_alive())
        self.assertFalse(worker.is_alive())
        self.assertEqual(len(sent), 1)
        self.assertEqual(len(sent[0]["traces"]), 2)

    def test_terminal_receipt_does_not_wait_for_capture_transaction(self) -> None:
        rollout(self.path)
        with (
            ThreadPoolExecutor(max_workers=1) as executor,
            database(self.path) as connection,
        ):
            connection.execute("BEGIN IMMEDIATE")
            try:
                receipt = executor.submit(self.invoke, "SessionEnd")
                # A blocked SQLite operation can wait 30 seconds; allow slow CI I/O.
                self.assertEqual(receipt.result(timeout=10), 0)
            finally:
                connection.execute("ROLLBACK")
        self.assertEqual(self.exports, [])

    def test_initial_capture_binding_serializes_terminal_context_without_waiting(
        self,
    ) -> None:
        from dataclasses import replace

        from darrow_observability_langfuse.capture import _put
        from darrow_observability_langfuse.lifecycle import record_terminal

        rollout(self.path)
        config = Config(enabled=True, public_key="pk-origin", secret_key="sk-origin")
        started, finish = threading.Event(), threading.Event()
        failures: list[BaseException] = []

        paused_put = partial(_paused_put, _put, started, finish)
        foreground = partial(
            _foreground_capture,
            self.path,
            config,
            self.root,
            self.plugin_data,
            failures,
        )

        with patch(
            "darrow_observability_langfuse.capture._put", side_effect=paused_put
        ):
            worker = threading.Thread(target=foreground)
            worker.start()
            try:
                self.assertTrue(started.wait(2))
                tick = time.monotonic()
                with self.assertRaisesRegex(ValueError, "delivery context"):
                    record_terminal(
                        self.path,
                        "session",
                        "SessionEnd",
                        None,
                        replace(config, public_key="pk-other"),
                        self.plugin_data,
                        cwd=str(self.root),
                    )
                record_terminal(
                    self.path,
                    "session",
                    "SessionEnd",
                    None,
                    config,
                    self.plugin_data,
                    cwd=str(self.root),
                )
                self.assertLess(time.monotonic() - tick, 1)
            finally:
                finish.set()
                worker.join(5)
        self.assertFalse(worker.is_alive())
        self.assertEqual(failures, [])
        capture(self.path, config, str(self.root), "session", None, self.plugin_data)
        self.assertEqual(
            drain(
                self.path,
                config,
                cwd=str(self.root),
                exporter=lambda doc, cfg: len(doc["traces"]),
            ),
            1,
        )

    def test_watermark_does_not_seal_appended_live_turn(self) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        with self.path.open("a") as handle:
            for payload in (
                {"type": "task_started", "turn_id": "1"},
                {"type": "task_complete"},
            ):
                handle.write(
                    json.dumps({"type": "event_msg", "payload": payload}) + "\n"
                )
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["codex.turn_id"] for trace in self.exports], ["0"]
        )
        self.assertEqual(self.invoke("Stop", "1", "RESUMED"), 0)
        self.assertEqual(self.invoke("Stop", "1", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["codex.turn_id"] for trace in self.exports], ["0", "1"]
        )

    def test_watermark_closes_active_turn_before_resumed_append(self) -> None:
        rollout(self.path)
        self.path.write_text("\n".join(self.path.read_text().splitlines()[:-1]) + "\n")
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "SEALED"), 0)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        with self.path.open("a") as handle:
            for payload in (
                {"type": "task_started", "turn_id": "1"},
                {"type": "task_complete"},
            ):
                handle.write(
                    json.dumps({"type": "event_msg", "payload": payload}) + "\n"
                )
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(
            [trace["metadata"]["codex.turn_id"] for trace in self.exports], ["0"]
        )

    def test_terminal_missing_evidence_cannot_use_later_provisional_snapshot(
        self,
    ) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "TOO-LATE"), 0)
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertNotIn("darrow.work_item_id", self.exports[0]["metadata"])
        self.assertIsNone(self.exports[0]["session_id"])

    def test_terminal_receipt_survives_cancelled_materialization(self) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("UserPromptSubmit", "0", "DURABLE"), 0)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        with (
            patch(
                "darrow_observability_langfuse.capture._put",
                side_effect=KeyboardInterrupt,
            ),
            self.assertRaises(KeyboardInterrupt),
        ):
            self.invoke("SessionStart", background=True)
        self.assertEqual(delivery_rows(self.path), [])
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(self.exports[0]["metadata"]["darrow.work_item_id"], "DURABLE")

    def test_repeated_late_stop_recognizes_an_already_sealed_receipt(self) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertTrue(await_capture(self.path, "0", timeout=0.05))
        self.assertEqual(self.invoke("Stop", "0", "TOO-LATE"), 0)
        self.assertEqual(self.invoke("Stop", "0", background=True), 0)
        self.assertEqual(len(self.exports), 1)

    def test_terminal_watermark_does_not_apply_to_replaced_rollout(self) -> None:
        rollout(self.path)
        self.assertEqual(self.invoke("SessionEnd"), 0)
        replacement = self.root / "replacement.jsonl"
        rollout(replacement)
        replacement.replace(self.path)
        self.assertEqual(self.invoke("SessionStart", background=True), 0)
        self.assertEqual(self.exports, [])

    def test_final_stop_receipt_freezes_content_policy_while_waiting(self) -> None:
        from dataclasses import replace

        rollout(self.path, 2)
        config = Config(enabled=True, capture_content=False, work_item_id="LATER")
        capture(self.path, config, str(self.root), "session", "1", self.plugin_data)
        capture(
            self.path,
            replace(config, capture_content=True, work_item_id="EARLIER"),
            str(self.root),
            "session",
            "0",
            self.plugin_data,
        )
        later = json.loads(delivery_rows(self.path)[1]["document"])["traces"][0]
        self.assertNotIn("input", later)


if __name__ == "__main__":
    unittest.main()
