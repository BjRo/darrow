"""Translate named JSON objects at the wire boundary to internal record rows."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from typing import cast

PLURAL = {
    "changed_file": "changed_files",
    "standards_source": "standards_sources",
    "source": "sources",
    "finding": "findings",
    "check": "checks",
    "risk": "risks",
    "history_target": "history_targets",
    "original_finding": "original_findings",
    "attempt": "attempts",
    "attempted": "attempted",
    "regression": "regressions",
    "evidence_gap": "evidence_gaps",
    "original": "originals",
    "prior_regression": "prior_regressions",
    "regression_attempt": "regression_attempts",
    "removed": "removed",
}
SINGULAR = {value: key for key, value in PLURAL.items()}
OBJECT_FIELDS = {
    "check": ("command", "applicability", "status", "evidence"),
    "attempt": ("key", "status", "progress", "evidence"),
    "regression_attempt": ("key", "status", "progress", "evidence"),
    "prior_regression": ("key", "caused_by"),
    "previous_verification": ("checksum", "path"),
    "selected_route": ("host", "provider", "model", "effort"),
    "observed_route": ("host", "provider", "model", "effort"),
    "requested_route": ("host", "provider", "model", "effort"),
    "provider": ("host", "provider"),
}
RESULT_FINDING = (
    "axis",
    "severity",
    "disposition",
    "location",
    "source",
    "evidence",
    "repair_guidance",
    "resolution_evidence",
)
AXIS_FINDING = RESULT_FINDING[1:]
ORIGINAL_FINDING = (
    "key",
    "axis",
    "order",
    "severity",
    "disposition",
    "location",
    "source",
    "evidence",
    "repair_guidance",
    "resolution_evidence",
)
FIX_REGRESSION = (
    "caused_by",
    "severity",
    "location",
    "source",
    "evidence",
    "repair_guidance",
    "resolution_evidence",
)
VERIFICATION_REGRESSION = (
    "key",
    "caused_by",
    "order",
    "axis",
    "severity",
    "status",
    "progress",
    "location",
    "source",
    "evidence",
    "repair_guidance",
    "resolution_evidence",
)


def unique_fields(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for name, value in pairs:
        if name in result:
            raise ValueError(f"duplicate JSON field: {name}")
        result[name] = value
    return result


def fields_for(kind: str, format_name: str) -> tuple[str, ...] | None:
    if kind == "finding":
        return (
            AXIS_FINDING if format_name == "darrow-review-axis-v3" else RESULT_FINDING
        )
    if kind == "original_finding":
        return ORIGINAL_FINDING
    if kind == "regression":
        return (
            FIX_REGRESSION
            if format_name == "darrow-review-fix-axis-v3"
            else VERIFICATION_REGRESSION
        )
    return OBJECT_FIELDS.get(kind)


def encode_fields(kind: str, values: Sequence[str], format_name: str) -> object:
    names = fields_for(kind, format_name)
    if names is None:
        if len(values) != 1:
            raise ValueError(f"{kind} must have exactly one field")
        return values[0]
    if len(values) > len(names):
        raise ValueError(f"{kind} has extra fields")
    return {name: values[index] for index, name in enumerate(names[: len(values)])}


def to_object(records: Sequence[Sequence[str]]) -> dict[str, object]:
    grouped: dict[str, list[list[str]]] = defaultdict(list)
    for row in records:
        if not row or any(not isinstance(value, str) for value in row):
            raise ValueError("records must be nonempty arrays of strings")
        grouped[row[0]].append(list(row[1:]))
    format_rows = grouped.get("format", [])
    format_name = format_rows[0][0] if format_rows and format_rows[0] else ""
    result: dict[str, object] = {}
    for kind, entries in grouped.items():
        if kind not in PLURAL and len(entries) != 1:
            raise ValueError(f"duplicate {kind} field")
        values = [encode_fields(kind, entry, format_name) for entry in entries]
        result[PLURAL.get(kind, kind)] = values if kind in PLURAL else values[0]
    return result


def decode_fields(kind: str, value: object, format_name: str) -> list[str]:
    names = fields_for(kind, format_name)
    return (
        decode_simple(kind, value)
        if names is None
        else decode_named(kind, value, names)
    )


def decode_simple(kind: str, value: object) -> list[str]:
    if not isinstance(value, str):
        raise ValueError(f"invalid {kind} field shape")
    return [kind, value]


def decode_named(kind: str, value: object, names: tuple[str, ...]) -> list[str]:
    if not isinstance(value, dict):
        raise ValueError(f"invalid {kind} field shape")
    present = [name for name in names if name in value]
    if present != list(names[: len(present)]):
        raise ValueError(f"invalid {kind} field order")
    if set(value) - set(names):
        raise ValueError(f"invalid {kind} fields")
    return strings(kind, [value[name] for name in present])


def strings(kind: str, fields: list[object]) -> list[str]:
    if any(not isinstance(field, str) for field in fields):
        raise ValueError(f"{kind} fields must be strings")
    return [kind, *cast(list[str], fields)]


def entries_for(name: str, raw: object) -> tuple[str, list[object]]:
    kind = SINGULAR.get(name, name)
    if kind in PLURAL:
        if name != PLURAL[kind] or not isinstance(raw, list):
            raise ValueError(f"{name} must use an array named {PLURAL[kind]}")
        return kind, raw
    if isinstance(raw, list):
        raise ValueError(f"{name} must not be an array")
    return kind, [raw]


def from_object(value: object) -> list[list[str]]:
    if not isinstance(value, dict) or not value:
        raise ValueError("JSON record must be a nonempty object")
    if any(not isinstance(key, str) for key in value):
        raise ValueError("JSON field names must be strings")
    format_name = value.get("format")
    format_name = format_name if isinstance(format_name, str) else ""
    result: list[list[str]] = []
    names: list[str] = (["format"] if "format" in value else []) + [
        str(name) for name in value if name != "format"
    ]
    for name in names:
        kind, entries = entries_for(name, value[name])
        result.extend(decode_fields(kind, item, format_name) for item in entries)
    return result
