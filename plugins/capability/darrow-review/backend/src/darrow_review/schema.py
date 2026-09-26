"""Structural schemas for review judgments, checked with a small stdlib validator."""

from __future__ import annotations

import re
from typing import Any, NoReturn

from .common import ReviewError

AXIS = "standards|spec"
STATUS = "pass|fail|blocked"
SEVERITY = "critical|high|medium|low"
DISPOSITION = "blocking|advisory"


def string(pattern: str = "") -> dict[str, Any]:
    result: dict[str, Any] = {"type": "string", "minLength": 1}
    if pattern:
        result["pattern"] = f"^(?:{pattern})$"
    return result


def object_schema(
    fields: tuple[str, ...],
    *,
    required: tuple[str, ...] | None = None,
    patterns: dict[str, str] | None = None,
    guidance: bool = False,
) -> dict[str, Any]:
    patterns = patterns or {}
    result: dict[str, Any] = {
        "type": "object",
        "properties": {name: string(patterns.get(name, "")) for name in fields},
        "required": list(required if required is not None else fields),
        "additionalProperties": False,
    }
    if guidance:
        result["dependentRequired"] = {
            "repair_guidance": ["resolution_evidence"],
            "resolution_evidence": ["repair_guidance"],
        }
    return result


def array(item: dict[str, Any], minimum: int = 0) -> dict[str, Any]:
    return {"type": "array", "items": item, "minItems": minimum}


def document(
    format_name: str,
    properties: dict[str, dict[str, Any]],
    required: tuple[str, ...],
) -> dict[str, Any]:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {"format": {"const": format_name}, **properties},
        "required": ["format", *required],
        "additionalProperties": False,
    }


FINDING = object_schema(
    (
        "axis",
        "severity",
        "disposition",
        "location",
        "source",
        "evidence",
        "repair_guidance",
        "resolution_evidence",
    ),
    required=("axis", "severity", "disposition", "location", "source", "evidence"),
    patterns={"axis": AXIS, "severity": SEVERITY, "disposition": DISPOSITION},
    guidance=True,
)
AXIS_FINDING = object_schema(
    (
        "severity",
        "disposition",
        "location",
        "source",
        "evidence",
        "repair_guidance",
        "resolution_evidence",
    ),
    required=("severity", "disposition", "location", "source", "evidence"),
    patterns={"severity": SEVERITY, "disposition": DISPOSITION},
    guidance=True,
)
ORIGINAL_FINDING = object_schema(
    (
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
    ),
    required=(
        "key",
        "axis",
        "order",
        "severity",
        "disposition",
        "location",
        "source",
        "evidence",
    ),
    patterns={
        "axis": AXIS,
        "order": "[1-9][0-9]*",
        "severity": SEVERITY,
        "disposition": DISPOSITION,
    },
    guidance=True,
)
CHECK = object_schema(
    ("command", "applicability", "status", "evidence"),
    patterns={"applicability": "applicable|not_applicable"},
)
ATTEMPT = object_schema(("key", "status", "progress", "evidence"))
VERIFICATION_REGRESSION = object_schema(
    (
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
    ),
    required=(
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
    ),
    patterns={"order": "[1-9][0-9]*", "axis": AXIS, "severity": SEVERITY},
    guidance=True,
)

SCHEMAS = {
    "darrow-review-axis-v3": document(
        "darrow-review-axis-v3",
        {
            "axis": string(AXIS),
            "status": string(STATUS),
            "sources": array(string(), 1),
            "findings": array(AXIS_FINDING),
        },
        ("axis", "status", "sources"),
    ),
    "darrow-review-result-v3": document(
        "darrow-review-result-v3",
        {
            "base": string(),
            "target": string(),
            "changed_files": array(string()),
            "standards_sources": array(string(), 1),
            "spec_source": string(),
            "standards": string(STATUS),
            "spec": string(STATUS + "|not_available"),
            "verdict": string(STATUS),
            "findings": array(FINDING),
            "checks": array(CHECK, 1),
            "risks": array(string(), 1),
            "next_action": string(),
        },
        (
            "base",
            "target",
            "standards_sources",
            "spec_source",
            "standards",
            "spec",
            "verdict",
            "checks",
            "risks",
            "next_action",
        ),
    ),
    "darrow-review-fix-axis-v3": document(
        "darrow-review-fix-axis-v3",
        {
            "axis": string(AXIS),
            "originals": array(string()),
            "prior_regressions": array(object_schema(("key", "caused_by"))),
            "attempts": array(ATTEMPT),
            "regression_attempts": array(ATTEMPT),
            "evidence_gaps": array(string()),
            "regressions": array(
                object_schema(
                    (
                        "caused_by",
                        "severity",
                        "location",
                        "source",
                        "evidence",
                        "repair_guidance",
                        "resolution_evidence",
                    ),
                    required=(
                        "caused_by",
                        "severity",
                        "location",
                        "source",
                        "evidence",
                    ),
                    patterns={"severity": SEVERITY},
                    guidance=True,
                )
            ),
        },
        ("axis",),
    ),
    "darrow-review-verification-v3": document(
        "darrow-review-verification-v3",
        {
            "original_target": string(),
            "prior_target": string(),
            "current_target": string(),
            "history_targets": array(string()),
            "previous_verification": object_schema(("checksum", "path")),
            "original_findings": array(ORIGINAL_FINDING),
            "attempts": array(ATTEMPT),
            "regressions": array(VERIFICATION_REGRESSION),
            "checks": array(CHECK, 1),
            "evidence_gaps": array(string()),
            "outcome": string("clear|continue|no_progress|blocked"),
            "next_action": string(),
        },
        (
            "original_target",
            "prior_target",
            "current_target",
            "previous_verification",
            "checks",
            "outcome",
            "next_action",
        ),
    ),
}


def invalid(path: str, message: str) -> NoReturn:
    raise ReviewError(f"invalid review JSON at {path}: {message}", 4)


def validate_node(value: object, schema: dict[str, Any], path: str) -> None:
    if "const" in schema and value != schema["const"]:
        invalid(path, f"expected {schema['const']}")
    kind = schema.get("type")
    if kind == "string":
        validate_string(value, schema, path)
    elif kind == "array":
        validate_array(value, schema, path)
    elif kind == "object":
        validate_object(value, schema, path)


def validate_string(value: object, schema: dict[str, Any], path: str) -> None:
    if not isinstance(value, str) or (schema.get("minLength") and not value):
        invalid(path, "must be a nonempty string")
    if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
        invalid(path, "value is not allowed")


def validate_array(value: object, schema: dict[str, Any], path: str) -> None:
    if not isinstance(value, list) or len(value) < schema.get("minItems", 0):
        invalid(path, "must be an array of the required size")
    for index, item in enumerate(value):
        validate_node(item, schema["items"], f"{path}[{index}]")


def validate_object(value: object, schema: dict[str, Any], path: str) -> None:
    if not isinstance(value, dict):
        invalid(path, "must be an object")
    validate_required(value, schema["required"], path)
    validate_properties(value, schema["properties"], path)
    validate_dependencies(value, schema.get("dependentRequired", {}), path)


def validate_required(value: dict[str, object], required: list[str], path: str) -> None:
    for name in required:
        if name not in value:
            invalid(path, f"missing {name}")


def validate_properties(
    value: dict[str, object], properties: dict[str, dict[str, Any]], path: str
) -> None:
    for name, item in value.items():
        if name not in properties:
            invalid(path, f"unknown field {name}")
        validate_node(item, properties[name], f"{path}.{name}")


def validate_dependencies(
    value: dict[str, object], dependencies: dict[str, list[str]], path: str
) -> None:
    for name, required in dependencies.items():
        if name in value:
            validate_required(value, required, path)


def validate(value: dict[str, object], format_name: str) -> None:
    validate_node(value, SCHEMAS[format_name], format_name)
