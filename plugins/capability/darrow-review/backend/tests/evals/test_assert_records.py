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


@pytest.mark.parametrize("protocol", ["result", "verification"])
@pytest.mark.parametrize("fenced", [False, True])
def test_human_response_rejects_appended_machine_record(
    tmp_path: Path, protocol: str, fenced: bool
) -> None:
    artifact = tmp_path / "response.md"
    summary = "Review failed: restore the required input guard in parseName."
    artifact.write_text(summary, encoding="utf-8")
    check(artifact, "human-response", [])
    raw = json.dumps({"format": f"darrow-review-{protocol}-v3", "evidence": "wrong"})
    addition = f"```json\n{raw}\n```" if fenced else raw
    artifact.write_text(summary + "\n\n" + addition, encoding="utf-8")
    with pytest.raises(ValueError, match="machine record"):
        check(artifact, "human-response", [])


def test_human_response_allows_ordinary_markdown_and_protocol_names(
    tmp_path: Path,
) -> None:
    artifact = tmp_path / "response.md"
    artifact.write_text(
        "Review passed. The change validates darrow-review-result-v3. "
        'Example input `{"count": 2}` is valid; malformed `{text}` is rejected.',
        encoding="utf-8",
    )
    check(artifact, "human-response", [])
