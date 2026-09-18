"""Closed finding lifecycle and checksum-bound repair history."""

from __future__ import annotations

from pathlib import Path

from .common import ReviewError, blob_hash, read_text, require
from .records import VERIFICATION_SHAPES, Records, check_records, state


def originals(result: Records) -> dict[str, list[str]]:
    findings = result.keyed("original_finding", label="original finding key")
    result.keyed("original_finding", 3, "original finding order")
    for key, row in findings.items():
        expected = f"{row[2]}:{row[3]}:{result.value('original_target')}"
        result.check(
            key == expected,
            f"original finding key must be derived as axis:order:original_target: {expected}",
        )
    return findings


def attempts(result: Records, findings: dict[str, list[str]]) -> dict[str, list[str]]:
    actions = result.keyed("attempt", label="attempt finding key")
    for key, row in actions.items():
        result.check(
            key in findings, f"attempt references an unknown original finding: {key}"
        )
        state(result, row[2], row[3], "attempt")
    for key, finding in findings.items():
        result.check(
            finding[5] != "blocking" or key in actions or result.get("evidence_gap"),
            f"every blocking original finding requires one attempt: {key}",
        )
    return actions


def regressions(
    result: Records, findings: dict[str, list[str]], actions: dict[str, list[str]]
) -> None:
    carried = result.keyed("regression", label="regression key")
    result.keyed("regression", 3, "regression order")
    for key, row in carried.items():
        cause = row[2]
        result.check(
            cause in findings,
            f"regression caused_by references an unknown original finding: {cause}",
        )
        result.check(
            cause in actions,
            f"regression caused_by references an unattempted original finding: {cause}",
        )
        result.check(
            cause in findings and row[4] == findings[cause][2],
            f"regression axis must match its causing original finding: {key}",
        )
        expected = f"regression:{row[3]}:{cause}"
        result.check(
            key == expected,
            f"regression key must be derived as regression:order:caused_by: {expected}",
        )
        state(result, row[6], row[7], "regression")


def outcome(
    result: Records, findings: dict[str, list[str]], actions: dict[str, list[str]]
) -> str:
    states = [
        (row[2], row[3])
        for key, row in actions.items()
        if key in findings and findings[key][5] == "blocking"
    ]
    regression_states = [(row[6], row[7]) for row in result.get("regression")]
    states += regression_states
    checks = [row[3] for row in result.get("check")]
    result.check(
        "fail" not in checks
        or any(status != "resolved" for status, _ in regression_states),
        "a failing deterministic check requires an unresolved or blocked repair-caused regression",
    )
    blocked = (
        bool(result.get("evidence_gap"))
        or "blocked" in checks
        or any(s == "blocked" for s, _ in states)
    )
    history = {row[1] for row in result.get("history_target")}
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
    result.shape("darrow-review-verification-v1", VERIFICATION_SHAPES, "verification ")
    result.exactly(
        "original_target",
        "prior_target",
        "current_target",
        "previous_verification",
        "outcome",
        "next_action",
    )
    check_records(result)
    result.keyed("history_target", label="history target")
    result.check(
        result.get("original_finding") or result.get("evidence_gap"),
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
    checksum, previous = (
        result.value("previous_verification"),
        result.value("previous_verification", 2),
    )
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
        not result.get("history_target"),
        "first verification must not contain repair target history",
        4,
    )


def preserve_history(result: Records, prior: Records) -> None:
    result.check(
        result.value("original_target") == prior.value("original_target"),
        "original_target changed across verification artifacts",
    )
    old = prior.keyed("original_finding")
    current = result.keyed("original_finding")
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


def immutable_regression(row: list[str]) -> list[str]:
    return row[2:6] + row[8:10] + row[11:]


def preserve_regressions(result: Records, prior: Records) -> None:
    current = result.keyed("regression")
    for key, row in prior.keyed("regression").items():
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
    expected = {row[1] for row in prior.get("history_target")} | {
        prior.value("prior_target")
    }
    current = {row[1] for row in result.get("history_target")}
    for target in expected - current:
        result.check(
            False, f"prior repair target is missing from target history: {target}"
        )
    for target in current - expected:
        result.check(False, f"unbound target appeared in target history: {target}")
