"""Strict TSV shapes shared by the four review protocols."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .common import ReviewError, rows

AXIS = "standards|spec"
SEVERITY = "critical|high|medium|low"
DISPOSITION = "blocking|advisory"
STATUS = "pass|fail|blocked"


@dataclass(frozen=True)
class Shape:
    sizes: tuple[int, ...] = (2,)
    patterns: tuple[tuple[int, str, str], ...] = ()
    optional: tuple[int, ...] = ()


SIMPLE = Shape()
CHECK = Shape(
    (5,), ((2, "applicable|not_applicable", "check applicability is invalid"),)
)
FINDING = Shape(
    (7, 9),
    (
        (1, AXIS, "finding axis must be standards or spec"),
        (2, SEVERITY, "finding severity is invalid"),
        (3, DISPOSITION, "finding disposition is invalid"),
    ),
)
ATTEMPT = Shape((5,))
ORIGINAL = Shape(
    (9, 11),
    (
        (2, AXIS, "original finding axis is invalid"),
        (3, "[1-9][0-9]*", "original finding order must be a positive integer"),
        (4, SEVERITY, "original finding severity is invalid"),
        (5, DISPOSITION, "original finding disposition is invalid"),
    ),
)
REGRESSION = Shape(
    (11, 13),
    (
        (3, "[1-9][0-9]*", "regression order must be a positive integer"),
        (4, AXIS, "regression axis is invalid"),
        (5, SEVERITY, "regression severity is invalid"),
    ),
)

RESULT_SHAPES = dict.fromkeys(
    (
        "format",
        "base",
        "target",
        "changed_file",
        "standards_source",
        "spec_source",
        "risk",
        "next_action",
    ),
    SIMPLE,
) | {
    "standards": Shape(
        patterns=((1, STATUS, "standards must be pass, fail, or blocked"),)
    ),
    "spec": Shape(
        patterns=(
            (
                1,
                STATUS + "|not_available",
                "spec must be pass, fail, blocked, or not_available",
            ),
        )
    ),
    "verdict": Shape(patterns=((1, STATUS, "verdict must be pass, fail, or blocked"),)),
    "finding": FINDING,
    "check": CHECK,
}
VERIFICATION_SHAPES = dict.fromkeys(
    (
        "format",
        "original_target",
        "prior_target",
        "current_target",
        "history_target",
        "evidence_gap",
        "next_action",
    ),
    SIMPLE,
) | {
    "previous_verification": Shape((3,)),
    "original_finding": ORIGINAL,
    "attempt": ATTEMPT,
    "regression": REGRESSION,
    "check": CHECK,
    "outcome": Shape(
        patterns=(
            (
                1,
                "clear|continue|no_progress|blocked",
                "outcome must be clear, continue, no_progress, or blocked",
            ),
        )
    ),
}
AXIS_SHAPES = {
    "format": SIMPLE,
    "axis": Shape(patterns=((1, AXIS, "axis is invalid"),)),
    "status": Shape(patterns=((1, STATUS, "status is invalid"),)),
    "source": SIMPLE,
    "finding": Shape(
        (6, 8),
        (
            (1, SEVERITY, "finding severity is invalid"),
            (2, DISPOSITION, "finding disposition is invalid"),
        ),
    ),
}
FIX_SHAPES = {
    "format": SIMPLE,
    "axis": AXIS_SHAPES["axis"],
    "original": SIMPLE,
    "prior_regression": Shape((3,)),
    "attempt": ATTEMPT,
    "regression_attempt": ATTEMPT,
    "evidence_gap": SIMPLE,
    "regression": Shape((6, 8), ((2, SEVERITY, "new regression severity is invalid"),)),
}


class Records:
    def __init__(self, text: str) -> None:
        self.rows = rows(text)
        self.by_kind: dict[str, list[list[str]]] = defaultdict(list)
        for row in self.rows:
            self.by_kind[row[0]].append(row)
        self.errors: list[str] = []

    def check(self, condition: object, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def finish(self) -> None:
        if self.errors:
            raise ReviewError("\nreview-result: ".join(self.errors), 4)

    def get(self, kind: str) -> list[list[str]]:
        return self.by_kind.get(kind, [])

    def value(self, kind: str, index: int = 1) -> str:
        records = self.get(kind)
        return records[0][index] if records else ""

    def exactly(self, *kinds: str) -> None:
        for kind in kinds:
            self.check(
                len(self.get(kind)) == 1, f"exactly one {kind} record is required"
            )

    def at_least(self, kind: str, message: str = "") -> None:
        self.check(self.get(kind), message or f"at least one {kind} record is required")

    def keyed(self, kind: str, index: int = 1, label: str = "") -> dict[str, list[str]]:
        result: dict[str, list[str]] = {}
        for row in self.get(kind):
            key = row[index]
            self.check(key not in result, f"duplicate {label or kind + ' key'}: {key}")
            result[key] = row
        return result

    def shape(
        self, format_name: str, shapes: dict[str, Shape], label: str = ""
    ) -> None:
        self.check(
            self.rows and self.rows[0] == ["format", format_name],
            f"first record must be format<TAB>{format_name}",
        )
        for line, row in enumerate(self.rows, 1):
            shape = shapes.get(row[0])
            if shape is None:
                self.check(False, f"unknown {label}record on line {line}: {row[0]}")
            else:
                self.row_shape(row, shape)
        self.finish()  # Indexing in semantic validation requires complete rows.
        self.exactly("format")

    def row_shape(self, row: list[str], shape: Shape) -> None:
        sizes = " or ".join(str(size) for size in shape.sizes)
        self.check(len(row) in shape.sizes, f"{row[0]} record must have {sizes} fields")
        for index, value in enumerate(row[1:], 1):
            self.check(
                value or index in shape.optional,
                f"{row[0]} field {index} must not be empty",
            )
        for index, pattern, message in shape.patterns:
            self.check(index < len(row) and re.fullmatch(pattern, row[index]), message)


def check_records(records: Records) -> None:
    records.at_least(
        "check", "at least one check or explicit not_applicable check is required"
    )
    for row in records.get("check"):
        if row[2] == "applicable":
            records.check(
                row[3] in STATUS.split("|"), "applicable check status is invalid"
            )
        else:
            records.check(
                row[3] == "not_applicable",
                "not_applicable check must have not_applicable status",
            )


def state(records: Records, status: str, progress: str, label: str) -> None:
    allowed = {
        "resolved": ("resolved",),
        "unresolved": ("progressing", "unchanged"),
        "blocked": ("unavailable",),
    }
    records.check(status in allowed, f"{label} status is invalid")
    if status in allowed:
        required = " or ".join(allowed[status])
        records.check(
            progress in allowed[status],
            f"{label} {status} status requires {required} progress",
        )


def blocking_source(records: Records, axis: str, finding: list[str]) -> None:
    if axis == "spec" and finding[2] == "blocking":
        records.check(
            not finding[4].startswith(("none", "not_available", "heuristic:")),
            "blocking Spec finding must cite an originating requirement",
        )


def axis_status(records: Records, status: str, blocking: bool, label: str) -> None:
    records.check(
        status != "pass" or not blocking,
        f"passing {label} cannot contain blocking findings",
    )
    records.check(
        status != "fail" or blocking, f"failing {label} requires a blocking finding"
    )


def validate_axis(text: str, expected: str) -> Records:
    result = Records(text)
    result.shape("darrow-review-axis-v1", AXIS_SHAPES, "axis ")
    result.exactly("axis", "status")
    result.check(result.value("axis") == expected, f"axis does not match {expected}")
    result.at_least("source")
    findings = result.get("finding")
    for finding in findings:
        blocking_source(result, expected, finding)
    axis_status(
        result,
        result.value("status"),
        any(row[2] == "blocking" for row in findings),
        "axis",
    )
    result.finish()
    return result


def validate_result(text: str) -> Records:
    result = Records(text)
    result.shape("darrow-review-result-v1", RESULT_SHAPES)
    result.exactly(
        "base", "target", "standards", "spec", "spec_source", "verdict", "next_action"
    )
    result.at_least("standards_source", "at least one standards_source is required")
    result.at_least("risk")
    check_records(result)
    for row in result.get("changed_file"):
        result.check(
            Path(row[1]).is_absolute(), "changed_file must be an absolute path"
        )
    validate_result_axes(result)
    statuses = [
        result.value("standards"),
        result.value("spec"),
        *[row[3] for row in result.get("check")],
    ]
    expected = (
        "fail" if "fail" in statuses else "blocked" if "blocked" in statuses else "pass"
    )
    result.check(
        result.value("verdict") == expected,
        f"verdict must be {expected} from axis and check statuses",
    )
    result.check(
        result.get("changed_file") or result.value("verdict") == "blocked",
        "a non-blocked result requires at least one changed_file",
    )
    result.finish()
    return result


def validate_result_axes(result: Records) -> None:
    for axis in ("standards", "spec"):
        findings = [row for row in result.get("finding") if row[1] == axis]
        axis_status(
            result,
            result.value(axis),
            any(row[3] == "blocking" for row in findings),
            axis.title() + " axis",
        )
        for row in findings:
            blocking_source(result, axis, ["finding", *row[2:]])
    if result.value("spec") == "not_available":
        result.check(
            result.value("spec_source") == "not_available",
            "not_available Spec axis requires spec_source=not_available",
        )
        result.check(
            not any(row[1] == "spec" for row in result.get("finding")),
            "not_available Spec axis must not contain Spec findings",
        )
    else:
        result.check(
            result.value("spec_source") != "not_available",
            "available Spec axis must identify its source",
        )


def closed_attempts(
    records: Records,
    originals: dict[str, list[str]],
    attempts: dict[str, list[str]],
    *,
    regression: bool = False,
) -> None:
    kind = "regression_attempt" if regression else "attempt"
    subject = "prior regression" if regression else "original finding"
    for key, row in attempts.items():
        records.check(
            key in originals, f"{kind} references an unknown {subject}: {key}"
        )
        state(records, row[2], row[3], kind)
    for key in originals:
        records.check(
            key in attempts or records.get("evidence_gap"),
            f"{subject} is missing its fix-axis attempt: {key}",
        )


def validate_fix_axis(text: str, expected: str) -> Records:
    result = Records(text)
    result.shape("darrow-review-fix-axis-v1", FIX_SHAPES, "fix-axis ")
    result.exactly("axis")
    result.check(result.value("axis") == expected, f"axis does not match {expected}")
    actions = sum(
        len(result.get(kind))
        for kind in ("attempt", "regression_attempt", "regression", "evidence_gap")
    )
    result.check(actions, "at least one action or evidence gap is required")
    originals, attempts = result.keyed("original"), result.keyed("attempt")
    closed_attempts(result, originals, attempts)
    closed_attempts(
        result,
        result.keyed("prior_regression", label="prior regression key"),
        result.keyed("regression_attempt"),
        regression=True,
    )
    for row in result.get("regression"):
        result.check(
            row[1] in attempts,
            f"new regression cause is not an attempted original finding: {row[1]}",
        )
    result.finish()
    return result
