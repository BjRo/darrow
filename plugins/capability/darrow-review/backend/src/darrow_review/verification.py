"""Closed finding lifecycle and checksum-bound repair history."""

from __future__ import annotations

from pathlib import Path

from .common import ReviewError, blob_hash, read_text, require
from .records import Record, Records, check_records, state


def originals(result: Records) -> dict[str, Record]:
    findings = result.keyed("original_findings", label="original finding key")
    result.keyed("original_findings", "order", "original finding order")
    for key, row in findings.items():
        expected = f"{row['axis']}:{row['order']}:{result.value('original_target')}"
        result.check(
            key == expected,
            f"original finding key must be derived as axis:order:original_target: {expected}",
        )
    return findings


def attempts(result: Records, findings: dict[str, Record]) -> dict[str, Record]:
    actions = result.keyed("attempts", label="attempt finding key")
    for key, row in actions.items():
        result.check(
            key in findings, f"attempt references an unknown original finding: {key}"
        )
        state(result, row["status"], row["progress"], "attempt")
    for key, finding in findings.items():
        result.check(
            finding["disposition"] != "blocking"
            or key in actions
            or result.strings("evidence_gaps"),
            f"every blocking original finding requires one attempt: {key}",
        )
    return actions


def regressions(
    result: Records, findings: dict[str, Record], actions: dict[str, Record]
) -> None:
    carried = result.keyed("regressions", label="regression key")
    result.keyed("regressions", "order", "regression order")
    for key, row in carried.items():
        cause = row["caused_by"]
        result.check(
            cause in findings,
            f"regression caused_by references an unknown original finding: {cause}",
        )
        result.check(
            cause in actions,
            f"regression caused_by references an unattempted original finding: {cause}",
        )
        result.check(
            cause in findings and row["axis"] == findings[cause]["axis"],
            f"regression axis must match its causing original finding: {key}",
        )
        expected = f"regression:{row['order']}:{cause}"
        result.check(
            key == expected,
            f"regression key must be derived as regression:order:caused_by: {expected}",
        )
        state(result, row["status"], row["progress"], "regression")


def outcome(
    result: Records, findings: dict[str, Record], actions: dict[str, Record]
) -> str:
    states = [
        (row["status"], row["progress"])
        for key, row in actions.items()
        if key in findings and findings[key]["disposition"] == "blocking"
    ]
    regression_states = [
        (row["status"], row["progress"]) for row in result.items("regressions")
    ]
    states += regression_states
    checks = [row["status"] for row in result.items("checks")]
    result.check(
        "fail" not in checks
        or any(status != "resolved" for status, _ in regression_states),
        "a failing deterministic check requires an unresolved or blocked repair-caused regression",
    )
    blocked = (
        bool(result.strings("evidence_gaps"))
        or "blocked" in checks
        or any(s == "blocked" for s, _ in states)
    )
    history = set(result.strings("history_targets"))
    history.update((result.value("prior_target"), result.value("original_target")))
    stagnant = (
        result.value("current_target") in history
        or ("unresolved", "unchanged") in states
    )
    return derive_outcome(blocked, stagnant, any(s == "unresolved" for s, _ in states))


def derive_outcome(blocked: bool, stagnant: bool, active: bool) -> str:
    if blocked:
        return "blocked"
    if stagnant:
        return "no_progress"
    return "continue" if active else "clear"


def validate_verification(text: str, path: str = "-", depth: int = 0) -> Records:
    result = Records(text)
    result.shape("darrow-review-verification-v3")
    check_records(result)
    result.unique_strings("history_targets", "history target")
    result.check(
        result.items("original_findings") or result.strings("evidence_gaps"),
        "at least one original_finding or evidence_gap is required",
    )
    findings = originals(result)
    actions = attempts(result, findings)
    regressions(result, findings, actions)
    expected = outcome(result, findings, actions)
    result.check(
        result.value("outcome") == expected,
        f"outcome must be {expected} from target, finding, regression, and check states",
    )
    result.finish()
    validate_previous(result, path, depth)
    return result


def validate_previous(result: Records, path: str, depth: int) -> None:
    previous_record = result.object("previous_verification")
    checksum, previous = previous_record["checksum"], previous_record["path"]
    if "none" in (checksum, previous):
        first_verification(result, checksum, previous)
        return
    require(
        Path(previous).is_absolute(), "previous verification path must be absolute", 4
    )
    require(
        Path(previous).resolve() != Path(path).resolve(),
        "previous verification must not reference the current artifact",
        4,
    )
    require(depth < 50, "previous verification chain is cyclic or too deep", 4)
    try:
        raw = Path(previous).read_bytes()
        require(
            blob_hash(raw, sha256=len(checksum) == 64) == checksum,
            "previous verification checksum does not match its artifact",
            4,
        )
        prior = validate_verification(read_text(previous), previous, depth + 1)
    except (ReviewError, OSError) as exc:
        raise ReviewError(
            f"previous verification artifact is invalid: {exc}", 4
        ) from exc
    require(
        prior.value("current_target") == result.value("prior_target"),
        "previous verification target does not match prior_target",
        4,
    )
    preserve_history(result, prior)
    result.finish()


def first_verification(result: Records, checksum: str, previous: str) -> None:
    require(
        checksum == previous == "none",
        "previous_verification must use none for both checksum and path",
        4,
    )
    require(
        result.value("prior_target") == result.value("original_target"),
        "first verification prior_target must equal original_target",
        4,
    )
    require(
        not result.strings("history_targets"),
        "first verification must not contain repair target history",
        4,
    )


def preserve_history(result: Records, prior: Records) -> None:
    result.check(
        result.value("original_target") == prior.value("original_target"),
        "original_target changed across verification artifacts",
    )
    old = prior.keyed("original_findings")
    current = result.keyed("original_findings")
    for key, row in current.items():
        result.check(
            key in old, f"new original finding appeared in later verification: {key}"
        )
        result.check(
            old.get(key) == row,
            f"original finding changed across verification artifacts: {key}",
        )
    for key in old:
        result.check(
            key in current,
            f"original finding is missing from current verification: {key}",
        )
    preserve_regressions(result, prior)
    preserve_targets(result, prior)


def immutable_regression(row: Record) -> Record:
    return {
        key: value
        for key, value in row.items()
        if key not in ("status", "progress", "evidence")
    }


def preserve_regressions(result: Records, prior: Records) -> None:
    current = result.keyed("regressions")
    for key, row in prior.keyed("regressions").items():
        result.check(
            key in current,
            f"prior regression is missing from current verification: {key}",
        )
        if key in current:
            result.check(
                immutable_regression(row) == immutable_regression(current[key]),
                f"prior regression immutable fields changed: {key}",
            )


def preserve_targets(result: Records, prior: Records) -> None:
    expected = set(prior.strings("history_targets")) | {prior.value("prior_target")}
    current = set(result.strings("history_targets"))
    for target in expected - current:
        result.check(
            False, f"prior repair target is missing from target history: {target}"
        )
    for target in current - expected:
        result.check(False, f"unbound target appeared in target history: {target}")
