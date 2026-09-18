"""Additive worktree allocation, exclusion preflight, and exact reuse."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from .branch_options import BranchOptions
from .process import RefusalError, git, invoke, probe, require
from .repository import (
    common_dir,
    current_ref,
    git_path,
    in_progress,
    validate_base,
    worktrees,
)


@dataclass
class Allocation:
    path: Path
    exclude: Path | None = None
    append: bool = False
    created_parents: list[Path] = field(default_factory=list)


def destination(options: BranchOptions) -> Path:
    if options.at is not None:
        path = caller_directory() / options.at
    else:
        path = worktrees()[0].path / ".worktrees" / options.name
    gitdir = Path(git("rev-parse", "--git-dir")).resolve()
    require(
        not path.resolve().is_relative_to(gitdir),
        f"worktree path is inside the .git directory: {path}",
        2,
    )
    require(
        not (path.exists() or path.is_symlink()),
        f"path already exists: {path} — will not reuse it",
        9,
    )
    return path


def caller_directory() -> Path:
    logical = Path(os.environ.get("PWD", str(Path.cwd())))
    try:
        return (
            logical
            if logical.is_absolute() and logical.samefile(Path.cwd())
            else Path.cwd()
        )
    except OSError:
        return Path.cwd()


def create_parents(allocation: Allocation) -> None:
    parent = allocation.path.parent
    while not parent.exists():
        allocation.created_parents.append(parent)
        parent = parent.parent
    try:
        allocation.path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise RefusalError(
            f"error: cannot create worktree parent dir: {error}", 9
        ) from error


def cleanup_parents(allocation: Allocation) -> None:
    for parent in allocation.created_parents:
        try:
            parent.rmdir()
        except OSError:
            # Never remove a nonempty, replaced, or otherwise inaccessible parent.
            return


def inspect_exclude(allocation: Allocation) -> None:
    exclude = git_path("info/exclude")
    allocation.exclude = exclude
    try:
        if exclude.exists() or exclude.is_symlink():
            require(
                os.access(exclude, os.R_OK),
                f"repository exclude file is unreadable: {exclude}",
                9,
            )
            allocation.append = b"/.worktrees/" not in exclude.read_bytes().splitlines()
        else:
            allocation.append = True
        exclude.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise RefusalError(
            f"error: cannot inspect repository exclude file: {exclude}", 9
        ) from error
    writable = exclude if exclude.exists() else exclude.parent
    require(
        not allocation.append or os.access(writable, os.W_OK),
        f"repository exclude file is not writable: {exclude}",
        9,
    )


def append_exclude(allocation: Allocation, task: bool) -> None:
    if not allocation.append or allocation.exclude is None:
        return
    try:
        with allocation.exclude.open("ab") as stream:
            stream.write(b"/.worktrees/\n")
    except OSError as error:
        action = "prepared" if task else "created"
        raise RefusalError(
            f"error: worktree {action} but cannot update repository exclude file: {allocation.exclude}",
            9,
        ) from error


def report_notes(options: BranchOptions, path: Path, dirty: str) -> None:
    if dirty:
        print(
            f"## note: uncommitted changes stay in the current worktree — they were not carried into {path}"
        )
    if (
        options.at is not None
        and invoke(["git", "check-ignore", "-q", "--", str(path)]).returncode == 1
    ):
        print(
            f"## note: {path} is inside the repository and not ignored — git status will list it; consider adding it to .git/info/exclude"
        )


def valid_registered(path: Path, name: str) -> bool:
    if not path.is_dir():
        return False
    try:
        return (
            probe("rev-parse", "--is-inside-work-tree", cwd=path) == "true"
            and probe("symbolic-ref", "-q", "HEAD", cwd=path) == f"refs/heads/{name}"
            and common_dir(path) == common_dir(Path.cwd())
        )
    except RefusalError:
        return False


def reuse(options: BranchOptions) -> bool:
    path = next(
        (tree.path for tree in worktrees() if tree.branch == options.name), None
    )
    if path is None:
        return False
    require(
        valid_registered(path, options.name),
        f"registered task worktree is missing, inaccessible, or inconsistent: {path}",
        9,
    )
    require(
        not in_progress(path),
        f"merge/rebase/cherry-pick in progress in prepared worktree {path} — resolve it first",
        8,
    )
    require(
        path != Path(git("rev-parse", "--show-toplevel")),
        f"branch is already active in the current checkout and cannot also be attached to a linked worktree: {options.name}",
        9,
    )
    require(
        options.at is None or caller_directory() / options.at == path,
        f"branch is already checked out in another worktree: {path}",
        9,
    )
    print("## mode: worktree-current")
    print(
        f"{options.name} (at {git('rev-parse', f'refs/heads/{options.name}')} ) in {path}".replace(
            " )", ")"
        )
    )
    return True


def prepare_allocation(options: BranchOptions, task: bool) -> Allocation:
    allocation = Allocation(destination(options))
    if options.at is None:
        try:
            create_parents(allocation)
            inspect_exclude(allocation)
        except RefusalError:
            if task:
                cleanup_parents(allocation)
            raise
    return allocation


def add(options: BranchOptions, *, task: bool, existing: bool) -> None:
    validate_base(options.base)
    source = options.base or current_ref()
    dirty = git("status", "--porcelain")
    allocation = prepare_allocation(options, task)
    args = ["worktree", "add", str(allocation.path)]
    args += (
        [options.name]
        if existing
        else ["-b", options.name, *([options.base] if options.base else [])]
    )
    try:
        git(*args)
    except RefusalError:
        if task:
            cleanup_parents(allocation)
        raise
    append_exclude(allocation, task)
    report_added(options, allocation.path, task, existing, source)
    report_notes(options, allocation.path, dirty)


def report_added(
    options: BranchOptions, path: Path, task: bool, existing: bool, source: str
) -> None:
    if task:
        print(f"## mode: worktree-{'reused' if existing else 'created'}")
    evidence = (
        f"at {git('rev-parse', f'refs/heads/{options.name}')}"
        if existing
        else f"from {source}"
    )
    print(f"{options.name} ({evidence}) {'in' if task else 'at'} {path}")
