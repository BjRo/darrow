from __future__ import annotations

from pathlib import Path

import pytest

from darrow_review import cli, result
from darrow_review.common import ReviewError, serialize
from darrow_review.records import validate_result
from darrow_review.verification import validate_verification
from fixtures import change, result_rows, verification_rows, write


def original_rows() -> list[list[str]]:
    records = result_rows()
    records.insert(
        8,
        ["finding", "standards", "low", "advisory", "file.txt:2", "rule", r"C:\path"],
    )
    return records


def followup_rows() -> list[list[str]]:
    records = [row for row in verification_rows() if row[0] != "original_finding"]
    records = change(
        records, "attempt", "spec:2:original", "resolved", "resolved", "fixed"
    )
    return [
        *records,
        *result.original_findings(validate_result(serialize(original_rows()))),
    ]


def test_original_order_and_mixed_guidance(tmp_path: Path) -> None:
    original = write(tmp_path / "original.tsv", original_rows())
    current = write(tmp_path / "current.tsv", followup_rows())
    expected = (
        "original_finding\tstandards:1:original\tstandards\t1\tlow\tadvisory\tfile.txt:2\trule\tC:\\path\n"
        "original_finding\tspec:2:original\tspec\t2\thigh\tblocking\tfile.txt:1\trequest\twrong value\trestore value\ttest value\n"
    )
    assert cli.result_command(["original-findings", original]) == expected
    assert "preserved" in cli.result_command(["validate-original", original, current])


@pytest.mark.parametrize("field", [4, 5, 6, 7, 8, 9, 10])
def test_immutable_original_fields(tmp_path: Path, field: int) -> None:
    original = write(tmp_path / "original.tsv", original_rows())
    records = followup_rows()
    finding = next(
        row for row in records if row[:2] == ["original_finding", "spec:2:original"]
    )
    replacements = {4: "medium", 5: "advisory"}
    finding[field] = replacements.get(field, "changed")
    # A valid record can still misrepresent its authoritative original.
    validate_verification(serialize(records))
    changed = write(tmp_path / "changed.tsv", records)
    with pytest.raises(ReviewError, match="complete ordered finding set"):
        result.validate_original(original, changed)


@pytest.mark.parametrize("mutation", ["omitted", "renumbered", "target"])
def test_original_membership_and_target(tmp_path: Path, mutation: str) -> None:
    original = write(tmp_path / "original.tsv", original_rows())
    records = mutated_original(mutation)
    validate_verification(serialize(records))
    changed = write(tmp_path / "changed.tsv", records)
    with pytest.raises(ReviewError):
        result.validate_original(original, changed)


def mutated_original(mutation: str) -> list[list[str]]:
    records = followup_rows()
    if mutation == "omitted":
        return [
            row
            for row in records
            if row[:2] != ["original_finding", "standards:1:original"]
        ]
    if mutation == "target":
        return [
            [
                value.replace("original", "wrong") if index else value
                for index, value in enumerate(row)
            ]
            for row in records
        ]
    for row in records:
        renumber(row)
    return records


def renumber(row: list[str]) -> None:
    if row[0] == "original_finding":
        row[3] = str(3 - int(row[3]))
        row[1] = f"{row[2]}:{row[3]}:original"
    if row[0] == "attempt":
        row[1] = "spec:1:original"


@pytest.mark.parametrize("field", [7, 8])
@pytest.mark.parametrize("mutation", ["empty", "missing"])
def test_guidance_is_an_atomic_nonempty_pair(field: int, mutation: str) -> None:
    records = result_rows()
    finding = next(row for row in records if row[0] == "finding")
    if mutation == "empty":
        finding[field] = ""
    else:
        del finding[field]
    with pytest.raises(ReviewError):
        validate_result(serialize(records))


def test_exact_guidance_survives_both_presentations(tmp_path: Path) -> None:
    records = result_rows()
    finding = next(row for row in records if row[0] == "finding")
    finding[7:] = [
        r"Restore <3>; preserve C:\path and avoid [new API](url) changes",
        "Calling retry must make exactly 3 attempts",
    ]
    original = write(tmp_path / "original.tsv", records)
    followup = [row for row in verification_rows() if row[0] != "original_finding"]
    followup += result.original_findings(validate_result(serialize(records)))
    current = write(tmp_path / "current.tsv", followup)
    comprehensive = cli.report_command(["render", original])
    verification = cli.report_command(["render-verification", current])
    attempted, closed = verification.split("## Closed original finding set", 1)
    for section in (comprehensive, attempted, closed):
        assert (
            "**Repair guidance (advisory):** Restore &lt;3&gt;; preserve C:&#92;path and avoid &#91;new API&#93;(url) changes"
            in section
        )
        assert (
            "**Resolution evidence:** Calling retry must make exactly 3 attempts"
            in section
        )
