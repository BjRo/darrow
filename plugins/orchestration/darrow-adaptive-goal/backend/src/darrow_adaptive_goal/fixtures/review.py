"""Candidate-bound review observations, including mutation during assessment."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path

from ..common import RefusalError, git_text, repository
from .review_policy import Findings, constrain, policy, report
from .state import Candidate, append, capture, lines, metadata, oid


@dataclass(frozen=True)
class SourceObservation:
    path: Path
    blob: str
    contents: bytes


def observe_source(repo: Path, git_dir: Path) -> SourceObservation | None:
    path = git_dir / "fixture-review-event-path"
    if not path.is_file():
        return None
    rows = lines(path)
    subject = rows[0] if rows else ""
    source = (repo / subject).resolve()
    if not subject or not source.is_file() or not source.is_relative_to(repo):
        raise RefusalError("review subject must be available inside the repository")
    contents = source.read_bytes()
    return SourceObservation(source, oid(repo, contents), contents)


def source_report(observation: SourceObservation | None) -> str:
    if observation is None:
        return ""
    return (
        f"Observed source: {observation.path}\n"
        f"Observed source blob: {observation.blob}\n"
        f"Observed source bytes: {observation.contents!r}\n"
    )


def start_observation(
    repo: Path, git_dir: Path, target: str
) -> SourceObservation | None:
    observation = observe_source(repo, git_dir)
    if observation is None:
        return None
    append(
        repo / ".fixture-state/review-events",
        f"review_start\t{target}\t{observation.blob}\n",
    )
    delay = git_dir / "fixture-review-delay-seconds"
    if delay.is_file():
        wait_for_review(delay)
    return observation


def wait_for_review(path: Path) -> None:
    rows = lines(path)
    if not rows or not re.fullmatch(r"[0-9]+", rows[0]):
        raise RefusalError("invalid review delay")
    time.sleep(int(rows[0]))


def finish_observation(
    repo: Path, target: str, observation: SourceObservation, findings: Findings
) -> None:
    end_oid = git_text(repo, "hash-object", "--", str(observation.path))
    end_target = capture(repo).target
    append(
        repo / ".fixture-state/review-events",
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


def validate_contract(repo: Path, contract: str) -> None:
    if oid(repo, contract.encode()) != "b1d8706dabad37d43795dcba094c36681b029df5":
        raise RefusalError("review capability contract is required")


def preview(repo_path: Path, mode: str, contract: str) -> str:
    """Observe one assessment without consuming its sequence or writing reports."""
    if mode not in {"comprehensive", "verify"}:
        raise RefusalError("review preview requires comprehensive or verify")
    repo = repository(str(repo_path))
    validate_contract(repo, contract)
    candidate = capture(repo)
    state = repo / ".fixture-state"
    invocations = state / "independent-review-invocations"
    require_history(mode, invocations)
    history = lines(invocations)
    git_dir = metadata(repo)
    findings = policy(git_dir, candidate, len(history))
    constrain(findings, mode, candidate.target, history)
    output = report(findings, mode, candidate, repo, git_dir)
    output += source_report(observe_source(repo, git_dir))
    if history:
        output += history_details(findings, state, history)
    return output


def assess(
    repo_path: Path, mode: str, contract: str = "", expected_target: str | None = None
) -> str:
    if mode not in {"comprehensive", "verify", "fingerprint"}:
        raise RefusalError(
            "usage: independent-review-fixture REPOSITORY comprehensive|verify|fingerprint [contract]"
        )
    repo = repository(str(repo_path))
    if mode != "fingerprint":
        validate_contract(repo, contract)
    candidate = capture(repo)
    if expected_target is not None and candidate.target != expected_target:
        raise RefusalError("reader target no longer matches the current candidate")
    if mode == "fingerprint":
        return candidate.target + "\n"
    return review_candidate(repo, mode, candidate)


def review_candidate(repo: Path, mode: str, candidate: Candidate) -> str:
    git_dir = metadata(repo)
    state = repo / ".fixture-state"
    invocations = state / "independent-review-invocations"
    require_history(mode, invocations)
    history = lines(invocations)
    append(state / "independent-review-events", f"review_start\t{candidate.target}\n")
    observation = start_observation(repo, git_dir, candidate.target)
    findings = policy(git_dir, candidate, len(history))
    # Validate comprehensive outcomes before any delayed end observation.
    constrain(findings, mode, candidate.target, [])
    if observation:
        finish_observation(repo, candidate.target, observation, findings)
    constrain(findings, mode, candidate.target, history)
    append(invocations, f"{candidate.target}\t{findings.outcome}\t{mode}\n")
    if observation:
        append(
            state / "review-events", f"review\t{findings.outcome}\t{observation.blob}\n"
        )
    output = report(findings, mode, candidate, repo, git_dir)
    output += source_report(observation)
    return retain_report(output, findings, state)


def retain_report(output: str, findings: Findings, state: Path) -> str:
    history = lines(state / "independent-review-invocations")
    artifact = state / f"review-result-{len(history) - 1}.md"
    output += history_details(findings, state, history)
    output += f"Complete review result: {artifact}\n"
    artifact.write_text(output, encoding="utf-8", newline="\n")
    return output


def history_details(findings: Findings, state: Path, history: list[str]) -> str:
    original = state / "review-result-0.md"
    details = ""
    if (
        findings.outcome == "clear"
        and original.is_file()
        and any(
            row.startswith("Finding R1:")
            for row in original.read_text(encoding="utf-8").splitlines()
        )
    ):
        details += "Finding R1: resolved; original blocking disposition preserved; no direct regression observed.\n"
    original_target = history[0].split("\t")[0]
    details += (
        f"Original target: {original_target}\n"
        f"Original review result: {original}\n"
        "Assessment history (target, outcome, mode):\n" + "\n".join(history) + "\n"
    )
    return details
