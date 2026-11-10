"""Reject invalid, blocking and stale evidence through the public Review seam."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from assurance_control import git
from assurance_evidence import (
    assessment_before,
    provider_result,
    public_review,
    published_content,
    settled_goal,
)
from assurance_fixture import installation
from assurance_judge import CHECKS, require_clear
from darrow_artificer.github import object_value, text_value
from darrow_artificer.models import Claim, Native
from darrow_artificer.storage import write_object


@pytest.fixture(scope="module")
def review_cache(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return tmp_path_factory.mktemp("assurance-review-cache")


@pytest.fixture
def evidence(
    tmp_path: Path, review_cache: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, Path, Path, str]:
    site = installation(tmp_path, Path(sys.executable))
    repo = Path(site.grant.checkout)
    git(repo, "switch", "-c", "feat/291-evidence")
    (repo / "config.json").write_text('{"timeoutMs":2500,"retries":3}\n')
    monkeypatch.setenv("DARROW_CACHE_DIR", str(review_cache))
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(tmp_path / "reviews"))
    backend = (
        Path(__file__).resolve().parents[5] / "plugins/capability/darrow-review/backend"
    )
    scope = object_value(
        json.loads(
            public_review(
                backend,
                "review-scope",
                "prepare",
                "--repo",
                str(repo),
                "--base",
                "HEAD",
                "--target",
                "WORKTREE",
            )
        )
    )
    path = Path(text_value(scope["manifest"])).parent / "result.json"
    write_object(
        path,
        {
            "format": "darrow-review-result-v3",
            "standards": "pass",
            "standards_sources": [str(repo / "AGENTS.md")],
            "spec": "pass",
            "spec_source": str(repo / "SPEC.md"),
            "findings": [],
            "risks": ["No additional risks were identified"],
            "next_action": "Return the complete assessment",
            "checks": [
                {
                    "command": "bash check.sh",
                    "applicability": "applicable",
                    "status": "pass",
                    "evidence": "exited 0",
                }
            ],
            "base": scope["base"],
            "target": scope["target"],
            "changed_files": scope["changed_files"],
            "verdict": "pass",
        },
    )
    (path.parent / "review.md").write_text(
        public_review(backend, "review-report", "render", str(path))
    )
    git(repo, "add", "config.json")
    git(repo, "commit", "-m", "fix: configure timeout")
    return backend, path, repo, git(repo, "rev-parse", "HEAD")


def test_valid_retained_result_is_bound_to_the_published_content(
    evidence: tuple[Path, Path, Path, str],
) -> None:
    backend, path, repo, commit = evidence
    assert provider_result(backend, path)["verdict"] == "pass"
    assert published_content(backend, path, repo, commit)["changed_count"] == "1"


def test_corrupted_result_cannot_support_completion(
    evidence: tuple[Path, Path, Path, str],
) -> None:
    backend, path, _, _ = evidence
    path.write_text("{}")
    with pytest.raises(subprocess.CalledProcessError):
        provider_result(backend, path)


def test_retained_blocker_cannot_clear_the_composition(
    evidence: tuple[Path, Path, Path, str],
) -> None:
    backend, path, repo, _ = evidence
    result = object_value(json.loads(path.read_text()))
    result.update(
        {
            "spec": "fail",
            "verdict": "fail",
            "findings": [
                {
                    "axis": "spec",
                    "severity": "high",
                    "disposition": "blocking",
                    "location": "config.json:1",
                    "source": str(repo / "SPEC.md"),
                    "evidence": "timeout is incorrect",
                    "repair_guidance": "Advisory: restore the accepted timeout",
                    "resolution_evidence": "timeoutMs is 2500",
                }
            ],
        }
    )
    write_object(path, result)
    public_review(backend, "review-result", "validate", str(path))
    with pytest.raises(AssertionError):
        provider_result(backend, path)


def test_content_changed_after_assessment_is_stale(
    evidence: tuple[Path, Path, Path, str],
) -> None:
    backend, path, repo, _ = evidence
    (repo / "config.json").write_text('{"timeoutMs":2500, "retries":3}\n')
    git(repo, "commit", "-am", "style: format the candidate")
    with pytest.raises(subprocess.CalledProcessError):
        published_content(backend, path, repo, git(repo, "rev-parse", "HEAD"))


def test_omitted_or_unassessed_criterion_cannot_clear_the_semantic_gate() -> None:
    result: dict[str, object] = {
        "verdict": "pass",
        "checks": dict.fromkeys(CHECKS, True),
        "reason": "Every criterion has current evidence",
    }
    require_clear(result)
    checks = object_value(result["checks"])
    checks["C2"] = False
    with pytest.raises(AssertionError):
        require_clear(result)

    del checks["C2"]
    with pytest.raises(AssertionError):
        require_clear(result)


def delivered(tmp_path: Path) -> Claim:
    return Claim(
        id="claim",
        issue=291,
        activation="activation",
        grant="grant",
        worktree=str(tmp_path),
        branch="feature",
        created_at=0,
        native=Native(thread="original", model="gpt-6-sol", effort="medium"),
        goal_objective="Deliver",
    )


def write_events(path: Path, events: list[dict[str, object]]) -> None:
    path.write_text("\n".join(json.dumps(event) for event in events))


def started(thread: str = "original") -> dict[str, object]:
    return {"type": "thread.started", "thread_id": thread}


def settled(status: str) -> dict[str, object]:
    return {
        "type": "artificer.settled",
        "thread_id": "original",
        "turn_id": "turn",
        "goal_status": status,
    }


def test_native_goal_survives_the_app_server_process_boundary(
    tmp_path: Path,
) -> None:
    write_events(tmp_path / "first-events.jsonl", [started()])
    write_events(tmp_path / "second-events.jsonl", [started(), settled("complete")])
    goal = settled_goal(tmp_path, delivered(tmp_path))
    assert goal["thread"] == "original" and goal["app_server_processes"] == 2


def test_replacement_session_cannot_clear_the_composition(tmp_path: Path) -> None:
    write_events(tmp_path / "first-events.jsonl", [started()])
    write_events(
        tmp_path / "second-events.jsonl", [started("fresh"), settled("complete")]
    )
    with pytest.raises(AssertionError, match="replacement"):
        settled_goal(tmp_path, delivered(tmp_path))


def test_incomplete_or_cleared_goal_cannot_clear_the_composition(
    tmp_path: Path,
) -> None:
    write_events(tmp_path / "first-events.jsonl", [started(), settled("active")])
    with pytest.raises(AssertionError, match="did not complete"):
        settled_goal(tmp_path, delivered(tmp_path))
    cleared: dict[str, object] = {
        "method": "thread/goal/cleared",
        "params": {"threadId": "original"},
    }
    write_events(
        tmp_path / "first-events.jsonl", [started(), cleared, settled("complete")]
    )
    with pytest.raises(AssertionError):
        settled_goal(tmp_path, delivered(tmp_path))


HANDOFF = "Conclusion: clear.\nComplete provider result: [report](</tmp/review.md>)"


def at(second: int, payload: dict[str, object]) -> dict[str, object]:
    return {
        "timestamp": f"2026-11-08T12:00:{second:02d}Z",
        "type": "response_item",
        "payload": payload,
    }


def assistant(text: str) -> dict[str, object]:
    content = [{"type": "output_text", "text": text}]
    return {"type": "message", "role": "assistant", "content": content}


def tool_output(text: str) -> dict[str, object]:
    chunk = json.dumps({"exit_code": 0, "output": text})
    return {"type": "custom_tool_call_output", "output": [{"text": chunk}]}


PUBLISHED_AT = 1794139230.0  # 2026-11-08T12:00:30Z


def test_inline_owner_rendered_handoff_precedes_publication(tmp_path: Path) -> None:
    path = tmp_path / "owner.jsonl"
    write_events(
        path,
        [
            at(10, tool_output(HANDOFF)),
            at(20, assistant("Verification is clear; publishing now.")),
            at(40, assistant("Published.")),
        ],
    )
    assert assessment_before(path, PUBLISHED_AT) == HANDOFF


def test_fallback_coordinator_answer_is_the_handoff(tmp_path: Path) -> None:
    path = tmp_path / "coordinator.jsonl"
    write_events(path, [at(10, assistant(HANDOFF))])
    assert assessment_before(path, PUBLISHED_AT) == HANDOFF


def test_handoff_after_publication_cannot_clear(tmp_path: Path) -> None:
    path = tmp_path / "owner.jsonl"
    write_events(
        path,
        [at(10, assistant("Verification is clear.")), at(40, tool_output(HANDOFF))],
    )
    with pytest.raises(AssertionError, match="before publication"):
        assessment_before(path, PUBLISHED_AT)
