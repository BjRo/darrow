"""Measurement receipts reject fabricated reports and absent backend execution."""

import json
from pathlib import Path

import pytest
from eval_context_usage import verify


def receipt(root: Path, output: bytes, number: int = 0) -> None:
    directory = root / f".fixture-state/context-capture/call.{number}"
    directory.mkdir(parents=True)
    (directory / "status").write_text("0")
    (directory / "arguments").write_text(
        "run\n--no-project\n/backend/scripts/run_locked.py\nia-context\n--format\ngrid\n"
    )
    (directory / "output").write_bytes(output)


def test_captured_grid_and_fabricated_copy(tmp_path: Path) -> None:
    output = (
        b"Context used (last token_count): 200 / 1000\nCategory\nS system_prompt 2\n"
    )
    receipt(tmp_path, output)
    saved = tmp_path / ".fixture-state/context-report.txt"
    saved.write_bytes(output)
    verify(tmp_path, "grid", True)
    receipt(tmp_path, output.replace(b"200", b"300"), 1)
    verify(tmp_path, "grid", True)
    saved.write_bytes(output.replace(b"200", b"400"))
    with pytest.raises(AssertionError):
        verify(tmp_path, "grid", True)


def test_report_without_execution_fails(tmp_path: Path) -> None:
    saved = tmp_path / ".fixture-state/context-report.txt"
    saved.parent.mkdir()
    saved.write_text("Context used (last token_count): 200 / 1000\nCategory\n")
    with pytest.raises(AssertionError):
        verify(tmp_path, "grid", True)


def test_json_receipt_and_wrong_thread_fail(tmp_path: Path) -> None:
    data = {
        "schema_version": 1,
        "rollout_path": str(tmp_path / "sessions/rollout-date-current.jsonl"),
        "categories": {"messages": 3},
        "exact_total_tokens": 20,
        "remainder_tokens": 17,
    }
    receipt(tmp_path, json.dumps(data).encode())
    directory = tmp_path / ".fixture-state/context-capture/call.0"
    (directory / "arguments").write_text("--no-project\nia-context\n--format\njson\n")
    (directory / "thread").write_text("current")
    verify(tmp_path, "json")
    (directory / "thread").write_text("unrelated")
    with pytest.raises(AssertionError):
        verify(tmp_path, "json")
