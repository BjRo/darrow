"""PR base selection and committed comparison context."""

from .process import probe, require, succeeds
from .repository import guessed_default


def default_branch() -> tuple[str, str]:
    tracked = probe("symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD")
    if tracked:
        return tracked.removeprefix("origin/"), "tracked"
    rows = probe("ls-remote", "--symref", "origin", "HEAD")
    for line in rows.splitlines():
        if line.startswith("ref: "):
            return line.split()[1].removeprefix("refs/heads/"), "remote"
    return guessed_default(), "guess"


def compare_ref(base: str) -> str:
    return (
        f"origin/{base}"
        if succeeds("rev-parse", "-q", "--verify", f"refs/remotes/origin/{base}")
        else base
    )


def validate_base(base: str, branch: str) -> None:
    require(base != branch, f"base equals the current branch: {branch}", 2)
    require(
        succeeds("rev-parse", "-q", "--verify", f"refs/remotes/origin/{base}"),
        f"base not found on origin: {base} — fetch or push it first",
        2,
    )
