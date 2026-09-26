"""Compare aggregate guidance with reader-authored JSON fields."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from assert_records import load

GUIDANCE = ("repair_guidance", "resolution_evidence")
REGRESSION_FIELDS = (
    "caused_by",
    "severity",
    "location",
    "source",
    "evidence",
    *GUIDANCE,
)


def shape(kind: str) -> tuple[str, str, tuple[str, ...]]:
    if kind == "finding":
        return (
            "darrow-review-axis-v3",
            "findings",
            (
                "axis",
                "severity",
                "disposition",
                "location",
                "source",
                "evidence",
                *GUIDANCE,
            ),
        )
    if kind == "regression":
        return "darrow-review-fix-axis-v3", "regressions", REGRESSION_FIELDS
    raise ValueError(f"unknown guidance kind: {kind}")


def entries(record: dict[str, object], name: str) -> list[dict[str, object]]:
    value = record.get(name)
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"invalid {name} array")
    return value


def projected(item: dict[str, object], fields: tuple[str, ...]) -> dict[str, object]:
    return {name: item.get(name) for name in fields}


def complete(aggregate: list[dict[str, object]], kind: str) -> None:
    if not aggregate or any(
        any(
            not isinstance(item.get(field), str) or not item[field]
            for field in GUIDANCE
        )
        for item in aggregate
    ):
        raise ValueError(f"aggregate has incomplete {kind} guidance")


def reader_entries(
    aggregate_path: Path, name: str, format_name: str
) -> list[dict[str, object]]:
    readers = []
    for path in aggregate_path.parent.glob("*.json"):
        candidate = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(candidate, dict) or candidate.get("format") != format_name:
            continue
        for item in entries(candidate, name):
            readers.append({"axis": candidate.get("axis"), **item})
    return readers


def check(aggregate_path: Path, kind: str) -> None:
    format_name, name, fields = shape(kind)
    aggregate = entries(load(aggregate_path), name)
    complete(aggregate, kind)
    readers = [
        projected(item, fields)
        for item in reader_entries(aggregate_path, name, format_name)
    ]
    for item in aggregate:
        if projected(item, fields) not in readers:
            raise ValueError(f"aggregate {kind} guidance differs from a reader")


if __name__ == "__main__":
    try:
        check(Path(sys.argv[1]), sys.argv[2])
    except (IndexError, OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
