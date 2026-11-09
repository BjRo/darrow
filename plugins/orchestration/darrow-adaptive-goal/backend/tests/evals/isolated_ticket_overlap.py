"""Check overlapping ticket placement through native identities and Git effects."""

from pathlib import Path
from typing import Any

from evals import isolated_ticket_batch as batch


def verify_sequence(
    workers: list[batch.Worker], events: list[dict[str, Any]], integration: str
) -> None:
    assert len(workers) == 2 and workers[0].identity != workers[1].identity
    assert workers[0].settled < workers[1].accepted, (
        "overlapping assignments ran together"
    )
    assert any(
        row["branch"] == integration and row["time_ns"] < workers[1].accepted
        for row in events
    ), "second worker started before landing"


def verify() -> None:
    integration = Path(".git/integration-branch").read_text().strip()
    names = batch.git(
        "for-each-ref", "refs/heads", "--format=%(refname:short)"
    ).splitlines()
    branches = [
        batch.one(
            [name for name in names if f"/issue-{ticket}-" in name], "worker branch"
        )
        for ticket in (41, 42)
    ]
    events = batch.receipts()
    commits = [
        {row["commit"] for row in events if row["branch"] == branch}
        for branch in branches
    ]
    assert all(commits)
    workers, _ = batch.observe("codex", commits)
    verify_sequence(workers, events, integration)
    batch.verify_prerequisites(batch.branch_base(branches[1]), workers[:1])
    initial = Path(".git/integration-base").read_text().strip()
    assert batch.branch_base(branches[0]) == initial
    worktrees = batch.git("worktree", "list", "--porcelain").splitlines()
    for branch in branches:
        assert f"branch refs/heads/{branch}" in worktrees
        batch.require_landed("HEAD", branch)
    landings = batch.git("reflog", "show", integration, "--format=%gs").splitlines()
    assert sum(row.startswith("cherry-pick:") for row in landings) >= 2
    assert (
        Path(".git/hooks/post-commit").read_bytes()
        == Path(".git/eval-checks/expected-post-commit").read_bytes()
    )


if __name__ == "__main__":
    verify()
