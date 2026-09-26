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


def guidance(item: dict[str, str], prefix: str = "") -> str:
    if "repair_guidance" not in item:
        return ""
    return (
        f"\n{prefix}- **Repair guidance (advisory):** {escape(item['repair_guidance'])}"
        f"\n{prefix}- **Resolution evidence:** {escape(item['resolution_evidence'])}"
    )


def checks(result: Records) -> str:
    return "\n".join(
        f"- **{row['status'].upper()}** ({escape(row['applicability'])}) — {escape(row['command'])}: {escape(row['evidence'])}"
        for row in result.items("checks")
    )


def findings(result: Records) -> str:
    blocks = [
        templates.FINDING.substitute(
            index=index,
            severity=row["severity"].upper(),
            disposition=row["disposition"].upper(),
            axis=row["axis"].title(),
            location=escape(row["location"]),
            source=escape(row["source"]),
            evidence=escape(row["evidence"]),
            guidance=guidance(row),
        )
        for index, row in enumerate(result.items("findings"), 1)
    ]
    return "\n" + "\n\n".join(blocks) if blocks else "No findings."


def comprehensive(result: Records) -> str:
    verdict = result.value("verdict")
    total = len(result.items("findings"))
    blocking = sum(row["disposition"] == "blocking" for row in result.items("findings"))
    return templates.COMPREHENSIVE.substitute(
        title=verdict.upper(),
        verdict=escape(verdict),
        total=total,
        blocking=blocking,
        advisory=total - blocking,
        findings=findings(result),
        checks=checks(result),
        risks="\n".join("- " + escape(row) for row in result.strings("risks")),
        next_action=escape(result.value("next_action")),
        base=escape(result.value("base")),
        target=escape(result.value("target")),
        changed_files="".join(
            "\n  - " + escape(row) for row in result.strings("changed_files")
        ),
        standards=escape(result.value("standards")),
        standards_sources="\n".join(
            "  - " + escape(row) for row in result.strings("standards_sources")
        ),
        spec=escape(result.value("spec")),
        spec_source=escape(result.value("spec_source")),
    )


def attempted_findings(result: Records) -> str:
    originals = result.keyed("original_findings")
    blocks = []
    for index, row in enumerate(result.items("attempts"), 1):
        original = originals[row["key"]]
        blocks.append(
            templates.ATTEMPT.substitute(
                index=index,
                identity=escape(row["key"]),
                status=row["status"].upper(),
                progress=row["progress"].upper(),
                severity=original["severity"].upper(),
                disposition=escape(original["disposition"]),
                location=escape(original["location"]),
                source=escape(original["source"]),
                original_evidence=escape(original["evidence"]),
                guidance=guidance(original),
                current_evidence=escape(row["evidence"]),
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
            identity=escape(row["key"]),
            status=row["status"].upper(),
            progress=row["progress"].upper(),
            severity=row["severity"].upper(),
            axis=escape(row["axis"]),
            cause=escape(row["caused_by"]),
            location=escape(row["location"]),
            source=escape(row["source"]),
            evidence=escape(row["evidence"]),
            guidance=guidance(row),
        )
        for index, row in enumerate(result.items("regressions"), 1)
    ]
    return "\n" + "\n\n".join(blocks) if blocks else "No repair-caused regressions."


def target_binding(result: Records) -> str:
    history = result.strings("history_targets")
    earlier_targets = (
        "\n- **Earlier targets:**" + "".join("\n  - " + escape(row) for row in history)
        if history
        else ""
    )
    return templates.TARGET_BINDING.substitute(
        original=escape(result.value("original_target")),
        prior=escape(result.value("prior_target")),
        current=escape(result.value("current_target")),
        checksum=escape(result.object("previous_verification")["checksum"]),
        artifact=escape(result.object("previous_verification")["path"]),
        earlier_targets=earlier_targets,
    )


def closed_findings(result: Records) -> str:
    lines = []
    for row in result.items("original_findings"):
        lines.append(
            f"\n- {escape(row['key'])} — {escape(row['axis'])} #{escape(row['order'])}, {escape(row['severity'])}/{escape(row['disposition'])}; {escape(row['location'])}; source {escape(row['source'])}; {escape(row['evidence'])}"
            + guidance(row, "  ")
        )
    return "".join(lines)


def verification(result: Records) -> str:
    statuses = Counter(row["status"] for row in result.items("attempts"))
    gaps = result.strings("evidence_gaps")
    return templates.VERIFICATION.substitute(
        title=result.value("outcome").upper(),
        outcome=escape(result.value("outcome")),
        total=len(result.items("original_findings")),
        resolved=statuses["resolved"],
        unresolved=statuses["unresolved"],
        blocked=statuses["blocked"],
        regression_count=len(result.items("regressions")),
        attempted_findings=attempted_findings(result),
        regressions=repair_regressions(result),
        checks=checks(result),
        evidence_gaps="\n".join("- " + escape(row) for row in gaps)
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
