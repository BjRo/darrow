"""Canonical Markdown presentation; never synthesize reviewer judgment."""

from __future__ import annotations

from .common import read_text
from .records import Records, validate_result
from .verification import validate_verification


def escape(value: str) -> str:
    entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "#": "&#35;",
        "`": "&#96;",
        "*": "&#42;",
        "_": "&#95;",
        "[": "&#91;",
        "]": "&#93;",
        "|": "&#124;",
        "\\": "&#92;",
    }
    return "".join(entities.get(char, char) for char in value)


def value(label: str, text: str) -> str:
    return f"- **{label}:** {escape(text)}"


def guidance(fields: list[str], prefix: str = "") -> list[str]:
    if not fields:
        return []
    return [
        prefix + value("Repair guidance (advisory)", fields[0]),
        prefix + value("Resolution evidence", fields[1]),
    ]


def checks(result: Records) -> list[str]:
    return [
        "\n## Checks",
        *[
            f"- **{row[3].upper()}** ({escape(row[2])}) — {escape(row[1])}: {escape(row[4])}"
            for row in result.get("check")
        ],
    ]


def comprehensive(result: Records) -> str:
    verdict = result.value("verdict")
    findings = result.get("finding")
    blocking = sum(row[3] == "blocking" for row in findings)
    lines = [
        f"# Code review — {verdict.upper()}\n",
        f"**Verdict:** {escape(verdict)} · **Findings:** {len(findings)} ({blocking} blocking, {len(findings) - blocking} advisory)\n",
        "## Findings",
    ]
    if not findings:
        lines.append("No findings.")
    for index, row in enumerate(findings, 1):
        lines.extend(
            [
                f"\n### {index}. {row[2].upper()} — {row[3].upper()} ({row[1].title()})",
                value("Location", row[4]),
                value("Source", row[5]),
                value("Evidence", row[6]),
                *guidance(row[7:]),
            ]
        )
    lines.extend(checks(result))
    lines.extend(
        [
            "\n## Risks",
            *["- " + escape(row[1]) for row in result.get("risk")],
            "\n## Next action",
            escape(result.value("next_action")),
            "\n## Scope",
            value("Base", result.value("base")),
            value("Target", result.value("target")),
            "- **Changed files:**",
            *["  - " + escape(row[1]) for row in result.get("changed_file")],
            "\n## Sources",
            f"- **Standards ({escape(result.value('standards'))}):**",
            *["  - " + escape(row[1]) for row in result.get("standards_source")],
            f"- **Spec ({escape(result.value('spec'))}):** {escape(result.value('spec_source'))}",
        ]
    )
    return "\n".join(lines) + "\n"


def attempted_findings(result: Records) -> list[str]:
    lines = ["## Attempted findings"]
    if not result.get("attempt"):
        lines.append("No attempted findings were verifiable.")
    originals = result.keyed("original_finding")
    for index, row in enumerate(result.get("attempt"), 1):
        original = originals[row[1]]
        lines.extend(
            [
                f"\n### {index}. {escape(row[1])} — {row[2].upper()} / {row[3].upper()} ({original[4].upper()}, {escape(original[5])})",
                value("Location", original[6]),
                value("Source", original[7]),
                value("Original evidence", original[8]),
                *guidance(original[9:]),
                value("Current evidence", row[4]),
            ]
        )
    return lines


def repair_regressions(result: Records) -> list[str]:
    lines = ["\n## Repair-caused regressions"]
    if not result.get("regression"):
        lines.append("No repair-caused regressions.")
    for index, row in enumerate(result.get("regression"), 1):
        lines.extend(
            [
                f"\n### {index}. {escape(row[1])} — {row[6].upper()} / {row[7].upper()} ({row[5].upper()})",
                value("Axis", row[4]),
                value("Caused by", row[2]),
                value("Location", row[8]),
                value("Source", row[9]),
                value("Evidence", row[10]),
                *guidance(row[11:]),
            ]
        )
    return lines


def target_binding(result: Records) -> list[str]:
    lines = [
        "\n## Target binding",
        value("Original target", result.value("original_target")),
        value("Prior target", result.value("prior_target")),
        value("Current target", result.value("current_target")),
        value("Previous verification checksum", result.value("previous_verification")),
        value(
            "Previous verification artifact", result.value("previous_verification", 2)
        ),
    ]
    if result.get("history_target"):
        lines.extend(
            [
                "- **Earlier targets:**",
                *["  - " + escape(row[1]) for row in result.get("history_target")],
            ]
        )
    return lines


def closed_findings(result: Records) -> list[str]:
    lines = ["\n## Closed original finding set"]
    for row in result.get("original_finding"):
        escaped = [escape(field) for field in row]
        lines.extend(
            [
                f"- {escaped[1]} — {escaped[2]} #{escaped[3]}, {escaped[4]}/{escaped[5]}; {escaped[6]}; source {escaped[7]}; {escaped[8]}",
                *guidance(row[9:], "  "),
            ]
        )
    return lines


def verification(result: Records) -> str:
    statuses = [row[2] for row in result.get("attempt")]
    lines = [
        f"# Repair verification — {result.value('outcome').upper()}\n",
        f"**Outcome:** {escape(result.value('outcome'))} · Original findings: {len(result.get('original_finding'))} · Resolved: {statuses.count('resolved')} · Unresolved: {statuses.count('unresolved')} · Blocked: {statuses.count('blocked')} · Regressions: {len(result.get('regression'))}\n",
        *attempted_findings(result),
        *repair_regressions(result),
        *checks(result),
        "\n## Evidence gaps",
    ]
    gaps = result.get("evidence_gap")
    lines.extend(
        ["- " + escape(row[1]) for row in gaps] if gaps else ["No evidence gaps."]
    )
    lines.extend(
        [
            *target_binding(result),
            *closed_findings(result),
            "\n## Next action",
            escape(result.value("next_action")),
        ]
    )
    return "\n".join(lines) + "\n"


def render(command: str, path: str) -> str:
    text = read_text(path, "result")
    if command == "render-verification":
        return verification(validate_verification(text, path))
    return comprehensive(validate_result(text))
