"""Eval checks preserve control characters in JSON fields."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from assert_records import check, load


def test_exact_records_distinguish_control_characters(tmp_path: Path) -> None:
    artifact = tmp_path / "record.json"
    artifact.write_text(
        json.dumps([["evidence", "line\nnext"], ["evidence", "line\\nnext"]]),
        encoding="utf-8",
    )
    assert load(artifact) == [["evidence", "line\nnext"], ["evidence", "line\\nnext"]]
    check(artifact, "has", ["evidence", "line\nnext"])
    check(artifact, "has", ["evidence", "line\\nnext"])
    check(artifact, "lacks", ["evidence", "line\tnext"])
    with pytest.raises(ValueError, match="missing record"):
        check(artifact, "has", ["evidence", "line\tnext"])
