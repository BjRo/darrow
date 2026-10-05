"""Bounded synthetic combined assessment; never an owner or repair controller."""

from __future__ import annotations

import tempfile
import time
from pathlib import Path

from ..common import CheckRequiredError, RefusalError
from . import review
from .state import append, checksum, lines, metadata


def prerequisites(state: Path, target: str, mode: str) -> str:
    modes = {"initial": "comprehensive", "follow-up": "verify"}
    if mode not in modes:
        raise RefusalError("initial or follow-up required")
    if lines(state / "check-target") != [target]:
        raise CheckRequiredError("blocked: successful current checks required")
    history = state / "verification-invocations"
    if mode == "initial" and history.exists():
        raise CheckRequiredError("initial verification already recorded")
    if mode == "follow-up" and not lines(history):
        raise CheckRequiredError("follow-up requires initial verification")
    return modes[mode]


def conclusion(target: str, current: str, review_report: str, qa: str) -> str:
    first = review_report.splitlines()[0]
    blocked = {
        "Independent review outcome: inconclusive",
        "Independent review outcome: unavailable",
        "Fix verification: blocked.",
        "Fix verification: inconclusive.",
        "Fix verification: unavailable.",
    }
    if target != current or first in blocked:
        return "blocked"
    if (
        first
        in {
            "Independent review outcome: no blocking findings",
            "Fix verification: clear.",
        }
        and qa == "clear"
    ):
        return "clear"
    return "no-progress" if first == "Fix verification: no_progress." else "progress"


def qa_result(subject: Path) -> tuple[str, str]:
    data = subject.read_bytes()
    return checksum(
        data
    ), "clear" if b"export const CACHE_SIZE = 5;" in data.splitlines() else "blocking"


def report(
    repo: Path,
    target: str,
    mode: str,
    review_report: str,
    qa: str,
    qa_target: str,
    outcome: str,
    artifact: Path,
) -> str:
    result = (
        f"Repository: {repo}\nCandidate: src/config.js cksum {target}, HEAD to WORKTREE\nMode: {mode}\n"
        "Selected: independent code review and QA-like cache assessment\n"
        "Required current check: bash check.sh passed for this candidate.\n"
        "Complete independent review result:\n"
        + review_report
        + f"Complete QA-like result: {qa}; candidate cksum {qa_target}.\n"
    )
    if qa == "blocking":
        observed = "".join(
            row + "\n"
            for row in (repo / "src/config.js").read_text().splitlines()
            if "CACHE_SIZE" in row
        )
        result += (
            "Q1, QA/cache, blocking: CACHE_SIZE must equal 5; observed:\n" + observed
        )
    else:
        result += "Q1, QA/cache: CACHE_SIZE = 5 observed; resolved in follow-up, no direct regression.\n"
    return result + (
        "Acceptance C1: TIMEOUT_MS = 2500 supported by current check.\n"
        "Acceptance C2: RETRY_COUNT = 3 assessed in the complete review result (R1).\n"
        "Acceptance C3: CACHE_SIZE = 5 assessed by QA (Q1).\n"
        f"Conclusion: {outcome}\n"
        "Finding provenance: R1 review/retries; Q1 QA/cache; both blocking when unresolved. No advisories or direct regressions observed.\n"
        f"Target and assessment history: {artifact.parent}/verification-invocations\nComplete review result: {artifact}\n"
    )


def assess(repo: Path, mode: str) -> str:
    repo = repo.resolve()
    state = metadata(repo) / "fixture-state"
    subject = repo / "src/config.js"
    target = checksum(subject.read_bytes())
    review_mode = prerequisites(state, target, mode)
    events = state / "verification-events"
    append(events, f"assessment-start\t{mode}\t{target}\n")
    review_report = review.assess(
        repo, review_mode, "independent-review-skill-contract-v1"
    )
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="\n",
        prefix="review-result.",
        dir=state,
        delete=False,
    ) as stream:
        stream.write(review_report)
        artifact = Path(stream.name)
    append(events, f"review-returned\t{mode}\t{checksum(subject.read_bytes())}\n")
    time.sleep(2)
    qa_target, qa = qa_result(subject)
    append(events, f"qa-returned\t{mode}\t{qa_target}\n")
    outcome = conclusion(target, qa_target, review_report, qa)
    append(state / "verification-invocations", f"{mode}\t{target}\t{outcome}\n")
    output = report(repo, target, mode, review_report, qa, qa_target, outcome, artifact)
    append(events, f"assessment-returned\t{mode}\t{checksum(subject.read_bytes())}\n")
    return output
