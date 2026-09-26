from __future__ import annotations

from pathlib import Path

from darrow_review.common import serialize


def result_rows() -> list[list[str]]:
    return [
        ["format", "darrow-review-result-v3"],
        ["base", "base"],
        ["target", "original"],
        ["changed_file", str(Path.cwd() / "file.txt")],
        ["standards", "pass"],
        ["standards_source", "AGENTS.md"],
        ["spec", "fail"],
        ["spec_source", "request"],
        [
            "finding",
            "spec",
            "high",
            "blocking",
            "file.txt:1",
            "request",
            "wrong value",
            "restore value",
            "test value",
        ],
        ["check", "test", "applicable", "pass", "exited 0"],
        ["verdict", "fail"],
        ["risk", "none"],
        ["next_action", "repair"],
    ]


def verification_rows() -> list[list[str]]:
    return [
        ["format", "darrow-review-verification-v3"],
        ["original_target", "original"],
        ["prior_target", "original"],
        ["current_target", "repaired"],
        ["previous_verification", "none", "none"],
        [
            "original_finding",
            "spec:1:original",
            "spec",
            "1",
            "high",
            "blocking",
            "file.txt:1",
            "request",
            "wrong value",
            "restore value",
            "test value",
        ],
        ["attempt", "spec:1:original", "resolved", "resolved", "value restored"],
        ["check", "test", "applicable", "pass", "exited 0"],
        ["outcome", "clear"],
        ["next_action", "return"],
    ]


def write(path: Path, records: list[list[str]]) -> str:
    path.write_text(serialize(records), encoding="utf-8", newline="\n")
    return str(path)


def change(records: list[list[str]], kind: str, *fields: str) -> list[list[str]]:
    return [[kind, *fields] if row[0] == kind else row[:] for row in records]
