"""Synthetic outcomes and human reports for the independent-review eval seam."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from ..common import RefusalError, read_text
from .state import Candidate, lines


@dataclass
class Findings:
    outcome: str = "clear"
    failure: str = "Fixture policy rejects this candidate"
    advisory: str = ""
    unrelated: str = ""


def sequence(path: Path, invocation: int) -> Findings:
    rows = lines(path)
    if invocation >= len(rows) or not rows[invocation]:
        raise RefusalError("review sequence exhausted")
    # Bash's tab IFS coalesces empty fields; retain that fixture contract.
    fields = re.split(r"\t+", rows[invocation].strip("\t"), maxsplit=3)
    fields += [""] * (4 - len(fields))
    result = Findings(*fields)
    allowed = {
        "clear",
        "blocking",
        "continue",
        "no_progress",
        "blocked",
        "inconclusive",
        "unavailable",
    }
    if result.outcome not in allowed:
        raise RefusalError("invalid review sequence outcome")
    if (
        result.outcome in {"blocking", "continue", "no_progress", "blocked"}
        and not result.failure
    ):
        raise RefusalError("review sequence requires failure evidence")
    return result


def policy(git_dir: Path, candidate: Candidate, invocation: int) -> Findings:
    path = git_dir / "fixture-review-sequence"
    if path.is_file():
        return sequence(path, invocation)
    for filename, outcome in (
        ("inconclusive", "inconclusive"),
        ("blocked", "unavailable"),
        ("fail", "blocking"),
    ):
        if (git_dir / f"fixture-review-{filename}").is_file():
            return Findings(outcome)
    patterns = lines(git_dir / "fixture-review-reject-pattern")
    if patterns and patterns[0] and patterns[0].encode() in candidate.packet:
        return Findings(
            "blocking",
            f"Fixture policy rejects changed content containing: {patterns[0]}",
        )
    return Findings()


def constrain(findings: Findings, mode: str, target: str, history: list[str]) -> None:
    if mode == "comprehensive":
        if findings.outcome not in {"clear", "blocking", "inconclusive", "unavailable"}:
            raise RefusalError("comprehensive fixture outcome is invalid")
        return
    if findings.outcome == "blocking":
        findings.outcome = "continue"
    prior_targets = {row.split("\t")[0] for row in history}
    if (
        findings.outcome not in {"inconclusive", "unavailable", "blocked"}
        and target in prior_targets
    ):
        findings.outcome = "no_progress"
        findings.failure = "Target fingerprint repeats an earlier convergence state"


def conclusion(findings: Findings, mode: str) -> str:
    if mode == "verify":
        return f"Fix verification: {findings.outcome}.\n"
    wording = {"clear": "no blocking findings", "blocking": "blocking findings"}
    return f"Independent review outcome: {wording.get(findings.outcome, findings.outcome)}\n"


def details(findings: Findings, git_dir: Path) -> str:
    outcome = findings.outcome
    if outcome == "clear":
        return "Summary: The current change has no blocking findings against the supplied goal and repository instructions.\n"
    if outcome in {"blocking", "continue", "no_progress"}:
        guidance = git_dir / "fixture-review-repair-guidance"
        extra = (
            read_text(guidance, "repair guidance is unreadable")
            if guidance.exists()
            else ""
        )
        return f"Blocking finding: {findings.failure}\n" + extra
    gaps = {
        "blocked": findings.failure,
        "inconclusive": "The review could not reach a reliable conclusion from the available evidence.",
        "unavailable": "Required independent review evidence is unavailable.",
    }
    return f"Evidence gap: {gaps[outcome]}\n"


def report(
    findings: Findings, mode: str, candidate: Candidate, repo: Path, git_dir: Path
) -> str:
    result = conclusion(findings, mode) + f"Reviewed target: {candidate.target}\n"
    result += "".join(f"Changed file: {repo / name}\n" for name in candidate.changed)
    result += details(findings, git_dir)
    for label, value in (
        ("Advisory finding", findings.advisory),
        ("Unrelated observation excluded", findings.unrelated),
    ):
        if value:
            result += f"{label}: {value}\n"
    return result
