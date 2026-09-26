from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from darrow_review import report
from darrow_review.common import ReviewError, blob_hash, serialize
from darrow_review.verification import validate_verification
from fixtures import verification_record, write


def changed(value: dict[str, Any], **fields: Any) -> dict[str, Any]:
    return deepcopy(value) | fields


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
    data = changed(verification_record(), current_target=target, outcome=outcome)
    data["attempts"][0].update(status=status, progress=progress, evidence="observed")
    assert validate_verification(serialize(data)).value("outcome") == outcome
    data["outcome"] = "wrong" if outcome == "clear" else "clear"
    with pytest.raises(ReviewError, match="outcome"):
        validate_verification(serialize(data))


def regression() -> dict[str, str]:
    return {
        "key": "regression:1:spec:1:original",
        "caused_by": "spec:1:original",
        "order": "1",
        "axis": "spec",
        "severity": "high",
        "status": "unresolved",
        "progress": "progressing",
        "location": "f:2",
        "source": "request",
        "evidence": "new failure",
        "repair_guidance": "repair it",
        "resolution_evidence": "regression test",
    }


def first_round() -> dict[str, Any]:
    data = verification_record()
    data["regressions"] = [regression()]
    data["outcome"] = "continue"
    return data


def later_round(tmp_path: Path) -> tuple[dict[str, Any], str]:
    previous = Path(write(tmp_path / "previous.json", first_round()))
    data = changed(
        first_round(),
        previous_verification={
            "checksum": blob_hash(previous.read_bytes()),
            "path": str(previous),
        },
        prior_target="repaired",
        current_target="next",
        history_targets=["original"],
    )
    return data, str(previous)


def test_later_history_and_rendering(tmp_path: Path) -> None:
    data, _ = later_round(tmp_path)
    rendered = report.verification(validate_verification(serialize(data)))
    assert "Earlier targets" in rendered and "Repair-caused regressions" in rendered
    assert "repair it" in rendered and "regression test" in rendered
    for field in ("history_targets", "regressions", "original_findings"):
        variant = deepcopy(data)
        del variant[field]
        with pytest.raises(ReviewError):
            validate_verification(serialize(variant))
    data["history_targets"].append("unbound")
    with pytest.raises(ReviewError, match="unbound target"):
        validate_verification(serialize(data))


@pytest.mark.parametrize(
    "field",
    [
        "caused_by",
        "order",
        "axis",
        "severity",
        "location",
        "source",
        "repair_guidance",
        "resolution_evidence",
    ],
)
def test_regression_immutable_fields(tmp_path: Path, field: str) -> None:
    data, _ = later_round(tmp_path)
    data["regressions"][0][field] += "changed"
    with pytest.raises(ReviewError):
        validate_verification(serialize(data))


def test_closed_keys_and_checks() -> None:
    base = verification_record()
    variants: list[dict[str, Any]] = []
    for field in ("attempts", "original_findings"):
        value = deepcopy(base)
        value[field].append(deepcopy(value[field][0]))
        variants.append(value)
    unknown = deepcopy(base)
    unknown["attempts"][0]["key"] = "unknown"
    variants.append(unknown)
    failed_check = deepcopy(base)
    failed_check["checks"][0].update(status="fail", evidence="failed")
    variants.append(failed_check)
    missing_attempt = deepcopy(base)
    del missing_attempt["attempts"]
    variants.append(missing_attempt)
    duplicate_regression = first_round()
    duplicate_regression["regressions"].append(regression())
    variants.append(duplicate_regression)
    wrong_finding = deepcopy(base)
    wrong_finding["original_findings"][0].update(key="spec:2:original")
    variants.append(wrong_finding)
    for value in variants:
        with pytest.raises(ReviewError):
            validate_verification(serialize(value))
    failed = first_round()
    failed["checks"][0].update(status="fail", evidence="failed")
    validate_verification(serialize(failed))
    blocked = deepcopy(base)
    blocked["checks"][0].update(status="blocked", evidence="unavailable")
    blocked["outcome"] = "blocked"
    validate_verification(serialize(blocked))


def test_advisory_and_evidence_gap() -> None:
    data = verification_record()
    data["original_findings"][0]["disposition"] = "advisory"
    data["attempts"][0].update(
        status="unresolved", progress="unchanged", evidence="advisory"
    )
    validate_verification(serialize(data))
    data = verification_record()
    del data["original_findings"]
    del data["attempts"]
    data["evidence_gaps"] = ["original unavailable"]
    data["outcome"] = "blocked"
    rendered = report.verification(validate_verification(serialize(data)))
    assert "No attempted findings" in rendered
    assert "original unavailable" in rendered
    del data["evidence_gaps"]
    with pytest.raises(ReviewError):
        validate_verification(serialize(data))


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("previous_verification", {"checksum": "none", "path": "somewhere"}),
        ("previous_verification", {"checksum": "hash", "path": "relative"}),
        ("prior_target", "not-original"),
    ],
)
def test_invalid_first_binding(field: str, value: object) -> None:
    with pytest.raises(ReviewError):
        validate_verification(
            serialize(changed(verification_record(), **{field: value}))
        )
    with pytest.raises(ReviewError):
        validate_verification(
            serialize(changed(verification_record(), history_targets=["unexpected"]))
        )


def test_previous_artifact_integrity(tmp_path: Path) -> None:
    data, previous = later_round(tmp_path)
    with pytest.raises(ReviewError, match="current artifact"):
        validate_verification(serialize(data), previous)
    with pytest.raises(ReviewError, match="too deep"):
        validate_verification(serialize(data), depth=50)
    with pytest.raises(ReviewError, match="does not match prior_target"):
        validate_verification(serialize(changed(data, prior_target="different")))
    Path(previous).write_text("tampered", encoding="utf-8")
    with pytest.raises(ReviewError, match="checksum"):
        validate_verification(serialize(data))
    Path(previous).unlink()
    with pytest.raises(ReviewError, match="invalid"):
        validate_verification(serialize(data))


def test_original_immutability_and_history_duplicates(tmp_path: Path) -> None:
    data, _ = later_round(tmp_path)
    data["original_findings"][0]["evidence"] = "rewritten evidence"
    with pytest.raises(ReviewError, match="original finding changed"):
        validate_verification(serialize(data))
    data, _ = later_round(tmp_path)
    data["history_targets"].append("original")
    with pytest.raises(ReviewError, match="duplicate history target"):
        validate_verification(serialize(data))
    data, _ = later_round(tmp_path)
    data["original_findings"].append(
        {
            "key": "spec:2:original",
            "axis": "spec",
            "order": "2",
            "severity": "low",
            "disposition": "advisory",
            "location": "f:3",
            "source": "request",
            "evidence": "unrelated",
        }
    )
    with pytest.raises(ReviewError, match="new original finding"):
        validate_verification(serialize(data))
