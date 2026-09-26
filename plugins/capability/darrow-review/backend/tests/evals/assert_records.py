"""Check named fields in hidden review eval JSON artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROUTE_FIELDS = ("host", "provider", "model", "effort")


def load(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not value:
        raise ValueError(f"{path} must contain a JSON object")
    return value


def expected(fields: list[str]) -> tuple[str, object]:
    if len(fields) == 2:
        return fields[0], fields[1]
    if len(fields) == 5 and fields[0].endswith("_route"):
        return fields[0], {
            field: fields[index + 1] for index, field in enumerate(ROUTE_FIELDS)
        }
    raise ValueError(f"invalid field assertion: {fields!r}")


def exact(record: dict[str, object], operation: str, fields: list[str]) -> None:
    key, value = expected(fields)
    if (record.get(key) == value) != (operation == "has"):
        raise ValueError(f"{operation} failed for {fields!r}")


def lacks_key(record: dict[str, object], fields: list[str]) -> None:
    if len(fields) != 1:
        raise ValueError("lacks-key needs one field")
    name = fields[0]
    if name in record and record[name] != []:
        raise ValueError(f"unexpected field: {name}")


def strings(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [part for item in value.values() for part in strings(item)]
    if isinstance(value, list):
        return [part for item in value for part in strings(item)]
    return []


def contains(record: dict[str, object], operation: str, fields: list[str]) -> None:
    if len(fields) != 1:
        raise ValueError(f"{operation} needs one field")
    present = any(fields[0] in field for field in strings(record))
    if present != (operation == "contains"):
        raise ValueError(f"{operation} failed for {fields[0]!r}")


def value(record: dict[str, object], fields: list[str]) -> str:
    if len(fields) != 1 or not isinstance(record.get(fields[0]), str):
        raise ValueError(f"expected one string field: {fields!r}")
    return str(record[fields[0]])


def check(path: Path, operation: str, fields: list[str]) -> str | None:
    record = load(path)
    if operation in ("has", "lacks"):
        exact(record, operation, fields)
    elif operation == "lacks-key":
        lacks_key(record, fields)
    elif operation in ("contains", "not-contains"):
        contains(record, operation, fields)
    elif operation == "value":
        return value(record, fields)
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
