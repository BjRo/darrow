"""Public result operations bind validated judgments to retained scope."""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

from . import scope
from .common import ReviewError, read_text, require, rows
from .records import Records, validate_axis, validate_fix_axis, validate_result
from .verification import validate_verification


def original_findings(original: Records) -> list[list[str]]:
    return [
        [
            "original_finding",
            f"{row[1]}:{order}:{original.value('target')}",
            row[1],
            str(order),
            *row[2:],
        ]
        for order, row in enumerate(original.get("finding"), 1)
    ]


def scope_records(path: str) -> list[list[str]]:
    try:
        scope.show(path)
    except (ReviewError, OSError) as exc:
        raise ReviewError(f"cannot validate pinned scope: {path}", 4) from exc
    records = rows(read_text(path))
    selected = [row for row in records if row[0] in ("base", "target", "changed_file")]
    counts = Counter(row[0] for row in selected)
    declared = [row for row in records if row[0] == "changed_count"]
    valid = counts["base"] == counts["target"] == 1 and counts["changed_file"] > 0
    valid = valid and all(len(row) == 2 and row[1] for row in selected)
    require(valid, f"invalid scope identity records: {path}", 4)
    valid = len(declared) == 1 and len(declared[0]) == 2
    valid = valid and bool(re.fullmatch("[1-9][0-9]*", declared[0][1]))
    require(valid, f"invalid scope identity records: {path}", 4)
    validate_scope_files(path, selected, counts["changed_file"], int(declared[0][1]))
    return selected


def validate_scope_files(
    path: str, selected: list[list[str]], count: int, declared: int
) -> None:
    files = [row[1] for row in selected if row[0] == "changed_file"]
    require(
        count == declared
        and len(files) == len(set(files))
        and all(Path(file).is_absolute() for file in files),
        f"invalid scope identity records: {path}",
        4,
    )


def validate_scope(path: str, result_path: str) -> str:
    expected = scope_records(path)
    result = validate_result(read_text(result_path, "result"))
    actual = [
        row for row in result.rows if row[0] in ("base", "target", "changed_file")
    ]
    require(
        Counter(map(tuple, expected)) == Counter(map(tuple, actual)),
        f"result base, target, or changed-file set differs from pinned scope: {path}",
        4,
    )
    return "valid: review result matches pinned scope\n"


def validate_original(original_path: str, verification_path: str) -> str:
    original = validate_result(read_text(original_path, "original result"))
    verification = validate_verification(
        read_text(verification_path, "verification"), verification_path
    )
    require(
        verification.value("original_target") == original.value("target")
        and verification.get("original_finding") == original_findings(original),
        "verification changed the original target or complete ordered finding set",
        4,
    )
    return "valid: original review findings preserved\n"


def validate(command: str, path: str, axis: str = "") -> str:
    text = sys.stdin.read() if path == "-" else read_text(path, "result")
    validators = {
        "validate": lambda: validate_result(text),
        "validate-axis": lambda: validate_axis(text, axis),
        "validate-fix-axis": lambda: validate_fix_axis(text, axis),
        "validate-verification": lambda: validate_verification(text, path),
    }
    result = validators[command]()
    suffix = f" ({axis})" if axis else ""
    return f"valid: {result.value('format')}{suffix}\n"
