"""Independent retained-result and published-content checks for the live probe."""

from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path

from assurance_control import git
from darrow_artificer.github import array_value, object_value, text_value
from darrow_artificer.models import Claim
from darrow_artificer.storage import read_object

USAGE_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
)


def records(path: Path) -> list[dict[str, object]]:
    return [
        object_value(json.loads(line)) for line in path.read_text().splitlines() if line
    ]


def one(paths: list[Path]) -> Path:
    assert len(paths) == 1, "expected one bound evidence file"
    return paths[0]


def native_traces(directory: Path) -> list[dict[str, object]]:
    files = sorted(directory.glob("*-events.jsonl"))
    assert files, "missing native app-server evidence"
    return [event for path in files for event in records(path)]


def settled_goal(directory: Path, claim: Claim) -> dict[str, object]:
    """Prove one native session and goal survived every app-server process."""
    assert claim.native is not None and claim.goal_objective
    events = native_traces(directory)
    assert not any(event.get("method") == "thread/goal/cleared" for event in events)
    starts = [event for event in events if event.get("type") == "thread.started"]
    assert {event.get("thread_id") for event in starts} == {claim.native.thread}, (
        "a replacement native session was started"
    )
    settled = [event for event in events if event.get("type") == "artificer.settled"]
    assert settled and settled[-1]["thread_id"] == claim.native.thread
    assert settled[-1]["goal_status"] == "complete", "native goal did not complete"
    return {
        "thread": claim.native.thread,
        "app_server_processes": len(starts),
        "objective_sha256": hashlib.sha256(claim.goal_objective.encode()).hexdigest(),
    }


def public_review(backend: Path, *arguments: str) -> str:
    return subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(backend / "scripts/run_locked.py"),
            *arguments,
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def final_answer(path: Path) -> str:
    payloads = [
        object_value(row["payload"]) for row in records(path) if "payload" in row
    ]
    finals = [value for value in payloads if value.get("phase") == "final_answer"]
    completions = [value for value in payloads if value.get("type") == "task_complete"]
    assert finals and completions, "missing completed native assessment"
    content = finals[-1]["content"]
    assert isinstance(content, list)
    text = "".join(text_value(object_value(part)["text"]) for part in content)
    assert text and completions[-1].get("last_agent_message") == text
    return text


def timestamp(row: dict[str, object]) -> float:
    value = text_value(row["timestamp"]).replace("Z", "+00:00")
    return datetime.fromisoformat(value).timestamp()


RENDERED_HANDOFF = "Complete provider result: [report]("


def tool_texts(output: object) -> list[str]:
    """Texts from a native tool output, unwrapping code-mode JSON chunks."""
    parts = [output] if isinstance(output, str) else array_value(output)
    texts = []
    for part in parts:
        text = part if isinstance(part, str) else object_value(part).get("text")
        if not isinstance(text, str):
            continue
        texts.append(text)
        if text.startswith("{"):
            chunk = json.loads(text)
            if isinstance(chunk, dict) and isinstance(chunk.get("output"), str):
                texts.append(chunk["output"])
    return texts


def row_texts(row: dict[str, object]) -> list[str]:
    if row.get("type") != "response_item":
        return []
    payload = object_value(row["payload"])
    if payload.get("type") == "message" and payload.get("role") == "assistant":
        content = array_value(payload["content"])
        return ["".join(text_value(object_value(part)["text"]) for part in content)]
    if str(payload.get("type", "")).endswith("call_output"):
        return tool_texts(payload.get("output"))
    return []


def assessment_before(path: Path, published_at: float) -> str:
    """The last rendered Verification handoff in the coordinator session.

    A fallback coordinator returns it as its answer; an inline owner renders it
    with the Verification helper before publishing in the same session.
    """
    handoffs = [
        text
        for row in records(path)
        if timestamp(row) < published_at
        for text in row_texts(row)
        if RENDERED_HANDOFF in text
    ]
    assert handoffs, "no rendered assessment completed before publication"
    return handoffs[-1]


def native_reader(home: Path, agent: str) -> tuple[Path, dict[str, object]]:
    found = []
    for path in (home / "sessions").rglob("*.jsonl"):
        metadata = [
            object_value(row["payload"])
            for row in records(path)
            if row.get("type") == "session_meta"
        ]
        assert len(metadata) == 1
        if metadata[0].get("agent_path") == agent:
            found.append((path, metadata[0]))
    assert len(found) == 1, "missing or ambiguous native reader"
    return found[0]


def provider_result(backend: Path, path: Path) -> dict[str, object]:
    public_review(backend, "review-result", "validate", str(path))
    public_review(
        backend,
        "review-result",
        "validate-scope",
        str(path.parent / "scope.json"),
        str(path),
    )
    result = read_object(path)
    assert result["verdict"] == result["standards"] == result["spec"] == "pass"
    assert result["findings"] == [], (
        "retained provider findings cannot clear this fixture"
    )
    expected = public_review(backend, "review-report", "render", str(path))
    assert (path.parent / "review.md").read_text().split() == expected.split()
    return result


def published_content(
    backend: Path, path: Path, repo: Path, commit: str
) -> dict[str, object]:
    scope = read_object(path.parent / "scope.json")
    assert Path(text_value(scope["repository"])).resolve() == repo.resolve()
    assert scope["base"] == git(repo, "rev-parse", "main")
    assert git(repo, "rev-parse", "HEAD") == commit
    assert git(repo, "status", "--porcelain") == ""
    assert (
        git(repo, "diff", "--name-only", text_value(scope["base"]), commit)
        == "config.json"
    )
    assert [
        Path(text_value(name)).resolve() for name in array_value(scope["changed_files"])
    ] == [repo.resolve() / "config.json"]
    public_review(
        backend, "review-scope", "show", "--manifest", str(path.parent / "scope.json")
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "apply",
            "--reverse",
            "--check",
            "--binary",
            text_value(scope["diff"]),
        ],
        check=True,
        capture_output=True,
    )
    return scope


def reader_results(home: Path, directory: Path) -> str:
    parents = set()
    for axis in ("standards", "spec"):
        application = read_object(directory / f"{axis}-route.json")
        path, meta = native_reader(home, text_value(application["agent_id"]))
        text = final_answer(path)
        observed = object_value(json.loads(text))
        assert observed == read_object(directory / f"{axis}.json")
        assert observed["status"] == "pass" and observed["findings"] == []
        parents.add(text_value(meta["parent_thread_id"]))
    assert len(parents) == 1, "assessments must share the bounded coordinator"
    return parents.pop()


def retained_evidence(
    root: Path, home: Path, claim: Claim, commit: str
) -> dict[str, object]:
    backend = home / "skills/darrow-review/backend"
    path = one(list((root / "reviews").glob("**/darrow-review.*/result.json")))
    result = provider_result(backend, path)
    scope = published_content(backend, path, Path(claim.worktree), commit)
    coordinator = reader_results(home, path.parent)
    native_path = one(list((home / "sessions").rglob(f"*{coordinator}.jsonl")))
    published_at = (root / "proposal.json").stat().st_mtime
    assert path.stat().st_mtime < published_at, (
        "review result written after publication"
    )
    assessment = assessment_before(native_path, published_at)
    return {
        "criteria": (Path(claim.worktree) / "SPEC.md").read_text(),
        "check_script": (Path(claim.worktree) / "check.sh").read_text(),
        "published_commit": commit,
        "scope": scope,
        "provider_result": result,
        "provider_report": (path.parent / "review.md").read_text(),
        "assessment": assessment,
        "assessment_before_publication": True,
    }


def actor_usage(path: Path) -> dict[str, object]:
    rows = records(path)
    payloads = {
        kind: [object_value(row["payload"]) for row in rows if row.get("type") == kind]
        for kind in ("session_meta", "turn_context", "event_msg")
    }
    counts = [
        object_value(value["info"])
        for value in payloads["event_msg"]
        if value.get("type") == "token_count" and value.get("info") is not None
    ]
    metadata, contexts = payloads["session_meta"], payloads["turn_context"]
    assert len(metadata) == 1 and contexts and counts
    return {
        "thread": metadata[0]["id"],
        "parent": metadata[0].get("parent_thread_id"),
        "model": contexts[-1]["model"],
        "effort": contexts[-1]["effort"],
        "usage": counts[-1]["total_token_usage"],
    }


def observations(home: Path, thread: str) -> dict[str, object]:
    """Report every native actor under one root session and its whole-tree usage."""
    actors = [
        actor_usage(path) for path in sorted((home / "sessions").rglob("*.jsonl"))
    ]
    roots = [actor for actor in actors if actor["parent"] is None]
    assert len(roots) == 1 and roots[0]["thread"] == thread
    identities = {text_value(actor["thread"]) for actor in actors}
    assert all(
        actor["parent"] in identities for actor in actors if actor["parent"] is not None
    )
    usage = [object_value(actor["usage"]) for actor in actors]
    return {
        "actors": actors,
        "whole_tree_usage": {
            field: sum(int(str(value[field])) for value in usage)
            for field in USAGE_FIELDS
        },
        "dollar_cost": None,
    }
