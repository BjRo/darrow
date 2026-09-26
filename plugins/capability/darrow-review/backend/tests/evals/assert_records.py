"""Read eval artifacts as JSON and check exact record fields."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def load(path: Path) -> list[list[str]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if (
        not isinstance(value, list)
        or not value
        or any(
            not isinstance(row, list)
            or not row
            or any(not isinstance(field, str) for field in row)
            for row in value
        )
    ):
        raise ValueError(f"{path} must contain JSON arrays of strings")
    return value


def exact(records: list[list[str]], operation: str, fields: list[str]) -> None:
    if not fields:
        raise ValueError("an exact record needs at least one field")
    if operation == "has" and fields not in records:
        raise ValueError(f"missing record: {fields!r}")
    if operation == "lacks" and fields in records:
        raise ValueError(f"unexpected record: {fields!r}")


def lacks_key(records: list[list[str]], fields: list[str]) -> None:
    if len(fields) != 1:
        raise ValueError("lacks-key needs one field")
    if any(row[0] == fields[0] for row in records):
        raise ValueError(f"unexpected record key: {fields[0]}")


def contains(records: list[list[str]], operation: str, fields: list[str]) -> None:
    if len(fields) != 1:
        raise ValueError(f"{operation} needs one field")
    present = any(fields[0] in field for row in records for field in row)
    if present != (operation == "contains"):
        raise ValueError(f"{operation} failed for {fields[0]!r}")


def value(records: list[list[str]], fields: list[str]) -> str:
    if len(fields) != 1:
        raise ValueError("value needs one field")
    matches = [row for row in records if row[0] == fields[0]]
    if len(matches) != 1 or len(matches[0]) != 2:
        raise ValueError(f"expected one two-field {fields[0]} record")
    return matches[0][1]


def check(path: Path, operation: str, fields: list[str]) -> str | None:
    records = load(path)
    if operation in ("has", "lacks"):
        exact(records, operation, fields)
    elif operation == "lacks-key":
        lacks_key(records, fields)
    elif operation in ("contains", "not-contains"):
        contains(records, operation, fields)
    elif operation == "value":
        return value(records, fields)
    else:
        raise ValueError(f"invalid record operation: {operation} {fields!r}")
    return None


if __name__ == "__main__":
    try:
        result = check(Path(sys.argv[1]), sys.argv[2], sys.argv[3:])
        if result is not None:
            print(result)
    except (IndexError, OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
