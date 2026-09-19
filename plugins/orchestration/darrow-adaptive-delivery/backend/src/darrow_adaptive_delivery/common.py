"""Filesystem and subprocess boundaries shared by the contained helpers."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

PLUGIN = Path(__file__).resolve().parents[3]
GIT_SELECTORS = frozenset(
    [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_CEILING_DIRECTORIES",
        "GIT_DISCOVERY_ACROSS_FILESYSTEM",
        "GIT_CONFIG",
        "GIT_CONFIG_PARAMETERS",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_SYSTEM",
        "GIT_SHALLOW_FILE",
        "GIT_GRAFT_FILE",
        "GIT_NAMESPACE",
    ]
)


class RefusalError(Exception):
    """Invalid input or unavailable evidence; public helpers exit 2."""


class CheckRequiredError(Exception):
    """A fixture prerequisite failed; retain the fixture's exit 1."""


def git_environment() -> dict[str, str]:
    return {
        key: value
        for key, value in os.environ.items()
        if key not in GIT_SELECTORS
        and not key.startswith(("GIT_CONFIG_KEY_", "GIT_CONFIG_VALUE_"))
    }


def git(repo: Path, *args: str, data: bytes | None = None) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        input=data,
        capture_output=True,
        env=git_environment(),
        check=False,
    )
    if result.returncode:
        raise RefusalError(result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).decode("utf-8").rstrip("\r\n")


def repository(path: str) -> Path:
    directory = Path(path)
    if not directory.is_dir():
        raise RefusalError(f"directory does not exist: {path}")
    directory = directory.resolve()
    try:
        inside = git_text(directory, "rev-parse", "--is-inside-work-tree")
        if inside != "true":
            raise RefusalError("outside working tree")
        return Path(git_text(directory, "rev-parse", "--show-toplevel")).resolve()
    except (RefusalError, OSError) as error:
        raise RefusalError(f"not a git working tree: {directory}") from error


def read_text(path: Path, label: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise RefusalError(f"{label}: {path}") from error


def record(*fields: str) -> str:
    return "\t".join(fields) + "\n"
