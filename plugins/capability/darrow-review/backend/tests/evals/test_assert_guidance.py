"""Aggregate guidance comparisons preserve full JSON field values."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from assert_guidance import check


def test_finding_guidance_distinguishes_newline_from_escape(tmp_path: Path) -> None:
    reader = [
        ["format", "darrow-review-axis-v2"],
        ["axis", "spec"],
        [
            "finding",
            "high",
            "blocking",
            "src/a:1",
            "requirement",
            "evidence",
            "repair\nstep",
            "resolved",
        ],
    ]
    aggregate = [
        ["format", "darrow-review-result-v2"],
        ["finding", "spec", *reader[2][1:]],
    ]
    (tmp_path / "spec-axis.json").write_text(json.dumps(reader), encoding="utf-8")
    (tmp_path / "proof.json").write_text(
        json.dumps({"format": "other"}), encoding="utf-8"
    )
    result = tmp_path / "result.json"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    check(result, "finding")
    aggregate[1][7] = "repair\\nstep"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    with pytest.raises(ValueError, match="differs from a reader"):
        check(result, "finding")


def test_regression_guidance_keeps_reader_fields(tmp_path: Path) -> None:
    reader = [
        ["format", "darrow-review-fix-axis-v2"],
        ["axis", "spec"],
        [
            "regression",
            "spec:1:T",
            "high",
            "src/a:2",
            "source",
            "evidence",
            "fix\tstep",
            "resolution",
        ],
    ]
    aggregate = [
        ["format", "darrow-review-verification-v2"],
        [
            "regression",
            "regression:1:spec:1:T",
            "spec:1:T",
            "1",
            "spec",
            "high",
            "unresolved",
            "progressing",
            "src/a:2",
            "source",
            "evidence",
            "fix\tstep",
            "resolution",
        ],
    ]
    (tmp_path / "spec-fix-axis.json").write_text(json.dumps(reader), encoding="utf-8")
    result = tmp_path / "verification.json"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    check(result, "regression")
    aggregate[1][11] = "fix\\tstep"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    with pytest.raises(ValueError, match="differs from a reader"):
        check(result, "regression")
