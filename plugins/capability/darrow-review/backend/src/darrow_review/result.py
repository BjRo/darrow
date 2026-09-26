"""Public result operations bind validated judgments to retained scope."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any, cast

from . import scope
from .common import ReviewError, document, read_text, require
from .records import Record, Records, validate_axis, validate_fix_axis, validate_result
from .verification import validate_verification


def original_findings(original: Records) -> list[Record]:
    return [
        {
            "key": f"{finding['axis']}:{order}:{original.value('target')}",
            "axis": finding["axis"],
            "order": str(order),
            **{name: value for name, value in finding.items() if name != "axis"},
        }
        for order, finding in enumerate(original.items("findings"), 1)
    ]


def scope_records(path: str) -> dict[str, object]:
    try:
        scope.show(path)
    except (ReviewError, OSError) as exc:
        raise ReviewError(f"cannot validate pinned scope: {path}", 4) from exc
    records = document(read_text(path))
    base, target, files, declared = (
        records.get("base"),
        records.get("target"),
        records.get("changed_files"),
        records.get("changed_count"),
    )
    require(
        isinstance(base, str)
        and bool(base)
        and isinstance(target, str)
        and bool(target)
        and isinstance(files, list)
        and bool(files)
        and all(isinstance(file, str) and file for file in files)
        and isinstance(declared, str)
        and bool(re.fullmatch("[1-9][0-9]*", declared)),
        f"invalid scope identity records: {path}",
        4,
    )
    validate_scope_files(path, cast(list[str], files), int(cast(str, declared)))
    return {"base": base, "target": target, "changed_files": files}


def validate_scope_files(path: str, files: list[Any], declared: int) -> None:
    require(
        len(files) == declared
        and len(files) == len(set(files))
        and all(Path(file).is_absolute() for file in files),
        f"invalid scope identity records: {path}",
        4,
    )


def validate_scope(path: str, result_path: str) -> str:
    expected = scope_records(path)
    result = validate_result(read_text(result_path, "result"))
    actual = {name: result.data.get(name, []) for name in expected}
    require(
        expected == actual,
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
        and verification.items("original_findings") == original_findings(original),
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
