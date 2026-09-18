"""Repository identity and bounded, explicit filesystem operations."""

import os
import subprocess
from pathlib import Path, PureWindowsPath

ENTRY_NAMES = {"AGENTS.md", "AGENTS.override.md", "CLAUDE.md", "CLAUDE.local.md"}
ROOT_NAMES = (*sorted(ENTRY_NAMES), ".claude/CLAUDE.md")
RULE_DIRS = (
    ".claude/rules",
    ".agent-shared/rules",
    ".agents/rules",
    ".codex/rules",
    ".pi/rules",
)


def readable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.R_OK)


def resolve_root(target: str) -> Path:
    path = Path(target)
    if not path.is_dir() or not os.access(path, os.R_OK):
        raise ValueError(f"repository path is not a readable directory: {target}")
    try:
        result = subprocess.run(
            ["git", "-C", str(path), "worktree", "list", "--porcelain", "-z"],
            capture_output=True,
            check=False,
        )
    except FileNotFoundError:
        return path.resolve()
    output = os.fsdecode(result.stdout)
    first = output.split("\0" if "\0" in output else "\n", 1)[0]
    if result.returncode == 0 and first.startswith("worktree "):
        return Path(first.removeprefix("worktree ")).resolve()
    return path.resolve()


def inside(path: Path, root: Path) -> bool:
    return path.is_relative_to(root)


def absolute_reference(ref: str) -> bool:
    return Path(ref).is_absolute() or bool(PureWindowsPath(ref).drive)


def exact_path(path: Path) -> bool:
    """Require portable spelling even when the underlying filesystem folds case."""
    while path != path.parent:
        if path.name != ".." and path.name not in os.listdir(path.parent):
            return False
        path = path.parent
    return True


def existing(path: Path, root: Path) -> Path | None:
    try:
        if not path.is_file() or not exact_path(path):
            return None
        # Preserve a file adapter's spelling for runtime metrics, but validate
        # its actual destination. Resolve directory components for containment.
        target = path.resolve(strict=True)
        if not inside(target, root):
            return None
        return path.parent.resolve() / path.name
    except (OSError, RuntimeError):
        return None


def walk(root: Path, *, prune: bool = True) -> tuple[list[Path], list[Path]]:
    files: list[Path] = []
    directories: list[Path] = []
    for parent, names, leaves in os.walk(root, onerror=raise_walk_error):
        base = Path(parent)
        names[:] = [
            name for name in names if not prune or allowed_directory(base / name, root)
        ]
        directories.extend(base / name for name in names)
        files.extend(base / name for name in leaves)
        files.extend(base / name for name in names if (base / name).is_symlink())
        names[:] = [name for name in names if not (base / name).is_symlink()]
    return sorted(files), sorted(directories)


def raise_walk_error(error: OSError) -> None:
    raise error


def allowed_directory(path: Path, root: Path) -> bool:
    if path.name in {".git", "node_modules", ".worktrees", ".venv", "__pycache__"}:
        return False
    return path.relative_to(root).as_posix() != ".claude/worktrees"


def read_text(path: Path) -> str:
    return path.read_bytes().decode("utf-8-sig")


def unreadable_reason(path: Path, root: Path) -> str | None:
    try:
        return dependency_reason(path, root)
    except (OSError, RuntimeError, UnicodeError):
        return str(path)


def dependency_reason(path: Path, root: Path) -> str | None:
    reason = symlink_reason(path)
    if reason:
        return reason
    if not inside(path.resolve(strict=True), root):
        return f"{path} (external target)"
    if not readable(path):
        return str(path)
    if path.suffix in {".md", ".toml"}:
        read_text(path)
    return None


def symlink_reason(path: Path) -> str | None:
    if not path.is_symlink():
        return None
    if not path.exists():
        return f"{path} (broken symlink)"
    return None if path.is_file() else f"{path} (non-file symlink)"
