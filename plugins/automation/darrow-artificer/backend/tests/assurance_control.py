"""Local forge and publication fixture; never contacts a real service."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from darrow_artificer.github import object_value

REPLY = "operator-approved: cobalt-291"


def root() -> Path:
    return Path(sys.argv[0]).resolve().parent


def load(name: str) -> dict[str, object]:
    return object_value(json.loads((root() / name).read_text()))


def save(name: str, value: dict[str, object]) -> None:
    (root() / name).write_text(json.dumps(value) + "\n")


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def check(repo: Path) -> None:
    subprocess.run(["bash", "check.sh"], cwd=repo, check=True)
    assert (root() / "release.txt").read_text() == REPLY


def ticket(reference: str) -> None:
    assert reference == "https://github.com/fixture/never-published/issues/291"
    print((root() / "ticket.txt").read_text(), end="")


def accept(answer: str) -> None:
    assert answer == REPLY, "The complete operator answer does not match"
    repo = Path(str(load("target.json")["worktree"]))
    subprocess.run(["bash", "check.sh"], cwd=repo, check=True)
    (root() / "release.txt").write_text(answer)
    receipt = root() / "release.txt"
    print(
        f"Operator release recorded after successful candidate checks. Receipt: {receipt}"
    )


def publish(commit: str) -> None:
    target = load("target.json")
    repo, branch = Path(str(target["worktree"])), str(target["branch"])
    assert git(repo, "rev-parse", "HEAD") == commit
    assert git(repo, "branch", "--show-current") == branch
    assert git(repo, "status", "--porcelain") == ""
    check(repo)
    git(repo, "push", "origin", f"{commit}:refs/heads/{branch}")
    assert git(repo, "ls-remote", "origin", f"refs/heads/{branch}").split()[0] == commit
    save("proposal.json", {"head": commit, "branch": branch, "number": 9})
    print(
        json.dumps(
            {
                "publication": "verified",
                "url": "https://github.com/fixture/never-published/pull/9",
                "repository": "fixture/never-published",
                "head": branch,
                "base": "main",
                "draft": False,
                "intended-commit": commit,
                "remote-commit": commit,
                "pr-commit": commit,
            }
        )
    )


def ci(commit: str) -> None:
    proposal = load("proposal.json")
    assert proposal["head"] == commit
    repo = Path(str(load("target.json")["worktree"]))
    observed = git(repo, "show", f"{commit}:config.json")
    assert json.loads(observed) == {"timeoutMs": 2500, "retries": 3}
    check(repo)
    save("ci.json", {"commit": commit, "status": "success"})
    print(f"required CI: success; commit: {commit}")


def forge_pr() -> None:
    proposal = load("proposal.json")
    print(
        json.dumps(
            {
                "number": 9,
                "state": "open",
                "draft": False,
                "head": {
                    "ref": proposal["branch"],
                    "sha": proposal["head"],
                    "repo": {"full_name": "fixture/never-published"},
                },
                "base": {"ref": "main"},
                "html_url": "https://github.com/fixture/never-published/pull/9",
            }
        )
    )


def main() -> None:
    commands = {"ticket": ticket, "accept": accept, "publish": publish, "ci": ci}
    assert len(sys.argv) == 3
    commands[sys.argv[1]](sys.argv[2])


if __name__ == "__main__":
    main()
