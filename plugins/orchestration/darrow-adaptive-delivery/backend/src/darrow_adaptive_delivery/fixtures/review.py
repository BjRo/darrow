"""Candidate-bound review observations, including mutation during assessment."""

from __future__ import annotations

import re
import time
from pathlib import Path

from ..common import RefusalError, git_text, repository
from .review_policy import Findings, constrain, policy, report
from .state import Candidate, append, capture, lines, metadata, oid


def start_observation(repo: Path, git_dir: Path, target: str) -> tuple[str, str] | None:
    path = git_dir / "fixture-review-event-path"
    if not path.is_file():
        return None
    rows = lines(path)
    subject = rows[0] if rows else ""
    if not subject or not (repo / subject).is_file():
        raise RefusalError("review subject is unavailable")
    subject_oid = git_text(repo, "hash-object", "--", subject)
    append(
        git_dir / "fixture-state/review-events",
        f"review_start\t{target}\t{subject_oid}\n",
    )
    delay = git_dir / "fixture-review-delay-seconds"
    if delay.is_file():
        wait_for_review(delay)
    return subject, subject_oid


def wait_for_review(path: Path) -> None:
    rows = lines(path)
    if not rows or not re.fullmatch(r"[0-9]+", rows[0]):
        raise RefusalError("invalid review delay")
    time.sleep(int(rows[0]))


def finish_observation(
    repo: Path, git_dir: Path, target: str, subject: str, findings: Findings
) -> None:
    end_oid = git_text(repo, "hash-object", "--", subject)
    end_target = capture(repo).target
    append(
        git_dir / "fixture-state/review-events",
        f"review_end\t{end_target}\t{end_oid}\n",
    )
    if end_target != target:
        findings.outcome = "inconclusive"
        findings.failure = (
            "Reviewed worktree changed before the review response returned"
        )


def require_history(mode: str, path: Path) -> None:
    if mode == "comprehensive" and path.is_file():
        raise RefusalError(
            "comprehensive review already established the closed finding set"
        )
    if mode == "verify" and not path.is_file():
        raise RefusalError(
            "fix verification requires the original comprehensive review"
        )


def assess(repo_path: Path, mode: str, contract: str = "") -> str:
    if mode not in {"comprehensive", "verify", "fingerprint"}:
        raise RefusalError(
            "usage: independent-review-fixture REPOSITORY comprehensive|verify|fingerprint [contract]"
        )
    repo = repository(str(repo_path))
    if (
        mode != "fingerprint"
        and oid(repo, contract.encode()) != "b1d8706dabad37d43795dcba094c36681b029df5"
    ):
        raise RefusalError("review capability contract is required")
    candidate = capture(repo)
    if mode == "fingerprint":
        return candidate.target + "\n"
    return review_candidate(repo, mode, candidate)


def review_candidate(repo: Path, mode: str, candidate: Candidate) -> str:
    git_dir = metadata(repo)
    state = git_dir / "fixture-state"
    invocations = state / "independent-review-invocations"
    require_history(mode, invocations)
    history = lines(invocations)
    append(state / "independent-review-events", f"review_start\t{candidate.target}\n")
    observation = start_observation(repo, git_dir, candidate.target)
    findings = policy(git_dir, candidate, len(history))
    # Validate comprehensive outcomes before any delayed end observation.
    constrain(findings, mode, candidate.target, [])
    if observation:
        finish_observation(repo, git_dir, candidate.target, observation[0], findings)
    constrain(findings, mode, candidate.target, history)
    append(invocations, f"{candidate.target}\t{findings.outcome}\t{mode}\n")
    if observation:
        append(
            state / "review-events", f"review\t{findings.outcome}\t{observation[1]}\n"
        )
    return report(findings, mode, candidate, repo, git_dir)
