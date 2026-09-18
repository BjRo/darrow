"""Native filesystem boundaries and canonical primary-worktree resolution."""

import os
import subprocess
from pathlib import Path

from .errors import DecisionError
from .model import CONTROL

ADR_DIRECTORIES = (
    "docs/decisions",
    "docs/adrs",
    "docs/adr",
    "architecture/decisions",
    "adrs",
    "adr",
)


def git(root: Path, *args: str) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, check=False
        )
    except OSError as error:
        raise DecisionError(f"cannot run Git: {error.strerror}") from error


def resolve_root(value: str) -> Path:
    target = Path(value)
    if not value or not target.is_dir() or not os.access(target, os.R_OK):
        raise DecisionError(f"repository path is not a readable directory: {value}")
    result = git(target, "worktree", "list", "--porcelain")
    if result.returncode:
        raise DecisionError(f"not a Git repository: {value}")
    first = result.stdout.decode("utf-8", errors="surrogateescape").split("\n", 1)[0]
    if not first.startswith("worktree ") or not first[9:]:
        raise DecisionError("cannot resolve repository root from git worktree metadata")
    if CONTROL.search(first[9:]):
        raise DecisionError("repository root contains unsupported control bytes")
    return Path(first[9:]).resolve()


def has_symlink(path: Path) -> bool:
    return any(part.is_symlink() for part in (path, *path.parents))


def contained(path: Path, root: Path, kind: str) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(root):
        raise DecisionError(f"{kind} escapes the repository root: {resolved}")
    return resolved


def canonical(root: Path, value: str, *, directory: bool = False) -> Path:
    candidate = root / value
    kind = "ADR directory" if directory else "canonical record"
    if has_symlink(candidate):
        raise DecisionError(f"{kind} symlinks are not allowed: {candidate}")
    check_type(candidate, directory)
    mode = os.R_OK | (os.X_OK if directory else 0)
    if not os.access(candidate, mode):
        raise DecisionError(f"{kind} is not readable: {candidate}")
    return contained(candidate, root, kind)


def check_type(path: Path, directory: bool) -> None:
    if directory:
        if not path.is_dir():
            raise DecisionError(f"ADR directory does not exist: {path}")
    elif not path.is_file():
        raise DecisionError(f"canonical record is not a regular file: {path}")


def select_directory(root: Path, value: str = "") -> Path | None:
    if value:
        return canonical(root, value, directory=True)
    unique = list(dict.fromkeys(discover_directories(root)))
    if len(unique) > 1:
        raise DecisionError(
            "multiple ADR directories found; pass --dir explicitly:\n"
            + "\n".join(f"  - {path}" for path in unique),
            3,
        )
    return next(iter(unique), None)


def discover_directories(root: Path) -> list[Path]:
    candidates = []
    for name in ADR_DIRECTORIES:
        path = root / name
        if not path.exists() and not path.is_symlink():
            continue
        if not path.is_dir():
            raise DecisionError(f"ADR directory candidate is not a directory: {path}")
        candidates.append(canonical(root, name, directory=True))
    return candidates


def read_bytes(path: Path, diagnostic: str) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise DecisionError(f"{diagnostic}: {path}") from error


def read_text(path: Path, diagnostic: str) -> str:
    return read_bytes(path, diagnostic).decode("utf-8", errors="surrogateescape")
