from __future__ import annotations

from pathlib import Path
from typing import cast

import pytest

from darrow_review import cli, result
from darrow_review.common import ReviewError, serialize
from darrow_review.records import Record, validate_result
from darrow_review.verification import validate_verification
from fixtures import result_record, verification_record


def original_doc() -> dict[str, object]:
    data = result_record()
    findings = cast(list[Record], data["findings"])
    findings.insert(
        0,
        {
            "axis": "standards",
            "severity": "low",
            "disposition": "advisory",
            "location": "file.txt:2",
            "source": "rule",
            "evidence": r"C:\path",
        },
    )
    return data


def followup_doc() -> dict[str, object]:
    data = verification_record()
    data["original_findings"] = result.original_findings(
        validate_result(serialize(original_doc()))
    )
    data["attempts"] = [
        {
            "key": "spec:2:original",
            "status": "resolved",
            "progress": "resolved",
            "evidence": "fixed",
        }
    ]
    return data


def write_json(path: Path, value: dict[str, object]) -> str:
    path.write_text(serialize(value), encoding="utf-8")
    return str(path)


def test_original_order_and_mixed_guidance(tmp_path: Path) -> None:
    original = write_json(tmp_path / "original.json", original_doc())
    current = write_json(tmp_path / "current.json", followup_doc())
    expected = serialize(
        {
            "original_findings": result.original_findings(
                validate_result(serialize(original_doc()))
            )
        }
    )
    assert cli.result_command(["original-findings", original]) == expected
    assert "preserved" in cli.result_command(["validate-original", original, current])


@pytest.mark.parametrize(
    "field",
    [
        "severity",
        "disposition",
        "location",
        "source",
        "evidence",
        "repair_guidance",
        "resolution_evidence",
    ],
)
def test_immutable_original_fields(tmp_path: Path, field: str) -> None:
    original = write_json(tmp_path / "original.json", original_doc())
    data = followup_doc()
    finding = next(
        item
        for item in cast(list[Record], data["original_findings"])
        if item["key"] == "spec:2:original"
    )
    finding[field] = {
        "severity": "medium",
        "disposition": "advisory",
    }.get(field, "changed")
    validate_verification(serialize(data))
    changed = write_json(tmp_path / "changed.json", data)
    with pytest.raises(ReviewError, match="complete ordered finding set"):
        result.validate_original(original, changed)


@pytest.mark.parametrize("mutation", ["omitted", "renumbered", "target"])
def test_original_membership_and_target(tmp_path: Path, mutation: str) -> None:
    original = write_json(tmp_path / "original.json", original_doc())
    data = followup_doc()
    findings = cast(list[Record], data["original_findings"])
    if mutation == "omitted":
        data["original_findings"] = [
            item for item in findings if item["key"] != "standards:1:original"
        ]
    elif mutation == "renumbered":
        for item in findings:
            item["order"] = str(3 - int(item["order"]))
            item["key"] = f"{item['axis']}:{item['order']}:original"
        cast(list[Record], data["attempts"])[0]["key"] = "spec:1:original"
    else:
        data["original_target"] = data["prior_target"] = "wrong"
        for item in findings:
            item["key"] = item["key"].replace("original", "wrong")
        cast(list[Record], data["attempts"])[0]["key"] = "spec:2:wrong"
    validate_verification(serialize(data))
    changed = write_json(tmp_path / "changed.json", data)
    with pytest.raises(ReviewError):
        result.validate_original(original, changed)


@pytest.mark.parametrize("field", ["repair_guidance", "resolution_evidence"])
@pytest.mark.parametrize("mutation", ["empty", "missing"])
def test_guidance_is_an_atomic_nonempty_pair(field: str, mutation: str) -> None:
    data = result_record()
    finding = cast(list[Record], data["findings"])[0]
    if mutation == "empty":
        finding[field] = ""
    else:
        del finding[field]
    with pytest.raises(ReviewError):
        validate_result(serialize(data))


def test_exact_guidance_survives_both_presentations(tmp_path: Path) -> None:
    data = result_record()
    finding = cast(list[Record], data["findings"])[0]
    finding["repair_guidance"] = (
        r"Restore <3>; preserve C:\path and avoid [new API](url) changes"
    )
    finding["resolution_evidence"] = "Calling retry must make exactly 3 attempts"
    original = write_json(tmp_path / "original.json", data)
    followup = verification_record()
    followup["original_findings"] = result.original_findings(
        validate_result(serialize(data))
    )
    current = write_json(tmp_path / "current.json", followup)
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
