from __future__ import annotations

import io
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli, report, result
from darrow_review.common import ReviewError, document, serialize
from darrow_review.records import (
    Records,
    validate_axis,
    validate_fix_axis,
    validate_result,
)
from darrow_review.verification import validate_verification
from fixtures import result_record, verification_record, write


def axis_record(status: str = "pass", disposition: str = "advisory") -> dict[str, Any]:
    return {
        "format": "darrow-review-axis-v3",
        "axis": "spec",
        "status": status,
        "sources": ["request"],
        "findings": [
            {
                "severity": "high",
                "disposition": disposition,
                "location": "f:1",
                "source": "request",
                "evidence": "evidence",
            }
        ],
    }


def fix_axis_record() -> dict[str, Any]:
    return {
        "format": "darrow-review-fix-axis-v3",
        "axis": "spec",
        "originals": ["key"],
        "prior_regressions": [{"key": "prior", "caused_by": "key"}],
        "attempts": [
            {
                "key": "key",
                "status": "resolved",
                "progress": "resolved",
                "evidence": "fixed",
            }
        ],
        "regression_attempts": [
            {
                "key": "prior",
                "status": "unresolved",
                "progress": "progressing",
                "evidence": "improved",
            }
        ],
        "regressions": [
            {
                "caused_by": "key",
                "severity": "high",
                "location": "f:1",
                "source": "request",
                "evidence": "new failure",
                "repair_guidance": "repair",
                "resolution_evidence": "test",
            }
        ],
    }


def test_result_wire_format_uses_named_objects() -> None:
    data = result_record()
    assert document(serialize(data)) == data
    assert data["format"] == "darrow-review-result-v3"
    assert data["changed_files"] == [str(Path.cwd() / "file.txt")]
    assert data["findings"][0]["repair_guidance"] == "restore value"
    assert data["checks"][0]["status"] == "pass"


def test_original_report_and_handoff(tmp_path: Path) -> None:
    original = write(tmp_path / "original.json", result_record())
    verification = write(tmp_path / "verification.json", verification_record())
    assert "preserved" in cli.result_command(
        ["validate-original", original, verification]
    )
    packet = Records(cli.result_command(["original-findings", original]))
    assert packet.items("original_findings")[0]["key"] == "spec:1:original"
    assert "valid:" in cli.result_command(["validate", original])
    assert "valid:" in cli.result_command(["validate-verification", verification])
    rendered = cli.report_command(["render", original])
    assert "# Code review — FAIL" in rendered
    assert "Repair guidance (advisory)" in rendered
    assert (
        rendered.index("## Next action")
        < rendered.index("## Findings")
        < rendered.index("## Scope")
        < rendered.index("## Sources")
    )
    verified = cli.report_command(["render-verification", verification])
    assert "# Repair verification — CLEAR" in verified
    assert "Original evidence" in verified and "Closed original finding set" in verified
    assert verified.index("## Next action") < verified.index("## Attempted findings")
    changed = verification_record()
    changed["original_findings"][0]["evidence"] = "rewritten"
    path = write(tmp_path / "changed.json", changed)
    with pytest.raises(ReviewError, match="complete ordered finding set"):
        result.validate_original(original, path)


@pytest.mark.parametrize("container", ["root", "finding", "check"])
def test_result_schema_rejects_extra_fields(container: str) -> None:
    data = result_record()
    target = (
        data
        if container == "root"
        else data["findings" if container == "finding" else "checks"][0]
    )
    target["unexpected"] = "value"
    with pytest.raises(ReviewError):
        validate_result(serialize(data))


@pytest.mark.parametrize(
    "field",
    [
        "format",
        "original_target",
        "prior_target",
        "current_target",
        "previous_verification",
        "checks",
        "outcome",
        "next_action",
    ],
)
def test_verification_rejects_missing_required_fields(field: str) -> None:
    data = verification_record()
    del data[field]
    with pytest.raises(ReviewError):
        validate_verification(serialize(data))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("format", "other"),
        ("base", ""),
        ("changed_files", ["relative"]),
        ("standards", "unknown"),
        ("spec", "not_available"),
        ("spec_source", "not_available"),
        ("verdict", "pass"),
    ],
)
def test_invalid_result_fields(field: str, value: object) -> None:
    data = result_record()
    data[field] = value
    with pytest.raises(ReviewError):
        validate_result(serialize(data))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("source", "heuristic:guess"),
        ("applicability", "unknown"),
        ("status", "unknown"),
    ],
)
def test_invalid_nested_result_fields(field: str, value: str) -> None:
    data = result_record()
    target = data["findings"][0] if field == "source" else data["checks"][0]
    target[field] = value
    with pytest.raises(ReviewError):
        validate_result(serialize(data))


def test_unavailable_spec_and_blocked_scope() -> None:
    data = result_record()
    data.update(
        standards="blocked",
        spec="not_available",
        spec_source="not_available",
        verdict="blocked",
        findings=[],
        changed_files=[],
        checks=[
            {
                "command": "none",
                "applicability": "not_applicable",
                "status": "not_applicable",
                "evidence": "no check",
            }
        ],
    )
    rendered = report.comprehensive(validate_result(serialize(data)))
    assert "No findings." in rendered
    data.update(standards="pass", verdict="pass")
    with pytest.raises(ReviewError, match="non-blocked result"):
        validate_result(serialize(data))


@pytest.mark.parametrize(
    ("status", "disposition", "valid"),
    [
        ("pass", "advisory", True),
        ("fail", "blocking", True),
        ("pass", "blocking", False),
        ("fail", "advisory", False),
        ("blocked", "blocking", True),
    ],
)
def test_axis_verdicts(status: str, disposition: str, valid: bool) -> None:
    data = axis_record(status, disposition)
    if valid:
        assert validate_axis(serialize(data), "spec").value("status") == status
    else:
        with pytest.raises(ReviewError):
            validate_axis(serialize(data), "spec")


def test_fix_axis_closed_membership(tmp_path: Path) -> None:
    data = fix_axis_record()
    path = write(tmp_path / "axis.json", data)
    assert "(spec)" in cli.result_command(["validate-fix-axis", "spec", path])
    for field in ("originals", "attempts", "prior_regressions", "regression_attempts"):
        variant = deepcopy(data)
        del variant[field]
        with pytest.raises(ReviewError):
            validate_fix_axis(serialize(variant), "spec")
    with pytest.raises(ReviewError, match="axis does not match"):
        validate_fix_axis(serialize(data), "standards")
    for status, progress in (
        ("wrong", "wrong"),
        ("resolved", "unavailable"),
        ("blocked", "resolved"),
        ("unresolved", "resolved"),
    ):
        variant = deepcopy(data)
        variant["attempts"][0].update(status=status, progress=progress)
        with pytest.raises(ReviewError):
            validate_fix_axis(serialize(variant), "spec")
    gap = {
        "format": data["format"],
        "axis": "spec",
        "originals": ["key"],
        "prior_regressions": data["prior_regressions"],
        "evidence_gaps": ["missing repair"],
    }
    validate_fix_axis(serialize(gap), "spec")
    with pytest.raises(ReviewError, match="action or evidence gap"):
        validate_fix_axis(serialize({"format": data["format"], "axis": "spec"}), "spec")


def test_stdin_and_optional_guidance(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    data = result_record()
    del data["findings"][0]["repair_guidance"]
    del data["findings"][0]["resolution_evidence"]
    monkeypatch.setattr("sys.stdin", io.StringIO(serialize(data)))
    assert "result-v3" in cli.result_command(["validate", "-"])
    original = validate_result(serialize(data))
    assert len(result.original_findings(original)[0]) == 8
    assert "Repair guidance" not in report.comprehensive(original)
    axis = write(
        tmp_path / "axis.json",
        {
            "format": "darrow-review-axis-v3",
            "axis": "spec",
            "status": "pass",
            "sources": ["request"],
        },
    )
    assert "(spec)" in cli.result_command(["validate-axis", "spec", axis])
    with pytest.raises(ReviewError):
        cli.result_command(["validate-axis", "other", axis])


@settings(max_examples=80, derandomize=True)
@given(
    st.text(
        alphabet=st.one_of(
            st.characters(blacklist_categories=("Cs", "Cc", "Zl", "Zp")),
            st.sampled_from(["\t", "\n", "\r"]),
        ),
        min_size=1,
        max_size=100,
    )
)
def test_evidence_round_trip(evidence: str) -> None:
    data = result_record()
    data["findings"][0]["evidence"] = evidence
    parsed = validate_result(serialize(data))
    assert parsed.items("findings")[0]["evidence"] == evidence
    assert report.escape(evidence) in report.comprehensive(parsed)


def test_json_preserves_multiline_fields() -> None:
    data = result_record()
    data["findings"][0]["evidence"] = "first\tcolumn\nsecond line\rthird"
    data["checks"][0]["command"] = "printf 'one\ntwo\tthree'"
    serialized = serialize(data)
    assert document(serialized) == data
    validate_result(serialized)
    rendered = report.comprehensive(validate_result(serialized))
    assert "first\\tcolumn\\nsecond line\\rthird" in rendered


@pytest.mark.parametrize(
    "content",
    [
        "",
        "{}",
        "null",
        "[[]]",
        '[["format", 2]]',
        '{"format":"a","format":"b"}',
        '{"format":["darrow-review-result-v3"]}',
        '{"format":"darrow-review-result-v3","changed_file":"file.txt"}',
        '{"format":"darrow-review-result-v3","changed_files":"file.txt"}',
        '{"format":"darrow-review-result-v3","base":{"_fields":["x"]}}',
        '{"format":"darrow-review-result-v3","checks":[{"command":"x","_extra":["y"]}]}',
        '{"format":"darrow-review-result-v3","checks":["x"]}',
        '{"format":"darrow-review-result-v3","checks":[{"status":"pass"}]}',
        '{"format":"darrow-review-result-v3","checks":[{"command":2}]}',
    ],
)
def test_json_schema_rejects_malformed_shapes(content: str) -> None:
    with pytest.raises(ReviewError):
        validate_result(content)


def test_unknown_duplicate_and_absent_fields() -> None:
    variants = [
        result_record() | {"unexpected": "value"},
        result_record() | {"base": ["base", "extra"]},
        {},
    ]
    missing_risk = result_record()
    del missing_risk["risks"]
    variants.append(missing_risk)
    for data in variants:
        with pytest.raises(ReviewError):
            validate_result(serialize(data))
