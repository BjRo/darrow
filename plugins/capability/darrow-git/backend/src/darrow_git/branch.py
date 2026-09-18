"""Create and prepare branches through the established command contracts."""

from . import worktree
from .branch_options import BranchOptions, parse
from .names import discover, validate_name
from .process import RefusalError, emit, git, require, succeeds
from .repository import (
    current_branch,
    current_ref,
    in_progress,
    local_default,
    require_repository,
    validate_base,
    worktrees,
)


def inspect(*, task: bool) -> None:
    if in_progress():
        verb = "switch" if task else "branch"
        print(
            f"## mode: conflict (merge/rebase/cherry-pick in progress — do not {verb}; inform the user)"
        )
        print("## unmerged files")
        emit(git("diff", "--name-only", "--diff-filter=U"), 50)
        return
    print("## mode: ready")
    print(f"## current branch: {current_ref()}")
    print(f"## default branch: {local_default()}")
    description = (
        "compatible uncommitted changes travel unchanged"
        if task
        else "uncommitted changes travel to the new branch"
    )
    print(f"## working tree ({description})")
    emit(git("status", "--porcelain") or "clean", 50)
    inspect_branches(task)


def inspect_branches(task: bool) -> None:
    if task:
        print("## local branches")
        emit(
            git(
                "for-each-ref",
                "--sort=refname",
                "--format=%(refname:lstrip=2)",
                "refs/heads",
            ),
            50,
        )
        return
    print("## recent branches (match their naming style)")
    emit(
        git(
            "for-each-ref",
            "--count=10",
            "--sort=-committerdate",
            "--format=%(refname:short)",
            "refs/heads",
        )
    )
    top = git("rev-parse", "--show-toplevel")
    others = [
        f"{tree.path} [{tree.branch}]" for tree in worktrees() if str(tree.path) != top
    ]
    if others:
        print("## other worktrees (their branches are checked out elsewhere)")
        emit("\n".join(others), 50)


def report_matches(matches: list[str]) -> str:
    return "\n".join([f"## matches: {len(matches)}", *matches])


def collisions(options: BranchOptions, task: bool) -> bool:
    names = git(
        "for-each-ref", "refs/heads", "--format=%(refname:lstrip=2)"
    ).splitlines()
    existing = options.name in names
    matches = "\n".join(name for name in names if name.lower() == options.name.lower())
    if not task:
        require(
            not matches,
            f"branch already exists: {matches} — will not reuse or reset it",
            9,
        )
    else:
        require(
            existing or not matches,
            f"branch name differs only by case from existing branch: {matches}",
            9,
        )
        guard_discovery(options, existing)
    return existing


def guard_discovery(options: BranchOptions, existing: bool) -> None:
    if existing:
        return
    matches = discover(options.token)
    if matches:
        raise RefusalError(
            "error: correlated local branches exist; bind one exact existing branch before preparation\n"
            + report_matches(matches),
            9,
        )


def prepare(options: BranchOptions, *, task: bool) -> None:
    verb = "switch" if task else "branch"
    require(
        not in_progress(),
        f"merge/rebase/cherry-pick in progress — resolve it first; do not {verb}",
        8,
    )
    require(
        succeeds("rev-parse", "-q", "--verify", "HEAD"),
        "repository has no commits yet — make the first commit before branching",
        3,
    )
    validate_name(options.name, options.token, task=task)
    existing = collisions(options, task)
    if options.worktree:
        if task and worktree.reuse(options):
            return
        worktree.add(options, task=task, existing=existing)
    else:
        switch(options, task=task, existing=existing)


def switch(options: BranchOptions, *, task: bool, existing: bool) -> None:
    if existing:
        mode = "current" if current_branch() == options.name else "reused"
        if mode == "reused":
            git("switch", "--no-guess", options.name)
        print(f"## mode: {mode}")
        print(f"{options.name} (at {git('rev-parse', f'refs/heads/{options.name}')})")
        return
    validate_base(options.base)
    source = options.base or current_ref()
    git("switch", "-c", options.name, *([options.base] if options.base else []))
    if task:
        print("## mode: created")
    print(f"{options.name} (from {source})")


def run(args: list[str], *, task: bool = False) -> None:
    require_repository()
    command = args[0] if args else ""
    if command == "inspect":
        inspect(task=task)
    elif command == ("prepare" if task else "create"):
        prepare(parse(args[1:], task=task), task=task)
    elif command == "discover" and task:
        require(
            len(args) == 3 and args[1] == "--ticket-token" and args[2],
            "discover requires --ticket-token <opaque-token>",
            2,
        )
        matches = discover(args[2])
        print(
            f"## mode: discovered\n## ticket token: {args[2]}\n{report_matches(matches)}"
        )
    else:
        raise RefusalError(
            "usage: "
            + ("darrow-prepare-task-branch " if task else "darrow-create-branch ")
            + (
                "discover --ticket-token <opaque-token> | inspect | prepare <name> --ticket-token <opaque-token>"
                if task
                else "inspect | create <name> [--ticket-token <opaque-token>]"
            )
            + " [--from <base>] [--worktree [--at <path>]]",
            64,
        )
