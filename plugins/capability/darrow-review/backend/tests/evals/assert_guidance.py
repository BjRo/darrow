"""Compare aggregate review guidance with its reader-authored JSON records."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from assert_records import load


def shape(kind: str) -> tuple[str, int, tuple[int, int]]:
    if kind == "finding":
        return "darrow-review-axis-v2", 9, (7, 8)
    if kind == "regression":
        return "darrow-review-fix-axis-v2", 13, (11, 12)
    raise ValueError(f"unknown guidance kind: {kind}")


def aggregate_rows(
    path: Path, kind: str, size: int, guidance: tuple[int, int]
) -> list[list[str]]:
    aggregate = [row for row in load(path) if row[0] == kind]
    if not aggregate or any(
        len(row) != size or any(not row[index] for index in guidance)
        for row in aggregate
    ):
        raise ValueError(f"aggregate has incomplete {kind} guidance")
    return aggregate


def reader_rows(path: Path, kind: str, format_name: str) -> list[list[str]]:
    candidate = json.loads(path.read_text(encoding="utf-8"))
    if (
        not isinstance(candidate, list)
        or not candidate
        or candidate[0] != ["format", format_name]
    ):
        return []
    records = load(path)
    if kind == "finding":
        axes = [row[1] for row in records if row[0] == "axis"]
        if len(axes) != 1:
            raise ValueError(f"{path} has no unique axis")
        return [[axes[0], *row[1:]] for row in records if row[0] == kind]
    return [row[1:] for row in records if row[0] == kind]


def projection(row: list[str], kind: str) -> list[str]:
    if kind == "finding":
        return row[1:]
    return [row[index] for index in (2, 5, 8, 9, 10, 11, 12)]


def check(aggregate_path: Path, kind: str) -> None:
    format_name, size, guidance = shape(kind)
    aggregate = aggregate_rows(aggregate_path, kind, size, guidance)
    reader = [
        row
        for path in aggregate_path.parent.glob("*.json")
        for row in reader_rows(path, kind, format_name)
    ]
    for row in aggregate:
        if projection(row, kind) not in reader:
            raise ValueError(f"aggregate {kind} guidance differs from a reader")


if __name__ == "__main__":
    try:
        check(Path(sys.argv[1]), sys.argv[2])
    except (IndexError, OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
