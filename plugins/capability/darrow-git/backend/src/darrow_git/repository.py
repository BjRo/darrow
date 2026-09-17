"""Repository identity, operation guards, and worktree observations."""

from dataclasses import dataclass
from pathlib import Path

from .process import git, probe, require, succeeds

OPERATIONS = (
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "rebase-merge",
    "rebase-apply",
)


def require_repository() -> None:
    require(
        probe("rev-parse", "--is-inside-work-tree") == "true",
        "not inside a git work tree",
        3,
    )


def git_path(name: str, cwd: Path | None = None) -> Path:
    path = Path(git("rev-parse", "--git-path", name, cwd=cwd))
    return path if path.is_absolute() else (cwd or Path.cwd()) / path


def in_progress(cwd: Path | None = None) -> bool:
    return any(git_path(name, cwd).exists() for name in OPERATIONS) or bool(
        git("ls-files", "-u", "--", ":/", cwd=cwd)
    )


def current_branch() -> str:
    return probe("symbolic-ref", "-q", "HEAD").removeprefix("refs/heads/")


def current_ref() -> str:
    return current_branch() or f"(detached @ {git('rev-parse', '--short', 'HEAD')})"


def local_default() -> str:
    remote = probe("symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD")
    if remote:
        return remote.removeprefix("origin/")
    return next(
        (
            name
            for name in ("main", "master")
            if succeeds("show-ref", "-q", "--verify", f"refs/heads/{name}")
        ),
        "(none)",
    )


@dataclass(frozen=True)
class Worktree:
    path: Path
    branch: str


def worktrees() -> list[Worktree]:
    listing = git("worktree", "list", "--porcelain")
    return [parse_worktree(block) for block in listing.split("\n\n") if block]


def parse_worktree(block: str) -> Worktree:
    fields = dict(line.partition(" ")[::2] for line in block.splitlines())
    branch = fields.get("branch", "").removeprefix("refs/heads/")
    if "detached" in fields:
        branch = "(detached)"
    if "bare" in fields:
        branch = "(bare)"
    return Worktree(Path(fields["worktree"]), branch)


def common_dir(path: Path) -> Path:
    value = Path(git("rev-parse", "--git-common-dir", cwd=path))
    return (path / value).resolve()


def validate_base(base: str) -> None:
    require(
        not base or succeeds("rev-parse", "--verify", "-q", f"{base}^{{commit}}"),
        f"base not found: {base}",
        2,
    )
