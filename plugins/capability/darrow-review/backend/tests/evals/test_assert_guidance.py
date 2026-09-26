"""Aggregate guidance comparisons preserve full JSON field values."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from assert_guidance import check


def test_finding_guidance_distinguishes_newline_from_escape(tmp_path: Path) -> None:
    finding = {
        "severity": "high",
        "disposition": "blocking",
        "location": "src/a:1",
        "source": "requirement",
        "evidence": "evidence",
        "repair_guidance": "repair\nstep",
        "resolution_evidence": "resolved",
    }
    reader = {"format": "darrow-review-axis-v3", "axis": "spec", "findings": [finding]}
    aggregate_finding = {"axis": "spec", **finding}
    aggregate = {"format": "darrow-review-result-v3", "findings": [aggregate_finding]}
    (tmp_path / "spec-axis.json").write_text(json.dumps(reader), encoding="utf-8")
    (tmp_path / "proof.json").write_text(
        json.dumps({"format": "other"}), encoding="utf-8"
    )
    result = tmp_path / "result.json"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    check(result, "finding")
    aggregate_finding["repair_guidance"] = "repair\\nstep"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    with pytest.raises(ValueError, match="differs from a reader"):
        check(result, "finding")


def test_regression_guidance_keeps_reader_fields(tmp_path: Path) -> None:
    regression = {
        "caused_by": "spec:1:T",
        "severity": "high",
        "location": "src/a:2",
        "source": "source",
        "evidence": "evidence",
        "repair_guidance": "fix\tstep",
        "resolution_evidence": "resolution",
    }
    reader = {
        "format": "darrow-review-fix-axis-v3",
        "axis": "spec",
        "regressions": [regression],
    }
    aggregate_regression = {
        "key": "regression:1:spec:1:T",
        "order": "1",
        "axis": "spec",
        "status": "unresolved",
        "progress": "progressing",
        **regression,
    }
    aggregate = {
        "format": "darrow-review-verification-v3",
        "regressions": [aggregate_regression],
    }
    (tmp_path / "spec-fix-axis.json").write_text(json.dumps(reader), encoding="utf-8")
    result = tmp_path / "verification.json"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    check(result, "regression")
    aggregate_regression["repair_guidance"] = "fix\\tstep"
    result.write_text(json.dumps(aggregate), encoding="utf-8")
    with pytest.raises(ValueError, match="differs from a reader"):
        check(result, "regression")
