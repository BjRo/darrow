"""Ordered structural diagnostics for parsed ADR sources."""

import re
from datetime import date

from .errors import Diagnostics
from .model import IDENTIFIER, SECTIONS, STATUSES, Record, byte_length
from .parser import Parsed


def valid_date(value: str) -> bool:
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def identifier_errors(record: Record) -> list[str]:
    value = record.identifier
    if not value:
        return ["ADR heading has no identifier"]
    if byte_length(value) > 22:
        return ["ADR identifier exceeds the 18-digit limit"]
    if not IDENTIFIER.fullmatch(value):
        return [f"unsupported ADR identifier: {value}"]
    return []


def required_field(
    parsed: Parsed, key: str, value: str, limit: int, size_name: str
) -> list[str]:
    count = parsed.counts[key]
    if count != 1:
        return [f"expected exactly one {key} field; found {count}"]
    if key == "Summary" and not value:
        return ["Summary field is blank"]
    if byte_length(value) > limit:
        return [f"{size_name} exceeds {limit} bytes"]
    return field_value_errors(key, value)


def field_value_errors(key: str, value: str) -> list[str]:
    if key == "Status" and value not in STATUSES:
        return [f"unsupported decision status: {value}"]
    if key == "Date" and not valid_date(value):
        return [f"Date is not a valid ISO calendar date: {value}"]
    return []


def optional_fields(parsed: Parsed, record: Record) -> list[str]:
    fields = (
        ("Supersedes", record.supersedes, 1000),
        ("Superseded by", record.superseded_by, 1000),
        ("Revisit when", record.revisit, 500),
    )
    result = [
        f"duplicate {key} fields" for key, _, _ in fields if parsed.counts[key] > 1
    ]
    result.extend(
        f"{key} field is blank"
        for key, value, _ in fields
        if parsed.counts[key] == 1 and not value
    )
    result.extend(
        f"{key} exceeds {limit} bytes"
        for key, value, limit in fields
        if byte_length(value) > limit
    )
    return result


def heading_errors(parsed: Parsed, record: Record) -> list[str]:
    result = []
    file_match = re.match(r"^(ADR-[0-9]+)(?:-|\.md$)", record.path.name)
    if not file_match:
        result.append("filename does not carry its ADR identifier")
    count = parsed.counts["heading"]
    if count != 1:
        result.append(f"expected exactly one level-1 ADR heading; found {count}")
    result.extend(identifier_errors(record))
    if file_match and record.identifier and file_match[1] != record.identifier:
        result.append(
            f"filename identifier {file_match[1]} disagrees with heading identifier {record.identifier}"
        )
    return result


def title_errors(value: str) -> list[str]:
    if not value:
        return ["ADR title is empty"]
    if byte_length(value) > 240:
        return ["ADR title exceeds 240 bytes"]
    return []


def validate_record(parsed: Parsed, record: Record, errors: Diagnostics) -> None:
    problems = heading_errors(parsed, record) + title_errors(record.title)
    for key, value, limit, size_name in (
        ("Status", record.status, 32, "decision status"),
        ("Date", record.date, 32, "Date"),
        ("Summary", record.summary, 500, "Summary"),
    ):
        problems.extend(required_field(parsed, key, value, limit, size_name))
    problems.extend(optional_fields(parsed, record))
    if parsed.fence:
        problems.append("Markdown fence is not closed")
    problems.extend(
        f"{key} section must occur once and contain content"
        for key in SECTIONS
        if parsed.counts[key] != 1 or key not in parsed.content
    )
    for problem in problems:
        errors.add(f"{record.path}: {problem}")
