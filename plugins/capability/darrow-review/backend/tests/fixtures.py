"""Named JSON fixtures for the review protocols."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from darrow_review.common import serialize


def result_record() -> dict[str, Any]:
    return {
        "format": "darrow-review-result-v3",
        "base": "base",
        "target": "original",
        "changed_files": [str(Path.cwd() / "file.txt")],
        "standards": "pass",
        "standards_sources": ["AGENTS.md"],
        "spec": "fail",
        "spec_source": "request",
        "findings": [
            {
                "axis": "spec",
                "severity": "high",
                "disposition": "blocking",
                "location": "file.txt:1",
                "source": "request",
                "evidence": "wrong value",
                "repair_guidance": "restore value",
                "resolution_evidence": "test value",
            }
        ],
        "checks": [
            {
                "command": "test",
                "applicability": "applicable",
                "status": "pass",
                "evidence": "exited 0",
            }
        ],
        "verdict": "fail",
        "risks": ["none"],
        "next_action": "repair",
    }


def verification_record() -> dict[str, Any]:
    return {
        "format": "darrow-review-verification-v3",
        "original_target": "original",
        "prior_target": "original",
        "current_target": "repaired",
        "previous_verification": {"checksum": "none", "path": "none"},
        "original_findings": [
            {
                "key": "spec:1:original",
                "axis": "spec",
                "order": "1",
                "severity": "high",
                "disposition": "blocking",
                "location": "file.txt:1",
                "source": "request",
                "evidence": "wrong value",
                "repair_guidance": "restore value",
                "resolution_evidence": "test value",
            }
        ],
        "attempts": [
            {
                "key": "spec:1:original",
                "status": "resolved",
                "progress": "resolved",
                "evidence": "value restored",
            }
        ],
        "checks": [
            {
                "command": "test",
                "applicability": "applicable",
                "status": "pass",
                "evidence": "exited 0",
            }
        ],
        "outcome": "clear",
        "next_action": "return",
    }


def write(path: Path, value: dict[str, Any]) -> str:
    path.write_text(serialize(value), encoding="utf-8", newline="\n")
    return str(path)
