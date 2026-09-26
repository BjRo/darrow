"""Fixture helpers accept JSON helper output without corrupting record fields."""

from __future__ import annotations

import json
from pathlib import Path

from assemble_fixture import assemble
from emit_rows import emit


def test_assemble_mixed_fixture_output(tmp_path: Path) -> None:
    source = "format\tdarrow-review-result-v2\n" + json.dumps(
        [["target", "WORKTREE@value"], ["changed_file", "/tmp/with\tand\ntext"]]
    )
    records = assemble(source)
    assert records == [
        ["format", "darrow-review-result-v2"],
        ["target", "WORKTREE@value"],
        ["changed_file", "/tmp/with\tand\ntext"],
    ]
    artifact = tmp_path / "fixture.json"
    artifact.write_text(json.dumps(records))
    assert emit(artifact) == (
        "format\tdarrow-review-result-v2\n"
        "target\tWORKTREE@value\n"
        "changed_file\t/tmp/with\\tand\\ntext\n"
    )
