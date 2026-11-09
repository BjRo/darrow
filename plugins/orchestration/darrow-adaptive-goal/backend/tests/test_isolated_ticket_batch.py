from __future__ import annotations

import json
import runpy
import subprocess
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from evals import isolated_ticket_batch as batch


def command(root: Path, *arguments: str) -> str:
    return subprocess.check_output(
        ["git", *arguments], cwd=root, text=True, stderr=subprocess.STDOUT
    ).strip()


def test_receipts_observe_real_worker_and_cherry_pick_effects(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "delivery"
    root.mkdir()
    command(root, "init", "-b", "main")
    command(root, "config", "user.name", "Fixture")
    command(root, "config", "user.email", "fixture@example.invalid")
    command(root, "commit", "--allow-empty", "-m", "initial")
    (root / ".fixture-state").mkdir()
    hook = root / ".git/hooks/post-commit"
    hook.write_text(f'#!/bin/sh\npython3 "{Path(batch.__file__).resolve()}" record\n')
    hook.chmod(0o755)
    worker = tmp_path / "worker"
    command(root, "worktree", "add", "-b", "feat/issue-41-worker", str(worker))
    (worker / "change.txt").write_text("implementation\n")
    command(worker, "add", "change.txt")
    command(worker, "commit", "-m", "implement")
    commit = command(worker, "rev-parse", "HEAD")
    monkeypatch.chdir(root)
    batch.require_unattributed(commit)
    command(root, "cherry-pick", commit)
    monkeypatch.chdir(root)
    records = batch.receipts()
    assert [row["branch"] for row in records] == ["feat/issue-41-worker", "main"]
    assert records[0]["commit"] == commit
    assert records[1]["commit"] == command(root, "rev-parse", "HEAD")
    assert records[0]["time_ns"] < records[1]["time_ns"]
    dependent_base = command(root, "rev-parse", "HEAD")
    initial = batch.Worker("initial", 1, 2, {commit})
    (worker / "repair.txt").write_text("later assurance repair\n")
    command(worker, "add", "repair.txt")
    command(worker, "commit", "-m", "repair after dependent start")
    batch.verify_prerequisites(dependent_base, [initial])
    with pytest.raises(AssertionError, match="unlanded"):
        batch.verify_prerequisites(dependent_base + "^", [initial])
    with pytest.raises(AssertionError, match="unlanded"):
        batch.require_landed(dependent_base, command(worker, "rev-parse", "HEAD"))
    records[0]["commit"] = "0" * 40
    (root / ".fixture-state/batch-commits.jsonl").write_text(
        "\n".join(json.dumps(row) for row in records) + "\n"
    )
    with pytest.raises(AssertionError, match="actual ref effect"):
        batch.receipts()
    command(
        worker,
        "commit",
        "--allow-empty",
        "-m",
        "feat: forbidden",
        "-m",
        "Co-Authored-By: Claude <ai@example.invalid>",
    )
    with pytest.raises(AssertionError, match="attribution refusal"):
        batch.require_unattributed(command(worker, "rev-parse", "HEAD"))


@settings(derandomize=True, deadline=None, max_examples=100)
@given(st.integers(min_value=0, max_value=1000))
def test_barrier_accepts_overlapping_workers_followed_by_landing(offset: int) -> None:
    workers = [
        ("a", offset + 1, offset + 4),
        ("b", offset + 2, offset + 5),
        ("c", offset + 10, offset + 12),
    ]
    batch.verify_barrier(
        [batch.Worker(name, start, stop, set(), stop) for name, start, stop in workers],
        [{"time_ns": offset + 7}, {"time_ns": offset + 9}],
        [(offset + 6, offset + 8), (offset + 8, offset + 10)],
    )


@pytest.mark.parametrize(
    ("workers", "spans", "diagnostic"),
    [
        ([("a", 1, 4), ("a", 2, 5), ("c", 10, 12)], [(6, 8)], "own worker"),
        ([("a", 1, 2), ("b", 3, 5), ("c", 10, 12)], [(6, 8)], "did not overlap"),
        ([("a", 1, 4), ("b", 2, 8), ("c", 10, 12)], [(6, 8)], "whole batch settled"),
        ([("a", 1, 4), ("b", 2, 5), ("c", 8, 12)], [(6, 8)], "prerequisite landings"),
    ],
)
def test_barrier_rejects_invalid_native_order(
    workers: list[tuple[str, int, int]], spans: list[tuple[int, int]], diagnostic: str
) -> None:
    with pytest.raises(AssertionError, match=diagnostic):
        batch.verify_barrier(
            [
                batch.Worker(name, start, stop, set(), stop)
                for name, start, stop in workers
            ],
            [{"time_ns": 7}, {"time_ns": 9}],
            spans,
        )


@pytest.mark.parametrize("finished", [2, None])
def test_delayed_owner_notification_cannot_establish_worker_overlap(
    finished: int | None,
) -> None:
    workers = [
        batch.Worker("a", 1, 5, {"a"}, finished),
        batch.Worker("b", 3, 6, {"b"}, 6),
        batch.Worker("c", 10, 12, {"c"}, 12),
    ]
    with pytest.raises(
        AssertionError, match=r"did not overlap|missing actual worker finish"
    ):
        batch.verify_barrier(
            workers, [{"time_ns": 8}, {"time_ns": 9}], [(7, 8), (8, 9)]
        )


def test_worker_identity_requires_returned_real_commit() -> None:
    assert batch.mentions("returned abcdef1", {"abcdef1" + "0" * 33})
    assert not batch.mentions("returned abcdef2", {"abcdef1" + "0" * 33})
    assert not batch.mentions("no returned commit", {"abcdef1" + "0" * 33})


def test_dependency_evidence_uses_first_return_before_assurance_repair() -> None:
    initial, repair = "abcdef1" + "0" * 33, "abcdef2" + "0" * 33
    rows = [
        {
            "payload": {
                "type": "task_complete",
                "turn_id": "initial",
                "last_agent_message": initial,
            }
        },
        {
            "payload": {
                "type": "task_complete",
                "turn_id": "repair",
                "last_agent_message": repair,
            }
        },
    ]
    completed = batch.codex_completion(rows, {initial, repair})
    assert completed is not None
    assert completed["payload"]["turn_id"] == "initial"
    assert batch.returned_commits(
        completed["payload"]["last_agent_message"], {initial, repair}
    ) == {initial}


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("defect", ["none", "route", "completion", "commit"])
def test_native_worker_identity_controls(
    host: str, defect: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    helpers = (
        Path(__file__).resolve().parents[4]
        / "capability/darrow-review/backend/tests/evals"
    )
    monkeypatch.syspath_prepend(str(helpers))
    native = runpy.run_path(str(helpers / f"native_{host}_routes.py"))
    commits = {"abcdef1" + "0" * 33}
    if host == "codex":
        captured = codex_records(helpers, tmp_path, defect)

        def operation() -> batch.Worker:
            return batch.codex_worker(native, "root", captured, commits)
    else:
        files = claude_records(helpers, tmp_path, defect)

        def operation() -> batch.Worker:
            return batch.claude_worker(native, "root", files, commits)

    if defect == "none":
        worker = operation()
        assert worker.identity and worker.accepted < worker.settled
        assert worker.returned == commits
    else:
        with pytest.raises(AssertionError):
            operation()


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("later", [False, True])
def test_actual_finish_is_initial_return_not_later_repair_or_ambiguous_duplicate(
    host: str, later: bool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    helpers = (
        Path(__file__).resolve().parents[4]
        / "capability/darrow-review/backend/tests/evals"
    )
    monkeypatch.syspath_prepend(str(helpers))
    native = runpy.run_path(str(helpers / f"native_{host}_routes.py"))
    commits = {"abcdef1" + "0" * 33}
    timestamp = "2026-01-01T00:00:04Z" if later else "2026-01-01T00:00:01.750Z"
    if host == "codex":
        captured = codex_records(helpers, tmp_path, "none")
        duplicate = json.loads(json.dumps(captured["child-0"][-1]))
        duplicate["timestamp"] = timestamp
        duplicate["payload"]["turn_id"] = (
            "later-repair" if later else duplicate["payload"]["turn_id"]
        )
        captured["child-0"].append(duplicate)

        def operation() -> batch.Worker:
            return batch.codex_worker(native, "root", captured, commits)
    else:
        files = claude_records(helpers, tmp_path, "none")
        name = "project/root/subagents/agent-worker.jsonl"
        duplicate = json.loads(files[name])
        duplicate["timestamp"] = timestamp
        files[name] += "\n" + json.dumps(duplicate)

        def operation() -> batch.Worker:
            return batch.claude_worker(native, "root", files, commits)

    if later:
        assert operation().finished == batch.stamp(
            {"timestamp": "2026-01-01T00:00:01.500Z"}
        )
    else:
        with pytest.raises(AssertionError, match="completion"):
            operation()


def codex_records(
    helpers: Path, view: Path, defect: str
) -> dict[str, list[dict[str, object]]]:
    builder = runpy.run_path(str(helpers / "native_fixture.py"))
    builder["retain_native"](
        view,
        [
            {
                "type": "darrow.codex_native_spawn",
                "status": "accepted",
                "agent_ref": "worker",
                "task_name": "issue_41_worker",
                "review_axis": "implementation",
                "fork_turns": "none",
                "model": "gpt-6.1-sol",
                "reasoning_effort": "medium",
            }
        ],
    )
    captures = {
        name: [
            json.loads(line)
            for line in (view / f"codex/{name}.jsonl").read_text().splitlines()
        ]
        for name in ["root", "child-0"]
    }
    returned = "return " + ("abcdef2" if defect == "commit" else "abcdef1")
    child = captures["child-0"]
    child[1]["payload"]["effort"] = "low" if defect == "route" else "medium"
    child[3]["payload"]["content"][0]["text"] = returned
    child[4]["payload"]["last_agent_message"] = returned
    child[4]["timestamp"] = "2026-01-01T00:00:01.500Z"
    if defect == "completion":
        child.pop()
    for row in captures["root"]:
        row["timestamp"] = "2026-01-01T00:00:01Z"
    captures["root"].append(
        {
            "timestamp": "2026-01-01T00:00:02Z",
            "payload": {
                "type": "item_completed",
                "item": {"id": "subagent-completed-child-0"},
            },
        }
    )
    return captures


def claude_records(helpers: Path, view: Path, defect: str) -> dict[str, str]:
    builder = runpy.run_path(str(helpers / "native_claude_fixture.py"))
    subagent = "darrow-adaptive-goal:adaptive-goal-sonnet-5-5-medium"
    builder["retain_claude"](
        view,
        [
            {
                "type": "darrow.review_agent_launch",
                "agent_id": "worker",
                "review_axis": "implementation",
                "subagent_type": subagent,
                "batch": 0,
            }
        ],
    )
    files = {
        str(path.relative_to(view / "claude")): path.read_text()
        for path in (view / "claude").rglob("*")
        if path.is_file()
    }
    child = "project/root/subagents/agent-worker"
    meta = json.loads(files[child + ".meta.json"])
    meta["finished"] = defect != "completion"
    files[child + ".meta.json"] = json.dumps(meta)
    row = json.loads(files[child + ".jsonl"])
    row["message"]["model"] = "claude-sonnet-5-5"
    row["effort"] = "low" if defect == "route" else "medium"
    row["timestamp"] = "2026-01-01T00:00:01.500Z"
    row["message"]["stop_reason"] = "end_turn"
    row["message"]["content"] = [
        {"type": "text", "text": "abcdef2" if defect == "commit" else "abcdef1"}
    ]
    files[child + ".jsonl"] = json.dumps(row)
    parent = [json.loads(line) for line in files["project/root.jsonl"].splitlines()]
    parent[0]["timestamp"] = "2026-01-01T00:00:01Z"
    parent[1]["timestamp"] = "2026-01-01T00:00:02Z"
    parent[1]["message"]["content"][0]["content"] = "return " + (
        "abcdef2" if defect == "commit" else "abcdef1"
    )
    files["project/root.jsonl"] = "\n".join(json.dumps(row) for row in parent)
    return files


@pytest.mark.parametrize(
    "defect", ["none", "identity", "acceptance", "delivery", "child"]
)
def test_claude_retained_worker_returns_first_commit_after_blocker(
    defect: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    helpers = (
        Path(__file__).resolve().parents[4]
        / "capability/darrow-review/backend/tests/evals"
    )
    monkeypatch.syspath_prepend(str(helpers))
    native = runpy.run_path(str(helpers / "native_claude_routes.py"))
    files = claude_records(helpers, tmp_path, "commit")
    parent = [json.loads(line) for line in files["project/root.jsonl"].splitlines()]
    parent[1]["message"]["content"][0]["content"] = "Blocked: no commit"
    parent.extend(claude_continuation(defect))
    files["project/root.jsonl"] = "\n".join(json.dumps(row) for row in parent)
    child = "project/root/subagents/agent-worker.jsonl"
    completion = json.loads(files[child])
    completion["timestamp"] = "2026-01-01T00:00:05Z"
    completion["message"]["stop_reason"] = "end_turn"
    completion["message"]["content"] = [
        {"type": "text", "text": "abcdef2" if defect == "child" else "abcdef1"}
    ]
    files[child] += "\n" + json.dumps(completion)
    if defect == "none":
        worker = batch.claude_worker(native, "root", files, {"abcdef1" + "0" * 33})
        assert worker.identity == "worker"
        assert worker.settled == batch.stamp(parent[-1])
        assert worker.returned == {"abcdef1" + "0" * 33}
    else:
        with pytest.raises(AssertionError):
            batch.claude_worker(native, "root", files, {"abcdef1" + "0" * 33})


def claude_continuation(defect: str) -> list[dict[str, object]]:
    notification = (
        "<task-notification><task-id>worker</task-id>"
        "<tool-use-id>resume</tool-use-id><status>completed</status>"
        "<result>returned abcdef1</result></task-notification>"
    )
    return [
        {
            "type": "assistant",
            "timestamp": "2026-01-01T00:00:03Z",
            "message": {
                "content": [
                    {
                        "type": "tool_use",
                        "name": "SendMessage",
                        "id": "resume",
                        "input": {"to": "other" if defect == "identity" else "worker"},
                    }
                ]
            },
        },
        {
            "type": "user",
            "timestamp": "2026-01-01T00:00:04Z",
            "toolUseResult": {
                "success": defect != "acceptance",
                "resumedAgentId": "worker",
            },
            "message": {
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "resume",
                        "content": "accepted",
                    }
                ]
            },
        },
        {
            "type": "attachment",
            "timestamp": "2026-01-01T00:00:06Z",
            "attachment": {
                "type": "queued_command",
                "commandMode": "task-notification",
                "origin": {
                    "kind": "task-notification",
                    "producer": "other" if defect == "delivery" else "session-task",
                },
                "prompt": notification,
            },
        },
    ]


@pytest.mark.parametrize(
    "defect", ["none", "missing-skill", "raw-git", "refused", "wrong-commit"]
)
def test_claude_commit_capability_receipt(defect: str) -> None:
    def blocks(row: dict[str, object]) -> object:
        return row["content"]

    calls = [
        {
            "type": "tool_use",
            "name": "Skill",
            "input": {
                "skill": "darrow-git:create-commit"
                if defect != "missing-skill"
                else "other"
            },
        },
        {
            "type": "tool_use",
            "id": "commit",
            "name": "Bash",
            "input": {
                "command": "git commit -m 'feat: change'"
                if defect == "raw-git"
                else "uv run run_locked.py darrow-create-commit commit -m 'feat: change'"
            },
        },
    ]
    result = {
        "type": "tool_result",
        "tool_use_id": "commit",
        "is_error": defect == "refused",
        "content": "abcdef2" if defect == "wrong-commit" else "abcdef1",
    }
    rows = [
        {"type": "assistant", "content": calls},
        {"type": "user", "content": [result]},
    ]
    text = "\n".join(json.dumps(row) for row in rows)
    native = {"blocks": blocks}
    if defect == "none":
        batch.claude_commit_calls(native, text, {"abcdef1" + "0" * 33})
    else:
        with pytest.raises(AssertionError):
            batch.claude_commit_calls(native, text, {"abcdef1" + "0" * 33})
    assert batch.commit_skill_read(
        {
            "name": "Read",
            "input": {"file_path": "/installed/skills/create-commit/SKILL.md"},
        }
    )


def test_claude_execution_spans_exclude_api_request_copies() -> None:
    def blocks(row: dict[str, object]) -> object:
        return row["content"]

    call = {"type": "tool_use", "id": "landing", "name": "Bash"}
    result = {"type": "tool_result", "tool_use_id": "landing"}
    rows = [
        {"type": "assistant", "timestamp": "2026-01-01T00:00:01Z", "content": [call]},
        {"type": "api-request-blob", "content": [call]},
        {"type": "user", "timestamp": "2026-01-01T00:00:02Z", "content": [result]},
        {"type": "api-request-blob", "content": [result]},
    ]
    assert batch.claude_spans(
        {"blocks": blocks}, "\n".join(json.dumps(row) for row in rows)
    ) == [(batch.stamp(rows[0]), batch.stamp(rows[2]))]
