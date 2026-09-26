from __future__ import annotations

import io
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli, report, result
from darrow_review.common import ReviewError, rows, serialize
from darrow_review.records import (
    Records,
    validate_axis,
    validate_fix_axis,
    validate_result,
)
from darrow_review.verification import validate_verification
from fixtures import change, result_rows, verification_rows, write


def test_original_report_and_handoff(tmp_path: Path) -> None:
    original = write(tmp_path / "original.json", result_rows())
    verification = write(tmp_path / "verification.json", verification_rows())
    assert "preserved" in cli.result_command(
        ["validate-original", original, verification]
    )
    assert Records(cli.result_command(["original-findings", original])).get(
        "original_finding"
    )[0][:2] == ["original_finding", "spec:1:original"]
    assert "valid:" in cli.result_command(["validate", original])
    assert "valid:" in cli.result_command(["validate-verification", verification])
    text = cli.report_command(["render", original])
    assert "# Code review — FAIL" in text
    assert "Repair guidance (advisory)" in text
    assert (
        text.index("## Next action")
        < text.index("## Findings")
        < text.index("## Scope")
        < text.index("## Sources")
    )
    rendered = cli.report_command(["render-verification", verification])
    assert "# Repair verification — CLEAR" in rendered
    assert "Original evidence" in rendered and "Closed original finding set" in rendered
    assert rendered.index("## Next action") < rendered.index("## Attempted findings")
    changed = write(
        tmp_path / "changed.json",
        change(
            verification_rows(),
            "original_finding",
            "spec:1:original",
            "spec",
            "1",
            "high",
            "blocking",
            "file.txt:1",
            "request",
            "rewritten",
            "restore value",
            "test value",
        ),
    )
    with pytest.raises(ReviewError, match="complete ordered finding set"):
        result.validate_original(original, changed)


@pytest.mark.parametrize("row_index", range(len(result_rows())))
def test_required_result_records_reject_extra_fields(row_index: int) -> None:
    records = result_rows()
    records[row_index].append("unexpected")
    with pytest.raises(ReviewError):
        validate_result(serialize(records))


@pytest.mark.parametrize("row_index", range(len(verification_rows())))
def test_verification_records_reject_missing_fields(row_index: int) -> None:
    records = verification_rows()
    records[row_index] = records[row_index][:1]
    with pytest.raises(ReviewError):
        validate_verification(serialize(records))


@pytest.mark.parametrize(
    ("kind", "fields"),
    [
        ("format", ["other"]),
        ("base", [""]),
        ("changed_file", ["relative"]),
        ("standards", ["unknown"]),
        ("spec", ["not_available"]),
        ("spec_source", ["not_available"]),
        ("verdict", ["pass"]),
        ("finding", ["spec", "high", "blocking", "f:1", "heuristic:guess", "bad"]),
        ("check", ["test", "unknown", "pass", "evidence"]),
        ("check", ["test", "not_applicable", "pass", "evidence"]),
        ("check", ["test", "applicable", "unknown", "evidence"]),
    ],
)
def test_invalid_result_records(kind: str, fields: list[str]) -> None:
    with pytest.raises(ReviewError):
        validate_result(serialize(change(result_rows(), kind, *fields)))


def test_unavailable_spec_and_blocked_scope() -> None:
    records = [
        row for row in result_rows() if row[0] not in ("finding", "changed_file")
    ]
    records = change(records, "standards", "blocked")
    records = change(records, "spec", "not_available")
    records = change(records, "spec_source", "not_available")
    records = change(records, "verdict", "blocked")
    records = change(
        records, "check", "none", "not_applicable", "not_applicable", "no check"
    )
    text = report.comprehensive(validate_result(serialize(records)))
    assert "No findings." in text
    with pytest.raises(ReviewError, match="non-blocked result"):
        validate_result(
            serialize(change(change(records, "standards", "pass"), "verdict", "pass"))
        )


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
    text = serialize(
        [
            ["format", "darrow-review-axis-v2"],
            ["axis", "spec"],
            ["status", status],
            ["source", "request"],
            ["finding", "high", disposition, "f:1", "request", "evidence"],
        ]
    )
    if valid:
        assert validate_axis(text, "spec").value("status") == status
    else:
        with pytest.raises(ReviewError):
            validate_axis(text, "spec")


def test_fix_axis_closed_membership(tmp_path: Path) -> None:
    records = [
        ["format", "darrow-review-fix-axis-v2"],
        ["axis", "spec"],
        ["original", "key"],
        ["prior_regression", "prior", "key"],
        ["attempt", "key", "resolved", "resolved", "fixed"],
        ["regression_attempt", "prior", "unresolved", "progressing", "improved"],
        [
            "regression",
            "key",
            "high",
            "f:1",
            "request",
            "new failure",
            "repair",
            "test",
        ],
    ]
    path = write(tmp_path / "axis.json", records)
    assert "(spec)" in cli.result_command(["validate-fix-axis", "spec", path])
    for kind in ("original", "attempt", "prior_regression", "regression_attempt"):
        with pytest.raises(ReviewError):
            validate_fix_axis(
                serialize([row for row in records if row[0] != kind]), "spec"
            )
    with pytest.raises(ReviewError, match="axis does not match"):
        validate_fix_axis(serialize(records), "standards")
    for status, progress in (
        ("wrong", "wrong"),
        ("resolved", "unavailable"),
        ("blocked", "resolved"),
        ("unresolved", "resolved"),
    ):
        with pytest.raises(ReviewError):
            validate_fix_axis(
                serialize(
                    change(records, "attempt", "key", status, progress, "evidence")
                ),
                "spec",
            )
    gaps = [*records[:4], ["evidence_gap", "missing repair"]]
    validate_fix_axis(serialize(gaps), "spec")
    with pytest.raises(ReviewError, match="action or evidence gap"):
        validate_fix_axis(serialize(records[:2]), "spec")


def test_stdin_and_legacy_guidance(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    records = result_rows()
    records = [row[:7] if row[0] == "finding" else row for row in records]
    monkeypatch.setattr("sys.stdin", io.StringIO(serialize(records)))
    assert "result-v2" in cli.result_command(["validate", "-"])
    original = validate_result(serialize(records))
    assert len(result.original_findings(original)[0]) == 9
    assert "Repair guidance" not in report.comprehensive(original)
    axis = write(
        tmp_path / "axis.json",
        [
            ["format", "darrow-review-axis-v2"],
            ["axis", "spec"],
            ["status", "pass"],
            ["source", "request"],
        ],
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
    records = result_rows()
    records[8][6] = evidence
    parsed = validate_result(serialize(records))
    assert parsed.get("finding")[0][6] == evidence
    assert report.escape(evidence) in report.comprehensive(parsed)


def test_json_records_preserve_multiline_fields() -> None:
    records = result_rows()
    records[8][6] = "first\tcolumn\nsecond line\rthird"
    records[9][1] = "printf 'one\ntwo\tthree'"
    serialized = serialize(records)
    assert rows(serialized) == records
    assert validate_result(serialized).get("finding")[0][6] == records[8][6]
    rendered = report.comprehensive(validate_result(serialized))
    assert "first\\tcolumn\\nsecond line\\rthird" in rendered


@pytest.mark.parametrize("content", ["", "{}", "null", "[[]]", '[["format", 2]]'])
def test_json_records_reject_malformed_shapes(content: str) -> None:
    with pytest.raises(ReviewError):
        rows(content)


def test_unknown_duplicate_and_absent_records() -> None:
    for records in (
        [*result_rows(), ["unexpected", "value"]],
        [*result_rows(), ["base", "extra"]],
        [],
        [row for row in result_rows() if row[0] != "risk"],
    ):
        with pytest.raises(ReviewError):
            validate_result(serialize(records))
