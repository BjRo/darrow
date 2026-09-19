from __future__ import annotations

import io
import json
import os
import runpy
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import patch

import requests

from darrow_observability_langfuse import (
    cli,
    config,
    delivery,
    export,
    lifecycle,
    rollout,
    sidecar,
)
from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.context import delivery_context
from darrow_observability_langfuse.export import DeliveryError


class ConfigEdgeTests(unittest.TestCase):
    def test_boolean_and_file_validation(self) -> None:
        self.assertTrue(config._parse_bool(True, "enabled"))
        self.assertFalse(config._parse_bool(" off ", "enabled"))
        for invalid in (1, "maybe"):
            with (
                self.subTest(invalid=invalid),
                self.assertRaisesRegex(ValueError, "must be a boolean"),
            ):
                config._parse_bool(invalid, "enabled")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            self.assertEqual(config._read_config_file(path), {})
            path.write_text("not-json", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unreadable or invalid"):
                config._read_config_file(path)
            path.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must contain an object"):
                config._read_config_file(path)

    def test_numeric_config_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            for value in ("invalid", -1, 1_000_001):
                with (
                    self.subTest(value=value),
                    self.assertRaisesRegex(ValueError, "max_chars"),
                ):
                    config.load_config(
                        directory,
                        home=directory,
                        env={"DARROW_LANGFUSE_MAX_CHARS": str(value)},
                    )

    def test_git_failures_and_explicit_work_item_resolution(self) -> None:
        with patch(
            "darrow_observability_langfuse.config.subprocess.run", side_effect=OSError
        ):
            self.assertIsNone(config._git_output("/missing", "status"))
        self.assertEqual(
            config.resolve_work_item_id(Config(work_item_id="ISSUE-1"), "/missing"),
            "ISSUE-1",
        )


class LifecycleEdgeTests(unittest.TestCase):
    def test_registry_validation_rejects_each_invalid_shape(self) -> None:
        values: list[Any] = [
            None,
            {"rollout": "relative", "session_id": "session"},
            {"rollout": "/absolute", "session_id": ""},
        ]
        for value in values:
            with (
                self.subTest(value=value),
                self.assertRaisesRegex(ValueError, "registry is invalid"),
            ):
                lifecycle._validate_registry_entry(value)

    def test_terminal_validation_rejects_each_invalid_shape(self) -> None:
        valid = {
            "session_id": "session",
            "event": "SessionEnd",
            "identity": [1, 2, 3],
            "offset": 0,
            "capture_content": False,
        }
        values: list[Any] = [
            None,
            {**valid, "session_id": "other"},
            {**valid, "event": "Unknown"},
            {**valid, "offset": -1},
            {**valid, "capture_content": "false"},
            {**valid, "event": "Interrupt", "turn_id": None},
        ]
        for value in values:
            with (
                self.subTest(value=value),
                self.assertRaisesRegex(ValueError, "receipt is invalid"),
            ):
                lifecycle._validate_terminal_record(value, "session")

    def test_terminal_input_and_no_plugin_registry(self) -> None:
        self.assertEqual(list(lifecycle.registered_rollouts(None, {})), [])
        lifecycle.register_rollout(Path("/tmp/rollout"), "session", None, {})
        with self.assertRaisesRegex(ValueError, "invalid terminal hook"):
            lifecycle.record_terminal(
                Path("/missing"),
                "session",
                "Other",
                None,
                Config(),
                None,
                cwd="/tmp",
            )
        with self.assertRaisesRegex(ValueError, "readable absolute file"):
            lifecycle.record_terminal(
                Path("relative"),
                "session",
                "SessionEnd",
                None,
                Config(),
                None,
                cwd="/tmp",
            )

    def test_legacy_context_binding_and_unbound_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            rollout_path = Path(directory) / "rollout.jsonl"
            database_path = Path(f"{rollout_path}.darrow-langfuse.sqlite3")
            context = delivery_context(Config(), directory)
            connection = sqlite3.connect(database_path)
            for table in ("envelopes", "captured_turns", "receipts", "snapshots"):
                connection.execute(f"CREATE TABLE {table} (value TEXT)")
            connection.execute("CREATE TABLE state (key TEXT, value TEXT)")
            connection.execute(
                "INSERT INTO state VALUES ('delivery_context', ?)",
                (json.dumps(context),),
            )
            connection.commit()
            connection.close()
            lifecycle._validate_legacy_context(rollout_path, context)

            connection = sqlite3.connect(database_path)
            connection.execute("DELETE FROM state")
            connection.execute("INSERT INTO envelopes VALUES ('evidence')")
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "context"):
                lifecycle._validate_legacy_context(rollout_path, context)


class SidecarEdgeTests(unittest.TestCase):
    def test_provisional_path_and_state_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for identifier in ("", "x" * 257, "bad\nvalue"):
                with (
                    self.subTest(identifier=identifier),
                    self.assertRaisesRegex(ValueError, "invalid session ID"),
                ):
                    sidecar._provisional_path(root, identifier)
            path = root / "state.json"
            path.write_text("bad", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unreadable or invalid"):
                sidecar._load_state_path(path)
            path.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unreadable or invalid"):
                sidecar._load_state_path(path)

    def test_sidecar_version_and_identifier_validation(self) -> None:
        versions: list[dict[str, Any]] = [
            {"attribution_snapshots": {}},
            {"version": 2, "uploaded_turn_ids": [], "attribution_snapshots": {}},
        ]
        for version in versions:
            with self.subTest(value=version), self.assertRaises(ValueError):
                sidecar._validate_version(version)
        identifiers: list[Any] = [None, [""], ["bad\nvalue"]]
        for identifier in identifiers:
            with (
                self.subTest(value=identifier),
                self.assertRaisesRegex(ValueError, "uploaded_turn_ids"),
            ):
                sidecar._validated_identifiers(identifier)

    def test_snapshot_validation_rejects_invalid_fields(self) -> None:
        with self.assertRaisesRegex(ValueError, "attribution_snapshots"):
            sidecar._validated_snapshots([])
        invalid = [
            ("", {}),
            ("turn", []),
            ("turn", {"source": "other", "work_item_id": None}),
            ("turn", {"source": "none", "work_item_id": "ISSUE-1"}),
            ("turn", {"source": "configuration", "work_item_id": "bad value"}),
            (
                "turn",
                {
                    "source": "git_branch",
                    "work_item_id": "ISSUE-1",
                    "branch": None,
                },
            ),
        ]
        for turn_id, snapshot in invalid:
            with (
                self.subTest(snapshot=snapshot),
                self.assertRaisesRegex(ValueError, "attribution snapshot"),
            ):
                sidecar._validate_snapshot(turn_id, snapshot)

    def test_pending_and_export_validation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            rollout_path = Path(directory) / "rollout.jsonl"
            with self.assertRaisesRegex(ValueError, "missing traces"):
                sidecar.pending_document({}, rollout_path)
            with self.assertRaisesRegex(ValueError, "missing traces"):
                sidecar.mark_exported_turns(rollout_path, {})
            sidecar.mark_exported_turns(rollout_path, {"traces": [{"metadata": {}}]})
            document = {
                "traces": [
                    None,
                    {"metadata": {"codex.completed": False}},
                    {
                        "metadata": {
                            "codex.completed": True,
                            "codex.turn_id": "turn-1",
                        }
                    },
                ]
            }
            sidecar.mark_exported_turns(rollout_path, document)
            self.assertEqual(
                sidecar.pending_document(document, rollout_path)["traces"], []
            )

    def test_provisional_discard_empty_and_remaining(self) -> None:
        snapshot = {
            "source": "configuration",
            "work_item_id": "ISSUE-1",
            "branch": None,
            "head": None,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sidecar.discard_provisional_attribution_snapshots(root, "session", set())
            sidecar.record_provisional_attribution_snapshot(
                root, "session", "one", snapshot
            )
            sidecar.record_provisional_attribution_snapshot(
                root, "session", "two", snapshot
            )
            sidecar.discard_provisional_attribution_snapshots(root, "session", {"one"})
            self.assertEqual(
                set(sidecar.load_provisional_attribution_snapshots(root, "session")),
                {"two"},
            )


class DeliveryAndExportEdgeTests(unittest.TestCase):
    def test_empty_delivery_and_busy_lock(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(
                delivery.drain(root / "missing", Config(), cwd=directory), 0
            )
            with (
                patch(
                    "darrow_observability_langfuse.delivery.fcntl.flock",
                    side_effect=BlockingIOError,
                ),
                delivery._exclusive_lock(root / "lock") as acquired,
            ):
                self.assertFalse(acquired)

    def test_delivery_envelope_validation(self) -> None:
        rows = cast(
            "list[sqlite3.Row]",
            [{"expected_count": 2, "identity": "expected"}],
        )
        document = {
            "traces": [
                {
                    "metadata": {
                        "darrow.expected_observation_count": 1,
                        "darrow.delivery_id": "other",
                    },
                    "observations": [],
                }
            ]
        }
        with self.assertRaisesRegex(ValueError, "envelope evidence"):
            delivery._validate_envelopes(document, rows)

    def test_no_session_and_batch_boundaries(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            rollout_path = Path(directory) / "rollout.jsonl"
            with (
                patch.object(delivery, "database_path", return_value=rollout_path),
                patch.object(Path, "exists", return_value=True),
                patch.object(delivery, "_session_id", return_value=None),
            ):
                self.assertEqual(
                    delivery.drain(rollout_path, Config(), cwd=directory), 0
                )

        rows = [{"expected_count": 400}, {"expected_count": 200}]
        connection = SimpleNamespace(execute=lambda *_args: iter(rows))
        drainer = delivery._Drainer(Path("/tmp/rollout"), Config(), lambda *_: 0)
        self.assertEqual(
            drainer._pending_rows(cast("sqlite3.Connection", connection)), [rows[0]]
        )

    def test_delivery_attempt_mismatch_and_cancellation(self) -> None:
        batch = delivery._Batch([], {}, [], 0)
        mismatch = delivery._Drainer(Path("/tmp/rollout"), Config(), lambda *_: 1)
        with patch.object(mismatch, "_record_failure") as record_failure:
            mismatch._attempt(batch)
        self.assertIsInstance(mismatch.failure, DeliveryError)
        record_failure.assert_called_once()

        def cancel(*_arguments: Any) -> int:
            raise KeyboardInterrupt

        cancelled = delivery._Drainer(Path("/tmp/rollout"), Config(), cancel)
        with self.assertRaises(KeyboardInterrupt):
            cancelled._attempt(batch)

    def test_single_attempt_exporter_response_and_failure_classes(self) -> None:
        exporter = export.SingleAttemptExporter(Config())
        self.assertTrue(exporter.force_flush())
        exporter.shutdown()
        with self.assertRaisesRegex(DeliveryError, "HTTP rejection") as rejection:
            exporter._reject_status(400)
        self.assertEqual(rejection.exception.outcome, "pending")
        exporter.accepted = 1
        with self.assertRaises(DeliveryError) as later_rejection:
            exporter._reject_status(400)
        self.assertEqual(later_rejection.exception.outcome, "uncertain")
        self.assertEqual(
            exporter._classify_failure(requests.exceptions.InvalidURL()).outcome,
            "uncertain",
        )
        self.assertEqual(exporter._classify_failure(ValueError()).outcome, "uncertain")

    def test_response_helpers_and_recursive_connection_detection(self) -> None:
        self.assertTrue(
            export._queued_response({"name": "otel-ingestion-job", "data": {"id": "1"}})
        )
        self.assertFalse(export._queued_response({"name": "other"}))
        cyclic = RuntimeError("connection")
        cyclic.__cause__ = cyclic
        self.assertFalse(export._connection_refused(cyclic, set()))
        export._parse_json_response(
            {"name": "otel-ingestion-job", "data": {"id": "1"}}, object()
        )
        self.assertEqual(
            export._observation_attributes({"name": "plain"})["name"], "plain"
        )
        error = export._observation_attributes({"name": "failed", "error": "boom"})
        self.assertEqual(error["level"], "ERROR")

    def test_trace_and_recording_validation(self) -> None:
        with self.assertRaisesRegex(ValueError, "missing traces"):
            export._validated_traces({})
        with self.assertRaisesRegex(ValueError, "invalid trace"):
            export._validated_traces({"traces": [None]})
        export._verify_recording(None, 0)
        recording = SimpleNamespace(failed=lambda: False, count=1)
        with self.assertRaisesRegex(DeliveryError, "count was not confirmed"):
            export._verify_recording(recording, 2)

    def test_recording_exporter_short_circuit_and_cached_config_refusal(self) -> None:
        failed_delegate = SimpleNamespace(
            failure=DeliveryError("pending", "failed"),
            accepted=0,
            export=lambda _spans: None,
            force_flush=lambda **_kwargs: True,
            shutdown=lambda: None,
        )
        recording = export._RecordingExporter(
            cast("export.SingleAttemptExporter", failed_delegate)
        )
        recording.export([])
        self.assertTrue(recording.force_flush())
        recording.shutdown()

        original = dict(export._CLIENTS)
        export._CLIENTS["pk"] = (object(), recording, Config(public_key="pk"))
        try:
            with self.assertRaisesRegex(ValueError, "configuration changed"):
                export._new_recording_client(
                    Config(public_key="pk", base_url="https://different.example")
                )
        finally:
            export._CLIENTS.clear()
            export._CLIENTS.update(original)


class CliEdgeTests(unittest.TestCase):
    def test_hook_input_and_identifier_validation(self) -> None:
        with (
            patch(
                "darrow_observability_langfuse.cli.sys.stdin", io.StringIO("not-json")
            ),
            self.assertRaisesRegex(ValueError, "not valid JSON"),
        ):
            cli._read_hook_input()
        with (
            patch("darrow_observability_langfuse.cli.sys.stdin", io.StringIO("[]")),
            self.assertRaisesRegex(ValueError, "JSON object"),
        ):
            cli._read_hook_input()
        with self.assertRaisesRegex(ValueError, "missing value"):
            cli._required_identifier(None, "value")

    def test_trace_completion_and_completed_identifier_filter(self) -> None:
        with self.assertRaisesRegex(ValueError, "missing turn_id"):
            cli._complete_stop_turn({}, None)
        with self.assertRaisesRegex(ValueError, "missing traces"):
            cli._complete_stop_turn({}, "turn")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            cli._complete_stop_turn({"traces": []}, "turn")
        self.assertEqual(cli._completed_turn_ids({}), set())
        document = {
            "traces": [
                None,
                {"metadata": {"codex.completed": False, "codex.turn_id": "skip"}},
                {"metadata": {"codex.completed": True, "codex.turn_id": "done"}},
            ]
        }
        self.assertEqual(cli._completed_turn_ids(document), {"done"})
        completed = {"traces": [{"metadata": {"codex.turn_id": "turn"}}]}
        cli._complete_stop_turn(completed, "turn")
        self.assertTrue(completed["traces"][0]["metadata"]["codex.completed"])

    def test_run_disabled_and_background_refusals(self) -> None:
        with (
            patch("darrow_observability_langfuse.cli.sys.stdin", io.StringIO("{}")),
            patch.object(cli, "load_config", return_value=Config()),
        ):
            self.assertEqual(cli.run(), 0)
        runner = cli._HookRunner(
            Config(enabled=True, public_key="pk", secret_key="sk"),
            {"session_id": "session", "hook_event_name": "Unknown"},
            "/tmp",
            None,
        )
        with self.assertRaisesRegex(ValueError, "unsupported background"):
            runner._background()
        runner.event = "Stop"
        runner.hook_input.update(transcript_path="/tmp/rollout", turn_id="turn")
        with (
            patch.object(cli, "await_capture", return_value=False),
            self.assertRaisesRegex(ValueError, "has not completed"),
        ):
            runner._background_stop()

    def test_hook_runner_refusal_and_dry_run_paths(self) -> None:
        runner = cli._HookRunner(
            Config(enabled=True, dry_run=True),
            {"session_id": "session", "hook_event_name": "Unknown"},
            "/tmp",
            None,
        )
        with self.assertRaisesRegex(ValueError, "unsupported hook"):
            runner.execute(False)
        self.assertEqual(runner._background(), 0)
        runner.event = "Interrupt"
        self.assertEqual(runner._terminal(), 0)
        runner.event = "UserPromptSubmit"
        self.assertEqual(runner._prompt(), 0)
        runner.config = Config(enabled=True)
        with self.assertRaisesRegex(ValueError, "PLUGIN_DATA"):
            runner._prompt()
        with self.assertRaisesRegex(ValueError, "missing transcript_path"):
            runner._absolute_rollout()
        runner.hook_input["transcript_path"] = "relative"
        with self.assertRaisesRegex(ValueError, "absolute"):
            runner._absolute_rollout()
        with self.assertRaisesRegex(ValueError, "credentials"):
            runner._require_credentials()
        runner.config = Config(enabled=True, dry_run=True)
        runner.hook_input.update(transcript_path="/tmp/rollout", turn_id="turn")
        with patch.object(runner, "_print_dry_run") as print_dry_run:
            self.assertEqual(runner._stop(), 0)
        print_dry_run.assert_called_once()

    def test_dry_run_document_uses_all_snapshot_sources(self) -> None:
        runner = cli._HookRunner(
            Config(enabled=True, dry_run=True),
            {
                "session_id": "session",
                "hook_event_name": "Stop",
                "turn_id": "turn",
                "transcript_path": "/tmp/rollout",
            },
            "/tmp",
            Path("/tmp/plugin-data"),
        )
        document = {"traces": [{"metadata": {"codex.turn_id": "turn"}}]}
        output = io.StringIO()
        with (
            patch.object(cli, "load_attribution_snapshots", return_value={}),
            patch.object(cli, "load_capture_snapshots", return_value={}),
            patch.object(
                cli,
                "load_provisional_attribution_snapshots",
                return_value={"turn": {"source": "none"}},
            ),
            patch.object(cli, "attribution_snapshot", return_value={"source": "none"}),
            patch.object(cli, "trace_document", return_value=document),
            patch("darrow_observability_langfuse.cli.sys.stdout", output),
        ):
            runner._print_dry_run(Path("/tmp/rollout"), "turn")
        self.assertTrue(document["traces"][0]["metadata"]["codex.completed"])
        self.assertTrue(output.getvalue().endswith("\n"))

    def test_main_writes_launcher_status(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "status"
            with (
                patch.object(cli, "run", return_value=0),
                patch(
                    "darrow_observability_langfuse.cli.sys.argv",
                    ["cli", "--launcher-status", str(receipt)],
                ),
                self.assertRaises(SystemExit) as exit_status,
            ):
                cli.main()
            self.assertEqual(exit_status.exception.code, 0)
            self.assertEqual(receipt.read_text(encoding="ascii"), "0\n")
        with (
            patch.object(cli, "run", return_value=0),
            patch("darrow_observability_langfuse.cli.sys.argv", ["cli"]),
            self.assertRaises(SystemExit),
        ):
            cli.main()

    def test_module_entrypoint(self) -> None:
        module_name = "darrow_observability_langfuse.cli"
        imported = sys.modules.pop(module_name)
        try:
            with (
                tempfile.TemporaryDirectory() as directory,
                patch.object(sys, "stdin", io.StringIO("{}")),
                patch.object(sys, "argv", ["cli"]),
                patch.dict(os.environ, {"HOME": directory}),
                self.assertRaises(SystemExit),
            ):
                runpy.run_module(module_name, run_name="__main__")
        finally:
            sys.modules[module_name] = imported


class RolloutEdgeTests(unittest.TestCase):
    def test_content_helpers_cover_structural_variants(self) -> None:
        self.assertEqual(rollout._clip(["abcd"], 2), ["ab\n…[truncated 2 chars]"])
        self.assertEqual(
            rollout._clip({"api_key": "secret"}, 20), {"api_key": "[REDACTED]"}
        )
        self.assertIsNone(rollout._message_text("not-a-list"))
        self.assertEqual(
            rollout._message_text([None, {"type": "input_text", "text": "hello"}]),
            "hello",
        )
        self.assertEqual(rollout._reasoning_text({"content": "reason"}), "reason")
        self.assertIsNone(rollout._reasoning_text({"content": 1}))
        self.assertEqual(rollout._reasoning_part("part"), "part")
        self.assertIsNone(rollout._reasoning_part({"text": 1}))
        self.assertEqual(rollout._parse_arguments({"value": 1}), {"value": 1})

    def test_javascript_and_tool_label_helpers(self) -> None:
        self.assertEqual(rollout._decode_js_string("'a\\nb'"), "a\nb")
        self.assertEqual(rollout._decode_js_string('"unterminated'), "unterminate")
        self.assertEqual(rollout._call_arguments("nested(one))", 0), "nested(one)")
        self.assertIsNone(rollout._call_arguments("never(closes", 0))
        self.assertIsNone(rollout._command_from_arguments(1))
        self.assertIsNone(rollout._command_from_arguments("{value: 1}"))
        self.assertEqual(rollout._invocation_label("tool", None), "tool")
        self.assertEqual(rollout._nested_invocation_labels("tools.tool("), [])
        self.assertEqual(rollout._quote_after_character('\\"', 1, '"'), '"')
        self.assertEqual(
            rollout._invocation_label("exec_command", {"cmd": "echo\nhello"}),
            "echo hello",
        )
        self.assertEqual(
            rollout._invocation_label("exec_command", {"value": 1}),
            'exec_command {"value":1}',
        )
        long_name = rollout._tool_observation_name(
            {"name": "tool", "input": "x" * 600},
            Config(capture_content=True, max_chars=1_000),
        )
        self.assertEqual(len(long_name), 512)

    def test_directive_usage_and_record_validation(self) -> None:
        self.assertIsNone(rollout._attribution_directive(None))
        self.assertIsNone(rollout._attribution_directive("ordinary prompt"))
        self.assertEqual(
            rollout._attribution_directive("\n@darrow.attribution clear"),
            ("clear", None),
        )
        with self.assertRaisesRegex(ValueError, "invalid @darrow"):
            rollout._attribution_directive("@darrow.attribution set")
        self.assertIsNone(rollout._valid_usage(None))
        self.assertIsNone(
            rollout._valid_usage(
                {"input_tokens": 1, "output_tokens": 2, "total_tokens": 99}
            )
        )
        self.assertIsNone(
            rollout._valid_usage(
                {"input_tokens": -1, "output_tokens": 1, "total_tokens": 0}
            )
        )
        details = rollout._valid_usage(
            {
                "input_tokens": 2,
                "output_tokens": 1,
                "total_tokens": 3,
                "cached_input_tokens": 1,
                "reasoning_output_tokens": 2,
            }
        )
        self.assertEqual(
            details,
            {
                "input_tokens": 2,
                "output_tokens": 1,
                "total_tokens": 3,
                "cached_input_tokens": 1,
            },
        )
        self.assertIsNone(rollout._parse_record("bad"))
        self.assertIsNone(rollout._parse_record("[]"))
        with self.assertRaisesRegex(ValueError, "readable absolute file"):
            rollout.load_rollout(Path("relative"))

    def test_parser_ignores_unknown_and_handles_event_variants(self) -> None:
        records = [
            {"timestamp": "1", "type": "unknown", "payload": {}},
            {"timestamp": "2", "type": "response_item", "payload": {"type": 1}},
            {
                "timestamp": "3",
                "type": "event_msg",
                "payload": {"type": "agent_message", "message": "last"},
            },
            {
                "timestamp": "4",
                "type": "event_msg",
                "payload": {
                    "type": "sub_agent_activity",
                    "kind": "started",
                    "agent_thread_id": "child",
                },
            },
            {
                "timestamp": "5",
                "type": "event_msg",
                "payload": {"type": "unknown_end", "call_id": "missing"},
            },
            {
                "timestamp": "6",
                "type": "event_msg",
                "payload": {"type": "turn_aborted"},
            },
        ]
        session, turns = rollout.parse_rollout(records)
        self.assertIsNone(session["session_id"])
        self.assertTrue(turns[0]["aborted"])
        self.assertEqual(turns[0]["output"], "last")
        self.assertEqual(turns[0]["subagent_thread_ids"], ["child"])

    def test_parser_handles_messages_reasoning_and_tool_results(self) -> None:
        records = [
            {
                "timestamp": "1",
                "type": "session_meta",
                "payload": {"id": "session"},
            },
            {
                "timestamp": "2",
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": "answer"}],
                },
            },
            {
                "timestamp": "3",
                "type": "response_item",
                "payload": {
                    "type": "function_call",
                    "call_id": "call",
                    "name": "tool",
                    "arguments": "{}",
                },
            },
            {
                "timestamp": "4",
                "type": "response_item",
                "payload": {
                    "type": "function_call_output",
                    "call_id": "call",
                    "output": "done",
                },
            },
            {
                "timestamp": "5",
                "type": "response_item",
                "payload": {"type": "reasoning", "summary": [{"text": "why"}]},
            },
            {
                "timestamp": "6",
                "type": "event_msg",
                "payload": {"type": "task_complete"},
            },
        ]
        _session, turns = rollout.parse_rollout(records)
        step = turns[0]["steps"][0]
        self.assertEqual(step["output"], "answer")
        self.assertEqual(step["reasoning"], "why")
        self.assertEqual(step["tools"][0]["output"], "done")

    def test_trace_validation_and_attribution_variants(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollout.jsonl"
            path.write_text("{}\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "thread ID"):
                rollout.trace_document(path, Config(), directory, parsed=({}, []))
            timeline = rollout._AttributionTimeline(
                Config(secret_key="SECRET"),
                "thread",
                {},
                None,
                {"mode": "set", "explicit_work_item_id": "SECRET", "epoch": 0},
            )
            attribution = timeline.for_turn({"turn_id": "missing"})
            self.assertIsNone(attribution["work_item_id"])
            self.assertEqual(attribution["source"], "explicit")
            clear = rollout._AttributionTimeline(
                Config(), "thread", {}, None, {"mode": "clear"}
            ).for_turn({"turn_id": "missing"})
            self.assertEqual(clear["source"], "explicit")
            self.assertEqual(
                rollout._subagent_observations(
                    path,
                    "missing",
                    Config(),
                    {},
                    {path},
                    None,
                ),
                [],
            )


if __name__ == "__main__":
    unittest.main()
