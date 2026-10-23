"""Read-only allowance arithmetic; no lifecycle state or repair authorization."""

from __future__ import annotations

import re
from dataclasses import dataclass

from .arguments import options, require
from .common import RefusalError, record

OPTIONS = {
    "--repairs-used",
    "--repair-maximum",
    "--assessment-used",
    "--assessment-maximum",
}


def count(value: str) -> int:
    if not re.fullmatch(r"[0-9]+", value):
        raise RefusalError("budget counts must be nonnegative integers")
    try:
        return int(value)
    except ValueError as error:
        raise RefusalError("budget count exceeds the supported integer size") from error


@dataclass(frozen=True)
class Allowance:
    used: int
    maximum: int

    def records(self, prefix: str, used_label: str) -> str:
        return (
            record(used_label, str(self.used))
            + record(prefix + "_maximum", str(self.maximum))
            + record(prefix + "_remaining", str(max(0, self.maximum - self.used)))
        )


def parse(args: list[str]) -> dict[str, str]:
    values = options(args, OPTIONS, "repair-budget ")
    require(values, {"repairs-used"}, "repair-budget requires --repairs-used")
    if len(args) != 2 * len(values):
        raise RefusalError("repair-budget options must not repeat")
    assessment = {"assessment-used", "assessment-maximum"}
    if values.keys() & assessment and not assessment <= values.keys():
        raise RefusalError("assessment used and maximum must be supplied together")
    return values


def reason(repair: Allowance, assessment: Allowance | None) -> str:
    if repair.used >= repair.maximum:
        return "repair_limit_exhausted"
    if assessment is not None and assessment.used >= assessment.maximum:
        return "assessment_limit_exhausted"
    return "counts_within_limits"


def run(args: list[str]) -> str:
    values = parse(args)
    repair = Allowance(
        count(values["repairs-used"]), count(values.get("repair-maximum", "2"))
    )
    assessment = None
    output = record("format", "darrow-repair-budget-v1")
    output += repair.records("repair", "repairs_used")
    if "assessment-used" in values:
        assessment = Allowance(
            count(values["assessment-used"]), count(values["assessment-maximum"])
        )
        output += assessment.records("assessment", "assessment_used")
    outcome = reason(repair, assessment)
    decision = "within_limits" if outcome == "counts_within_limits" else "stop"
    return output + record("decision", decision) + record("reason", outcome)
