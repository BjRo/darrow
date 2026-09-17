from __future__ import annotations

import unittest
from typing import Any

from scripts.verify_coverage import coverage_percentages, verify


def _report(*, lines: tuple[int, int], branches: tuple[int, int]) -> dict[str, Any]:
    return {
        "totals": {
            "covered_lines": lines[0],
            "num_statements": lines[1],
            "covered_branches": branches[0],
            "num_branches": branches[1],
        }
    }


class CoverageGateTests(unittest.TestCase):
    def test_measures_lines_and_branches_separately(self) -> None:
        report = _report(lines=(96, 100), branches=(95, 100))

        self.assertEqual(coverage_percentages(report), (96.0, 95.0))
        self.assertEqual(verify(report, 95.0), (96.0, 95.0))

    def test_rejects_high_line_coverage_with_low_branch_coverage(self) -> None:
        report = _report(lines=(99, 100), branches=(94, 100))

        with self.assertRaisesRegex(ValueError, "branch coverage 94.00%"):
            verify(report, 95.0)

    def test_rejects_invalid_reports(self) -> None:
        with self.assertRaisesRegex(ValueError, "no totals"):
            coverage_percentages({})
        with self.assertRaisesRegex(ValueError, "invalid totals"):
            coverage_percentages({"totals": {}})
