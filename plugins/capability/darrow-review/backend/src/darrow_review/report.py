"""Canonical Markdown presentation; never synthesize reviewer judgment."""

from __future__ import annotations

from collections import Counter

from . import report_templates as templates
from .common import read_text
from .records import Records, validate_result
from .verification import validate_verification

ESCAPES = str.maketrans(
    {
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
)


def escape(value: str) -> str:
    return (
        value.translate(ESCAPES)
        .replace("\r", "\\r")
        .replace("\n", "\\n")
        .replace("\t", "\\t")
    )


def guidance(fields: list[str], prefix: str = "") -> str:
    if not fields:
        return ""
    return (
        f"\n{prefix}- **Repair guidance (advisory):** {escape(fields[0])}"
        f"\n{prefix}- **Resolution evidence:** {escape(fields[1])}"
    )


def checks(result: Records) -> str:
    return "\n".join(
        f"- **{row[3].upper()}** ({escape(row[2])}) — {escape(row[1])}: {escape(row[4])}"
        for row in result.get("check")
    )


def findings(result: Records) -> str:
    blocks = [
        templates.FINDING.substitute(
            index=index,
            severity=row[2].upper(),
            disposition=row[3].upper(),
            axis=row[1].title(),
            location=escape(row[4]),
            source=escape(row[5]),
            evidence=escape(row[6]),
            guidance=guidance(row[7:]),
        )
        for index, row in enumerate(result.get("finding"), 1)
    ]
    return "\n" + "\n\n".join(blocks) if blocks else "No findings."


def comprehensive(result: Records) -> str:
    verdict = result.value("verdict")
    total = len(result.get("finding"))
    blocking = sum(row[3] == "blocking" for row in result.get("finding"))
    return templates.COMPREHENSIVE.substitute(
        title=verdict.upper(),
        verdict=escape(verdict),
        total=total,
        blocking=blocking,
        advisory=total - blocking,
        findings=findings(result),
        checks=checks(result),
        risks="\n".join("- " + escape(row[1]) for row in result.get("risk")),
        next_action=escape(result.value("next_action")),
        base=escape(result.value("base")),
        target=escape(result.value("target")),
        changed_files="".join(
            "\n  - " + escape(row[1]) for row in result.get("changed_file")
        ),
        standards=escape(result.value("standards")),
        standards_sources="\n".join(
            "  - " + escape(row[1]) for row in result.get("standards_source")
        ),
        spec=escape(result.value("spec")),
        spec_source=escape(result.value("spec_source")),
    )


def attempted_findings(result: Records) -> str:
    originals = result.keyed("original_finding")
    blocks = []
    for index, row in enumerate(result.get("attempt"), 1):
        original = originals[row[1]]
        blocks.append(
            templates.ATTEMPT.substitute(
                index=index,
                identity=escape(row[1]),
                status=row[2].upper(),
                progress=row[3].upper(),
                severity=original[4].upper(),
                disposition=escape(original[5]),
                location=escape(original[6]),
                source=escape(original[7]),
                original_evidence=escape(original[8]),
                guidance=guidance(original[9:]),
                current_evidence=escape(row[4]),
            )
        )
    return (
        "\n" + "\n\n".join(blocks)
        if blocks
        else "No attempted findings were verifiable."
    )


def repair_regressions(result: Records) -> str:
    blocks = [
        templates.REGRESSION.substitute(
            index=index,
            identity=escape(row[1]),
            status=row[6].upper(),
            progress=row[7].upper(),
            severity=row[5].upper(),
            axis=escape(row[4]),
            cause=escape(row[2]),
            location=escape(row[8]),
            source=escape(row[9]),
            evidence=escape(row[10]),
            guidance=guidance(row[11:]),
        )
        for index, row in enumerate(result.get("regression"), 1)
    ]
    return "\n" + "\n\n".join(blocks) if blocks else "No repair-caused regressions."


def target_binding(result: Records) -> str:
    history = result.get("history_target")
    earlier_targets = (
        "\n- **Earlier targets:**"
        + "".join("\n  - " + escape(row[1]) for row in history)
        if history
        else ""
    )
    return templates.TARGET_BINDING.substitute(
        original=escape(result.value("original_target")),
        prior=escape(result.value("prior_target")),
        current=escape(result.value("current_target")),
        checksum=escape(result.value("previous_verification")),
        artifact=escape(result.value("previous_verification", 2)),
        earlier_targets=earlier_targets,
    )


def closed_findings(result: Records) -> str:
    lines = []
    for row in result.get("original_finding"):
        escaped = [escape(field) for field in row]
        lines.append(
            f"\n- {escaped[1]} — {escaped[2]} #{escaped[3]}, {escaped[4]}/{escaped[5]}; {escaped[6]}; source {escaped[7]}; {escaped[8]}"
            + guidance(row[9:], "  ")
        )
    return "".join(lines)


def verification(result: Records) -> str:
    statuses = Counter(row[2] for row in result.get("attempt"))
    gaps = result.get("evidence_gap")
    return templates.VERIFICATION.substitute(
        title=result.value("outcome").upper(),
        outcome=escape(result.value("outcome")),
        total=len(result.get("original_finding")),
        resolved=statuses["resolved"],
        unresolved=statuses["unresolved"],
        blocked=statuses["blocked"],
        regression_count=len(result.get("regression")),
        attempted_findings=attempted_findings(result),
        regressions=repair_regressions(result),
        checks=checks(result),
        evidence_gaps="\n".join("- " + escape(row[1]) for row in gaps)
        if gaps
        else "No evidence gaps.",
        target_binding=target_binding(result),
        closed_findings=closed_findings(result),
        next_action=escape(result.value("next_action")),
    )


def render(command: str, path: str) -> str:
    text = read_text(path, "result")
    if command == "render-verification":
        return verification(validate_verification(text, path))
    return comprehensive(validate_result(text))
