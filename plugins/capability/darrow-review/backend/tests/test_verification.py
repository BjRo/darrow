from __future__ import annotations

from pathlib import Path

import pytest

from darrow_review import report
from darrow_review.common import ReviewError, blob_hash, serialize
from darrow_review.verification import validate_verification
from fixtures import change, verification_rows, write


@pytest.mark.parametrize(
    ("status", "progress", "target", "outcome"),
    [
        ("resolved", "resolved", "new", "clear"),
        ("unresolved", "progressing", "new", "continue"),
        ("unresolved", "unchanged", "new", "no_progress"),
        ("blocked", "unavailable", "new", "blocked"),
        ("resolved", "resolved", "original", "no_progress"),
    ],
)
def test_outcome_precedence(
    status: str, progress: str, target: str, outcome: str
) -> None:
    records = change(
        verification_rows(), "attempt", "spec:1:original", status, progress, "observed"
    )
    records = change(change(records, "current_target", target), "outcome", outcome)
    assert validate_verification(serialize(records)).value("outcome") == outcome
    with pytest.raises(ReviewError, match="outcome must be"):
        validate_verification(
            serialize(
                change(records, "outcome", "wrong" if outcome == "clear" else "clear")
            )
        )


def regression() -> list[str]:
    return [
        "regression",
        "regression:1:spec:1:original",
        "spec:1:original",
        "1",
        "spec",
        "high",
        "unresolved",
        "progressing",
        "f:2",
        "request",
        "new failure",
        "repair it",
        "regression test",
    ]


def first_round() -> list[list[str]]:
    return change([*verification_rows(), regression()], "outcome", "continue")


def later_round(tmp_path: Path) -> tuple[list[list[str]], str]:
    previous = Path(write(tmp_path / "previous.tsv", first_round()))
    later = change(
        first_round(),
        "previous_verification",
        blob_hash(previous.read_bytes()),
        str(previous),
    )
    later = change(change(later, "prior_target", "repaired"), "current_target", "next")
    later.append(["history_target", "original"])
    return later, str(previous)


def test_later_history_and_rendering(tmp_path: Path) -> None:
    records, _ = later_round(tmp_path)
    parsed = validate_verification(serialize(records))
    rendered = report.verification(parsed)
    assert "Earlier targets" in rendered and "Repair-caused regressions" in rendered
    assert "repair it" in rendered and "regression test" in rendered
    for kind in ("history_target", "regression", "original_finding"):
        with pytest.raises(ReviewError):
            validate_verification(serialize([row for row in records if row[0] != kind]))
    records.append(["history_target", "unbound"])
    with pytest.raises(ReviewError, match="unbound target"):
        validate_verification(serialize(records))


@pytest.mark.parametrize("field", [2, 3, 4, 5, 8, 9, 11, 12])
def test_regression_immutable_fields(tmp_path: Path, field: int) -> None:
    records, _ = later_round(tmp_path)
    for row in records:
        if row[0] == "regression":
            row[field] += "changed"
    with pytest.raises(ReviewError):
        validate_verification(serialize(records))


def test_closed_keys_and_checks() -> None:
    records = verification_rows()
    variants = [
        [*records, records[6]],
        [*records, records[5]],
        change(records, "attempt", "unknown", "resolved", "resolved", "fixed"),
        change(records, "check", "test", "applicable", "fail", "failed"),
        [row for row in records if row[0] != "attempt"],
        [*first_round(), regression()],
        change(
            records,
            "original_finding",
            "spec:2:original",
            "spec",
            "1",
            "high",
            "blocking",
            "f:1",
            "request",
            "failure",
        ),
    ]
    for variant in variants:
        with pytest.raises(ReviewError):
            validate_verification(serialize(variant))
    failed = change(first_round(), "check", "test", "applicable", "fail", "failed")
    validate_verification(serialize(failed))
    blocked = change(
        change(records, "check", "test", "applicable", "blocked", "unavailable"),
        "outcome",
        "blocked",
    )
    validate_verification(serialize(blocked))


def test_advisory_and_evidence_gap() -> None:
    records = verification_rows()
    records[5][5] = "advisory"
    records = change(
        records, "attempt", "spec:1:original", "unresolved", "unchanged", "advisory"
    )
    validate_verification(serialize(records))
    records = [
        row
        for row in verification_rows()
        if row[0] not in ("original_finding", "attempt")
    ]
    records.append(["evidence_gap", "original unavailable"])
    records = change(records, "outcome", "blocked")
    parsed = validate_verification(serialize(records))
    assert "No attempted findings" in report.verification(parsed)
    assert "original unavailable" in report.verification(parsed)
    with pytest.raises(ReviewError):
        validate_verification(
            serialize([row for row in records if row[0] != "evidence_gap"])
        )


@pytest.mark.parametrize(
    ("kind", "fields"),
    [
        ("previous_verification", ["none", "somewhere"]),
        ("previous_verification", ["hash", "relative"]),
        ("prior_target", ["not-original"]),
    ],
)
def test_invalid_first_binding(kind: str, fields: list[str]) -> None:
    with pytest.raises(ReviewError):
        validate_verification(serialize(change(verification_rows(), kind, *fields)))
    with pytest.raises(ReviewError):
        validate_verification(
            serialize([*verification_rows(), ["history_target", "unexpected"]])
        )


def test_previous_artifact_integrity(tmp_path: Path) -> None:
    records, previous = later_round(tmp_path)
    with pytest.raises(ReviewError, match="current artifact"):
        validate_verification(serialize(records), previous)
    with pytest.raises(ReviewError, match="too deep"):
        validate_verification(serialize(records), depth=50)
    with pytest.raises(ReviewError, match="does not match prior_target"):
        validate_verification(serialize(change(records, "prior_target", "different")))
    Path(previous).write_text("tampered", encoding="utf-8")
    with pytest.raises(ReviewError, match="checksum"):
        validate_verification(serialize(records))
    Path(previous).unlink()
    with pytest.raises(ReviewError, match="invalid"):
        validate_verification(serialize(records))


def test_original_immutability_and_history_duplicates(tmp_path: Path) -> None:
    records, _ = later_round(tmp_path)
    records[5][8] = "rewritten evidence"
    with pytest.raises(ReviewError, match="original finding changed"):
        validate_verification(serialize(records))
    records, _ = later_round(tmp_path)
    with pytest.raises(ReviewError, match="duplicate history target"):
        validate_verification(serialize([*records, ["history_target", "original"]]))
    records.append(
        [
            "original_finding",
            "spec:2:original",
            "spec",
            "2",
            "low",
            "advisory",
            "f:3",
            "request",
            "unrelated",
        ]
    )
    with pytest.raises(ReviewError, match="new original finding"):
        validate_verification(serialize(records))
