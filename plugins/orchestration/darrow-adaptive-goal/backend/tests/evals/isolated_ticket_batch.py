"""Observe one native ticket batch through returned commits and real Git effects.

Fixture-only receipts use the host's UTC clock. They corroborate Git objects and
native request/result boundaries; encrypted commands and assignments stay opaque.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import runpy
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, NamedTuple, TypeVar

T = TypeVar("T")


class Worker(NamedTuple):
    identity: str
    accepted: int
    settled: int
    returned: set[str]
    finished: int | None = None


def git(*arguments: str) -> str:
    return subprocess.check_output(["git", *arguments], text=True).strip()


def record() -> None:
    common = Path(git("rev-parse", "--path-format=absolute", "--git-common-dir"))
    receipt = common.parent / ".fixture-state/batch-commits.jsonl"
    event = {
        "time_ns": time.time_ns(),
        "branch": git("branch", "--show-current"),
        "commit": git("rev-parse", "HEAD"),
    }
    with receipt.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(event) + "\n")


def stamp(row: dict[str, Any]) -> int:
    value = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
    return int(value.timestamp() * 1_000_000_000)


def mentions(text: str, commits: set[str]) -> bool:
    return bool(returned_commits(text, commits))


def returned_commits(text: str, commits: set[str]) -> set[str]:
    tokens = re.findall(r"\b[0-9a-f]{7,40}\b", text)
    return {
        commit
        for commit in commits
        if any(commit.startswith(token) for token in tokens)
    }


def one(values: list[T], label: str) -> T:
    assert len(values) == 1, f"expected one {label}, found {len(values)}"
    return values[0]


def payloads(rows: list[dict[str, Any]], kind: str) -> list[tuple[int, dict[str, Any]]]:
    return [
        (i, row["payload"])
        for i, row in enumerate(rows)
        if row.get("payload", {}).get("type") == kind
    ]


def codex_completion(
    rows: list[dict[str, Any]], commits: set[str]
) -> dict[str, Any] | None:
    matches = [
        row
        for row in rows
        if row.get("payload", {}).get("type") == "task_complete"
        and mentions(row["payload"].get("last_agent_message", ""), commits)
    ]
    return matches[0] if matches else None


def codex_acceptance(rows: list[dict[str, Any]], child: str, agent: str) -> int:
    starts = [
        (i, p["item"])
        for i, p in payloads(rows, "item_completed")
        if p.get("item", {}).get("type") == "SubAgentActivity"
        and p["item"].get("kind") == "started"
        and p["item"].get("agent_thread_id") == child
    ]
    started, item = one(starts, "accepted worker start")
    called, call = one(
        [
            (i, p)
            for i, p in payloads(rows, "function_call")
            if p.get("call_id") == item["id"]
        ],
        "worker request",
    )
    arguments = json.loads(call["arguments"])
    assert call["name"] == "spawn_agent" and arguments["fork_turns"] == "none"
    assert [arguments["model"], arguments["reasoning_effort"]] == [
        "gpt-6.1-sol",
        "medium",
    ]
    accepted, output = one(
        [
            (i, p)
            for i, p in payloads(rows, "function_call_output")
            if p.get("call_id") == item["id"]
        ],
        "worker acceptance",
    )
    assert (
        called < started < accepted
        and json.loads(output["output"])["task_name"] == agent
    )
    return stamp(rows[accepted])


def codex_worker(
    native: dict[str, Any], root: str, captured: dict[str, Any], commits: set[str]
) -> Worker:
    matches = []
    for child, rows in captured.items():
        meta = native["metadata"](rows)
        completion = codex_completion(rows, commits)
        if meta.get("parent_thread_id") == root and completion is not None:
            contexts = [
                row["payload"] for row in rows if row.get("type") == "turn_context"
            ]
            if all(
                [row.get("model"), row.get("effort")] == ["gpt-6.1-sol", "medium"]
                for row in contexts
            ):
                matches.append((child, meta, completion))
    child, meta, completion = one(matches, "commit-returning implementation worker")
    finished = codex_return(native, captured[child], completion)
    native["effective_route"](captured[child], ["gpt-6.1-sol", "medium"])
    accepted = codex_acceptance(captured[root], child, meta["agent_path"])
    returned = [
        row
        for row in captured[root]
        if row.get("payload", {}).get("item", {}).get("id")
        == "subagent-completed-" + completion["payload"]["turn_id"]
    ]
    settled = stamp(one(returned, "owner-observed worker completion"))
    assert accepted < finished <= settled
    return Worker(
        child,
        accepted,
        settled,
        returned_commits(completion["payload"]["last_agent_message"], commits),
        finished,
    )


def codex_return(
    native: dict[str, Any], rows: list[dict[str, Any]], completion: dict[str, Any]
) -> int:
    turn = completion["payload"]["turn_id"]
    end, _ = one(
        [
            (i, p)
            for i, p in payloads(rows, "task_complete")
            if p.get("turn_id") == turn
        ],
        "actual worker turn completion",
    )
    start, _ = one(
        [(i, p) for i, p in payloads(rows, "task_started") if p.get("turn_id") == turn],
        "returned worker turn start",
    )
    assert start < end
    native["completed"](rows[start : end + 1])
    return stamp(rows[end])


def codex_spans(rows: list[dict[str, Any]]) -> list[tuple[int, int]]:
    spans = []
    for i, call in payloads(rows, "custom_tool_call"):
        if call.get("name") == "exec":
            ends = [
                j
                for j, p in payloads(rows, "custom_tool_call_output")
                if p.get("call_id") == call["call_id"]
            ]
            spans.append(
                (stamp(rows[i]), stamp(rows[one(ends, "owner execution result")]))
            )
    return spans


def claude_worker(
    native: dict[str, Any], root: str, files: dict[str, str], commits: set[str]
) -> Worker:
    matches = []
    expected = ["claude", "anthropic", "claude-sonnet-5-5", "medium"]
    subagent = "darrow-adaptive-goal:adaptive-goal-sonnet-5-5-medium"
    for name, text in files.items():
        if name.endswith(".meta.json"):
            meta = json.loads(text)
            if meta.get("agentType") == subagent and not meta.get("parentAgentId"):
                agent = (
                    Path(name).name.removeprefix("agent-").removesuffix(".meta.json")
                )
                bound, parent = native["bound_reader"](root, files, agent, expected)
                _, start, end = native["launch"](
                    parent, bound["toolUseId"], None, subagent
                )
                rows = [json.loads(line) for line in parent.splitlines()]
                completions = [
                    rows[end],
                    *claude_continuations(
                        native,
                        rows,
                        agent,
                        files[name.removesuffix(".meta.json") + ".jsonl"],
                        commits,
                    ),
                ]
                returned = next(
                    (row for row in completions if mentions(json.dumps(row), commits)),
                    None,
                )
                if returned is not None:
                    returned_set = returned_commits(json.dumps(returned), commits)
                    matches.append(
                        Worker(
                            agent,
                            stamp(rows[start]),
                            stamp(returned),
                            returned_set,
                            claude_return(
                                native,
                                files[name.removesuffix(".meta.json") + ".jsonl"],
                                returned_set,
                                stamp(rows[start]),
                                stamp(returned),
                            ),
                        )
                    )
    return one(matches, "commit-returning implementation worker")


def claude_continuations(
    native: dict[str, Any],
    rows: list[dict[str, Any]],
    agent: str,
    child: str,
    commits: set[str],
) -> list[dict[str, Any]]:
    completions = []
    for row in rows:
        attachment = row.get("attachment", {})
        if attachment.get("origin") != {
            "kind": "task-notification",
            "producer": "session-task",
        }:
            continue
        text = attachment.get("prompt", "")
        if f"<task-id>{agent}</task-id>" not in text or not mentions(text, commits):
            continue
        assert row["type"] == "attachment" and attachment["type"] == "queued_command"
        assert (
            attachment["commandMode"] == "task-notification"
            and "<status>completed</status>" in text
        )
        identity = one(
            re.findall(r"<tool-use-id>([^<]+)</tool-use-id>", text),
            "continuation tool identity",
        )
        accepted = claude_resume(native, rows, identity, agent)
        claude_return(native, child, commits, accepted, stamp(row))
        completions.append(row)
    return completions


def claude_resume(
    native: dict[str, Any],
    rows: list[dict[str, Any]],
    identity: str,
    agent: str,
) -> int:
    calls = [
        (row, block)
        for row in rows
        if row.get("type") == "assistant"
        for block in native["blocks"](row)
        if block.get("id") == identity
    ]
    called, call = one(calls, "retained worker continuation")
    assert call["name"] == "SendMessage" and call["input"]["to"] == agent
    results = [
        row
        for row in rows
        if row.get("type") == "user"
        for block in native["blocks"](row)
        if block.get("tool_use_id") == identity
    ]
    accepted = one(results, "accepted retained worker continuation")
    result = accepted["toolUseResult"]
    assert result["success"] is True and result["resumedAgentId"] == agent
    assert stamp(called) <= stamp(accepted)
    return stamp(accepted)


def claude_return(
    native: dict[str, Any],
    child: str,
    commits: set[str],
    accepted: int,
    delivered: int,
) -> int:
    rows = [json.loads(line) for line in child.splitlines()]
    completions = [
        row
        for row in rows
        if row.get("type") == "assistant"
        and row.get("message", {}).get("stop_reason") == "end_turn"
    ]
    returned = [
        row
        for row in completions
        if mentions(json.dumps(native["blocks"](row)), commits)
    ]
    finished = [stamp(row) for row in returned if accepted < stamp(row) <= delivered]
    return one(finished, "actual worker completion for returned commits")


def claude_spans(native: dict[str, Any], text: str) -> list[tuple[int, int]]:
    rows = [json.loads(line) for line in text.splitlines()]
    calls = [
        (row, block)
        for row in rows
        if row.get("type") == "assistant"
        for block in native["blocks"](row)
        if block.get("type") == "tool_use" and block.get("name") == "Bash"
    ]
    spans = []
    for start, call in calls:
        ends = [
            row
            for row in rows
            if row.get("type") == "user"
            for block in native["blocks"](row)
            if block.get("type") == "tool_result"
            and block.get("tool_use_id") == call["id"]
        ]
        spans.append((stamp(start), stamp(one(ends, "owner Bash result"))))
    return spans


def observe(
    host: str, commits: list[set[str]]
) -> tuple[list[Worker], list[tuple[int, int]]]:
    helpers = Path(".git/eval-checks/review/tests/evals").resolve()
    sys.path.insert(0, str(helpers))
    view = Path(os.environ["SEVRO_CANDIDATE_TRANSCRIPTS"])
    if host == "codex":
        native = runpy.run_path(str(helpers / "native_codex_routes.py"))
        root, captured = native["sessions"](view)
        return [
            codex_worker(native, root, captured, group) for group in commits
        ], codex_spans(captured[root])
    native = runpy.run_path(str(helpers / "native_claude_routes.py"))
    root, files = native["captured"](view)
    parent = one(
        [text for name, text in files.items() if name.endswith(f"/{root}.jsonl")],
        "original owner",
    )
    return [
        claude_worker(native, root, files, group) for group in commits
    ], claude_spans(native, parent)


def worker_branches(
    integration: str, tickets: tuple[int, ...] = (41, 42, 43)
) -> list[str]:
    names = git("for-each-ref", "refs/heads", "--format=%(refname:short)").splitlines()
    return [
        one(
            [
                name
                for name in names
                if name != integration and re.match(rf"^[a-z]+/issue-{ticket}-", name)
            ],
            f"issue-{ticket} worker branch",
        )
        for ticket in tickets
    ]


def receipts() -> list[dict[str, Any]]:
    rows = [
        json.loads(line)
        for line in Path(".fixture-state/batch-commits.jsonl").read_text().splitlines()
    ]
    for row in rows:
        history = git("reflog", "show", row["branch"], "--format=%H").splitlines()
        assert row["commit"] in history, "receipt does not match an actual ref effect"
        assert git("rev-parse", row["commit"] + "^{commit}") == row["commit"]
    return rows


def require_landed(target: str, source: str) -> None:
    assert not any(
        row.startswith("+") for row in git("cherry", target, source).splitlines()
    ), f"unlanded commits from {source} at {target}"


def branch_base(branch: str) -> str:
    return git("reflog", "show", branch, "--format=%H").splitlines()[-1]


def verify_git() -> None:
    integration = Path(".git/integration-branch").read_text().strip()
    base = Path(".git/integration-base").read_text().strip()
    branches = worker_branches(integration)
    worktrees = git("worktree", "list", "--porcelain").splitlines()
    assert all(f"branch refs/heads/{branch}" in worktrees for branch in branches)
    assert [branch_base(branch) for branch in branches[:2]] == [base, base], (
        "batch branches have different bases"
    )
    for branch in branches:
        require_landed("HEAD", branch)
    landings = git("reflog", "show", integration, "--format=%gs").splitlines()
    assert sum(row.startswith("cherry-pick:") for row in landings) >= 3
    assert (
        Path(".git/hooks/post-commit").read_bytes()
        == Path(".git/eval-checks/expected-post-commit").read_bytes()
    )


def verify_prerequisites(dependent_base: str, workers: list[Worker]) -> None:
    for worker in workers[:2]:
        assert worker.returned, "missing initial returned prerequisite commits"
        for commit in worker.returned:
            require_landed(dependent_base, commit)


def require_unattributed(commit: str) -> None:
    message = git("show", "-s", "--format=%B", commit)
    assert not re.search(
        r"(?im)^co-authored-by:.*\b(?:claude|codex|gpt|ai)\b", message
    ), f"worker commit violates bound Git attribution refusal: {commit}"


def claude_commit_calls(native: dict[str, Any], text: str, commits: set[str]) -> None:
    rows = [json.loads(line) for line in text.splitlines()]
    calls = [
        block
        for row in rows
        if row.get("type") == "assistant"
        for block in native["blocks"](row)
        if block.get("type") == "tool_use"
    ]
    assert any(commit_skill_read(call) for call in calls), (
        "worker did not load bound commit skill"
    )
    invoked = {
        call["id"]
        for call in calls
        if call.get("name") == "Bash"
        and re.search(
            r"\bdarrow-create-commit\s+commit\b",
            call.get("input", {}).get("command", ""),
        )
    }
    returned = {
        commit
        for row in rows
        if row.get("type") == "user"
        for block in native["blocks"](row)
        if block.get("tool_use_id") in invoked and not block.get("is_error")
        for commit in returned_commits(json.dumps(block.get("content", "")), commits)
    }
    assert commits <= returned, (
        "worker commit lacks successful public capability receipt"
    )


def commit_skill_read(call: dict[str, Any]) -> bool:
    args = call.get("input", {})
    if call.get("name") == "Skill":
        skill = args.get("skill")
        return isinstance(skill, str) and skill == "darrow-git:create-commit"
    path = args.get("file_path", "")
    return (
        call.get("name") == "Read"
        and isinstance(path, str)
        and path.endswith("/skills/create-commit/SKILL.md")
    )


def verify_commits(host: str, tickets: tuple[int, ...] = (41, 42, 43)) -> None:
    integration = Path(".git/integration-branch").read_text().strip()
    events = [row for row in receipts() if row["branch"] != integration]
    for row in events:
        require_unattributed(row["commit"])
    if host == "claude":
        helpers = Path(".git/eval-checks/review/tests/evals").resolve()
        sys.path.insert(0, str(helpers))
        native = runpy.run_path(str(helpers / "native_claude_routes.py"))
        root, files = native["captured"](
            Path(os.environ["SEVRO_CANDIDATE_TRANSCRIPTS"])
        )
        for branch in worker_branches(integration, tickets):
            commits = {row["commit"] for row in events if row["branch"] == branch}
            worker = claude_worker(native, root, files, commits)
            child = one(
                [
                    text
                    for name, text in files.items()
                    if name.endswith(f"/agent-{worker.identity}.jsonl")
                ],
                "commit worker transcript",
            )
            claude_commit_calls(native, child, commits)


def verify_barrier(
    workers: list[Worker],
    landings: list[dict[str, Any]],
    spans: list[tuple[int, int]],
) -> None:
    assert len({worker.identity for worker in workers}) == 3, (
        "each ticket requires its own worker"
    )
    finished = [
        worker.finished for worker in workers[:2] if worker.finished is not None
    ]
    assert len(finished) == 2, "missing actual worker finish for concurrency"
    assert max(workers[0].accepted, workers[1].accepted) < min(finished), (
        "independent workers did not overlap"
    )
    assert landings, "no observed integration effects"
    first = min(row["time_ns"] for row in landings)
    start = min(left for left, right in spans if left <= first <= right)
    assert max(workers[0].settled, workers[1].settled) < start, (
        "integration began before the whole batch settled"
    )
    prerequisite_effects = [
        row["time_ns"] for row in landings if row["time_ns"] < workers[2].accepted
    ]
    assert len(prerequisite_effects) >= 2, (
        "dependent dispatched before prerequisite landings"
    )
    print(
        json.dumps(
            {
                "workers": [list(worker[:3]) for worker in workers],
                "actual_worker_finish_time_ns": [worker.finished for worker in workers],
                "first_integration_time_ns": first,
                "owner_execution_start_ns": start,
            }
        )
    )


def verify(host: str) -> None:
    integration = Path(".git/integration-branch").read_text().strip()
    branches = worker_branches(integration)
    events = receipts()
    commits = [
        {row["commit"] for row in events if row["branch"] == branch}
        for branch in branches
    ]
    assert all(commits), "missing actual worker commit effects"
    workers, spans = observe(host, commits)
    landings = [row for row in events if row["branch"] == integration]
    verify_barrier(
        workers,
        landings,
        spans,
    )
    verify_prerequisites(branch_base(branches[2]), workers)
    print(
        json.dumps(
            {
                "initial_returned_commits": [
                    sorted(worker.returned) for worker in workers
                ]
            }
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("record", "git", "verify", "commits"))
    parser.add_argument("--host", choices=("codex", "claude"))
    parser.add_argument("--tickets", type=int, nargs="+", default=[41, 42, 43])
    args = parser.parse_args()
    if args.operation == "record":
        record()
    elif args.operation == "git":
        verify_git()
    elif args.operation == "commits":
        assert args.host, "native host is required"
        verify_commits(args.host, tuple(args.tickets))
    else:
        assert args.host, "native host is required"
        verify(args.host)


if __name__ == "__main__":
    main()
