from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _percentage(covered: int, total: int) -> float:
    return 100.0 if total == 0 else covered * 100.0 / total


def coverage_percentages(report: dict[str, Any]) -> tuple[float, float]:
    totals = report.get("totals")
    if not isinstance(totals, dict):
        raise ValueError("coverage report has no totals object")
    try:
        lines = _percentage(totals["covered_lines"], totals["num_statements"])
        branches = _percentage(totals["covered_branches"], totals["num_branches"])
    except (KeyError, TypeError, ZeroDivisionError) as error:
        raise ValueError("coverage report has invalid totals") from error
    return lines, branches


def verify(report: dict[str, Any], minimum: float) -> tuple[float, float]:
    lines, branches = coverage_percentages(report)
    failures = []
    if lines < minimum:
        failures.append(f"line coverage {lines:.2f}%")
    if branches < minimum:
        failures.append(f"branch coverage {branches:.2f}%")
    if failures:
        raise ValueError(f"{', '.join(failures)} below required {minimum:.2f}%")
    return lines, branches


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    parser.add_argument("--minimum", type=float, default=95.0)
    arguments = parser.parse_args()
    report = json.loads(arguments.report.read_text(encoding="utf-8"))
    lines, branches = verify(report, arguments.minimum)
    print(f"coverage passed: lines={lines:.2f}% branches={branches:.2f}%")


if __name__ == "__main__":
    main()
