"""Caller-owned review evidence is read at its exact repository-bound path."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from darrow_review import cli
from darrow_review.common import ReviewError


@pytest.mark.parametrize("absolute", [False, True])
def test_read_extensionless_evidence_from_another_directory(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, absolute: bool
) -> None:
    source = repo / ".git" / "verification-input"
    raw = '{"original_findings": [], "attempted": ["spec:1:target"]}\n'
    source.write_text(raw, encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    supplied = str(source) if absolute else ".git/verification-input"
    output = cli.result_command(
        ["read-evidence", "--repo", str(repo), "--input", supplied]
    )
    assert json.loads(output) == {
        "path": str(source.resolve()),
        "record": json.loads(raw),
    }
    assert source.read_text(encoding="utf-8") == raw


@pytest.mark.parametrize("kind", ["missing", "directory", "invalid", "array"])
def test_invalid_evidence_names_the_exact_path(repo: Path, kind: str) -> None:
    source = repo / ".git" / "verification-input"
    if kind == "directory":
        source.mkdir()
    elif kind in ("invalid", "array"):
        source.write_text("not JSON" if kind == "invalid" else "[]", encoding="utf-8")
    with pytest.raises(ReviewError) as error:
        cli.result_command(
            ["read-evidence", "--repo", str(repo), "--input", ".git/verification-input"]
        )
    assert str(source.resolve()) in str(error.value)
