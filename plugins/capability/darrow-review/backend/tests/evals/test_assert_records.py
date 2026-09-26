"""Eval checks preserve control characters in JSON fields."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from assert_records import check, load


def test_exact_records_distinguish_control_characters(tmp_path: Path) -> None:
    artifact = tmp_path / "record.json"
    record = {"evidence": "line\nnext", "next_action": "line\\nnext"}
    artifact.write_text(json.dumps(record), encoding="utf-8")
    assert load(artifact) == record
    check(artifact, "has", ["evidence", "line\nnext"])
    check(artifact, "has", ["next_action", "line\\nnext"])
    check(artifact, "lacks", ["evidence", "line\tnext"])
    with pytest.raises(ValueError, match="has failed"):
        check(artifact, "has", ["evidence", "line\tnext"])


def test_route_assertion_reads_named_fields(tmp_path: Path) -> None:
    artifact = tmp_path / "route.json"
    artifact.write_text(
        json.dumps(
            {
                "selected_route": {
                    "host": "codex",
                    "provider": "openai",
                    "model": "gpt-6-astra",
                    "effort": "high",
                }
            }
        ),
        encoding="utf-8",
    )
    check(artifact, "has", ["selected_route", "codex", "openai", "gpt-6-astra", "high"])
