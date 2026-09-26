"""Semantic validation of schema-checked review documents."""

from __future__ import annotations

from pathlib import Path
from typing import cast

from .common import ReviewError, document
from .schema import validate as validate_schema

Record = dict[str, str]


class Records:
    def __init__(self, text: str) -> None:
        self.data = document(text)
        self.errors: list[str] = []

    def shape(self, format_name: str) -> None:
        validate_schema(self.data, format_name)

    def check(self, condition: object, message: str) -> None:
        if not condition:
            self.errors.append(message)

    def finish(self) -> None:
        if self.errors:
            raise ReviewError("\nreview-result: ".join(self.errors), 4)

    def value(self, name: str) -> str:
        return cast(str, self.data.get(name, ""))

    def object(self, name: str) -> Record:
        return cast(Record, self.data[name])

    def strings(self, name: str) -> list[str]:
        return cast(list[str], self.data.get(name, []))

    def items(self, name: str) -> list[Record]:
        return cast(list[Record], self.data.get(name, []))

    def at_least(self, name: str, message: str = "") -> None:
        self.check(self.data.get(name), message or f"at least one {name} is required")

    def keyed(
        self, name: str, field: str = "key", label: str = ""
    ) -> dict[str, Record]:
        result: dict[str, Record] = {}
        for item in self.items(name):
            key = item[field]
            self.check(key not in result, f"duplicate {label or name + ' key'}: {key}")
            result[key] = item
        return result

    def unique_strings(self, name: str, label: str = "") -> set[str]:
        values = self.strings(name)
        self.check(len(values) == len(set(values)), f"duplicate {label or name}")
        return set(values)


def check_records(records: Records) -> None:
    records.at_least(
        "checks", "at least one check or explicit not_applicable check is required"
    )
    for check in records.items("checks"):
        if check["applicability"] == "applicable":
            records.check(
                check["status"] in ("pass", "fail", "blocked"),
                "applicable check status is invalid",
            )
        else:
            records.check(
                check["status"] == "not_applicable",
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


def blocking_source(records: Records, axis: str, finding: Record) -> None:
    if axis == "spec" and finding["disposition"] == "blocking":
        records.check(
            not finding["source"].startswith(("none", "not_available", "heuristic:")),
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
    result.shape("darrow-review-axis-v3")
    result.check(result.value("axis") == expected, f"axis does not match {expected}")
    findings = result.items("findings")
    for finding in findings:
        blocking_source(result, expected, finding)
    axis_status(
        result,
        result.value("status"),
        any(item["disposition"] == "blocking" for item in findings),
        "axis",
    )
    result.finish()
    return result


def validate_result(text: str) -> Records:
    result = Records(text)
    result.shape("darrow-review-result-v3")
    check_records(result)
    for path in result.strings("changed_files"):
        result.check(Path(path).is_absolute(), "changed_file must be an absolute path")
    validate_result_axes(result)
    statuses = [
        result.value("standards"),
        result.value("spec"),
        *[item["status"] for item in result.items("checks")],
    ]
    expected = (
        "fail" if "fail" in statuses else "blocked" if "blocked" in statuses else "pass"
    )
    result.check(
        result.value("verdict") == expected,
        f"verdict must be {expected} from axis and check statuses",
    )
    result.check(
        result.strings("changed_files") or result.value("verdict") == "blocked",
        "a non-blocked result requires at least one changed_file",
    )
    result.finish()
    return result


def validate_result_axes(result: Records) -> None:
    for axis in ("standards", "spec"):
        findings = [item for item in result.items("findings") if item["axis"] == axis]
        axis_status(
            result,
            result.value(axis),
            any(item["disposition"] == "blocking" for item in findings),
            axis.title() + " axis",
        )
        for item in findings:
            blocking_source(result, axis, item)
    if result.value("spec") == "not_available":
        result.check(
            result.value("spec_source") == "not_available",
            "not_available Spec axis requires spec_source=not_available",
        )
        result.check(
            not any(item["axis"] == "spec" for item in result.items("findings")),
            "not_available Spec axis must not contain Spec findings",
        )
    else:
        result.check(
            result.value("spec_source") != "not_available",
            "available Spec axis must identify its source",
        )


def closed_attempts(
    records: Records,
    originals: set[str],
    attempts: dict[str, Record],
    *,
    regression: bool = False,
) -> None:
    kind = "regression_attempt" if regression else "attempt"
    subject = "prior regression" if regression else "original finding"
    for key, item in attempts.items():
        records.check(
            key in originals, f"{kind} references an unknown {subject}: {key}"
        )
        state(records, item["status"], item["progress"], kind)
    for key in originals:
        records.check(
            key in attempts or records.strings("evidence_gaps"),
            f"{subject} is missing its fix-axis attempt: {key}",
        )


def validate_fix_axis(text: str, expected: str) -> Records:
    result = Records(text)
    result.shape("darrow-review-fix-axis-v3")
    result.check(result.value("axis") == expected, f"axis does not match {expected}")
    actions = sum(
        len(result.strings(name))
        if name == "evidence_gaps"
        else len(result.items(name))
        for name in ("attempts", "regression_attempts", "regressions", "evidence_gaps")
    )
    result.check(actions, "at least one action or evidence gap is required")
    originals = result.unique_strings("originals", "original finding key")
    attempts = result.keyed("attempts", label="attempt finding key")
    closed_attempts(result, originals, attempts)
    prior = result.keyed("prior_regressions", label="prior regression key")
    closed_attempts(
        result, set(prior), result.keyed("regression_attempts"), regression=True
    )
    for item in result.items("regressions"):
        result.check(
            item["caused_by"] in attempts,
            f"new regression cause is not an attempted original finding: {item['caused_by']}",
        )
    result.finish()
    return result
