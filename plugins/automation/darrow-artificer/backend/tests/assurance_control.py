"""Local forge and publication fixture; never contacts a real service."""

from __future__ import annotations

import fcntl
import json
import subprocess
import sys
from pathlib import Path

from darrow_artificer.github import object_value

FIXTURE_REPOSITORY = "fixture/never-published"
FIXTURE_PR = 9


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


def ticket(reference: str) -> None:
    assert reference == f"https://github.com/{FIXTURE_REPOSITORY}/issues/291"
    print((root() / "ticket.txt").read_text(), end="")


def target() -> tuple[Path, str]:
    value = load("target.json")
    return Path(str(value["worktree"])), str(value["branch"])


def open_pr(branch: str, commit: str) -> dict[str, object]:
    return {
        "number": FIXTURE_PR,
        "state": "open",
        "draft": False,
        "labels": [],
        "head": {
            "ref": branch,
            "sha": commit,
            "repo": {"full_name": FIXTURE_REPOSITORY},
        },
        "base": {"ref": "main"},
        "html_url": f"https://github.com/{FIXTURE_REPOSITORY}/pull/{FIXTURE_PR}",
    }


def record_pr(pr: dict[str, object]) -> None:
    """Expose the proposal through the local forge that Artificer reconciles."""
    with (root() / "forge.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = load("forge.json")
        state["pr"] = pr
        save("forge.json", state)


def publish(commit: str) -> None:
    repo, branch = target()
    assert git(repo, "rev-parse", "HEAD") == commit
    assert git(repo, "branch", "--show-current") == branch
    assert git(repo, "status", "--porcelain") == ""
    check(repo)
    git(repo, "push", "origin", f"{commit}:refs/heads/{branch}")
    assert git(repo, "ls-remote", "origin", f"refs/heads/{branch}").split()[0] == commit
    save("proposal.json", {"head": commit, "branch": branch, "number": FIXTURE_PR})
    record_pr(open_pr(branch, commit))
    print(
        json.dumps(
            {
                "publication": "verified",
                "url": f"https://github.com/{FIXTURE_REPOSITORY}/pull/{FIXTURE_PR}",
                "repository": FIXTURE_REPOSITORY,
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
    repo, _ = target()
    observed = git(repo, "show", f"{commit}:config.json")
    assert json.loads(observed) == {"timeoutMs": 2500, "retries": 3}
    check(repo)
    save("ci.json", {"commit": commit, "status": "success"})
    print(f"required CI: success; commit: {commit}")


def main() -> None:
    commands = {"ticket": ticket, "publish": publish, "ci": ci}
    assert len(sys.argv) == 3
    commands[sys.argv[1]](sys.argv[2])


if __name__ == "__main__":
    main()
