"""Exact staged-set commits with normal hooks and guarded retries."""

import os
from pathlib import Path

from .commit_options import CommitOptions, parse
from .messages import validate_attribution, validate_subject
from .process import RefusalError, decode, emit, git, invoke, probe, require, succeeds


def require_no_conflicts() -> None:
    require(
        not git("ls-files", "-u"),
        "merge/rebase in progress — resolve conflicts first; do not commit",
        8,
    )


def validate_paths(paths: list[str]) -> None:
    for path in paths:
        invalid = (
            path in {".", ".."}
            or path.startswith(("-", ":"))
            or any(char in path for char in "*?[")
        )
        require(not invalid, f"only explicit file paths allowed, got: {path}", 7)


def validate_refresh(paths: list[str]) -> None:
    validate_paths(paths)
    for path in paths:
        require(
            git("diff", "--cached", "--name-only", "--", path) == path,
            f"retry path is not in the existing staged set: {path}",
            7,
        )


def head() -> str:
    return probe("rev-parse", "--verify", "HEAD") or "unborn"


def failure_path() -> Path:
    return (
        Path(git("rev-parse", "--git-dir")).absolute()
        / "darrow-create-commit-hook-failure"
    )


def save_failure(output: str, previous_head: str, tree: str) -> None:
    path = failure_path()
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(
        descriptor, "w", encoding="utf-8", errors="surrogateescape"
    ) as stream:
        stream.write(
            f"format\tdarrow-create-commit-hook-failure-v1\nhead\t{previous_head}\nindex_tree\t{tree}\noutput\n{output}\n"
        )


def commit(options: CommitOptions) -> None:
    require_no_conflicts()
    require(
        succeeds("diff", "--cached", "--quiet") or not options.files,
        "a staged set exists; pass no paths (commit exactly the staged set)",
        7,
    )
    validate_paths(options.files)
    validate_subject(options.messages[0].split("\n", 1)[0], "subject")
    validate_attribution("\n\n".join(options.messages), "commit messages")
    if options.files:
        git("add", "--", *options.files)
    require(not succeeds("diff", "--cached", "--quiet"), "nothing staged", 3)
    previous_head, tree = head(), git("write-tree")
    args = [item for message in options.messages for item in ("-m", message)]
    result = invoke(["git", "commit", "-q", *args])
    if result.returncode:
        if head() == previous_head:
            git("read-tree", tree)
        output = decode(result.stdout + result.stderr)
        save_failure(output, previous_head, tree)
        raise RefusalError(output, 4)
    emit(git("log", "-1", "--format=%h %s"))


def retry(options: CommitOptions) -> None:
    require_no_conflicts()
    require(
        not succeeds("diff", "--cached", "--quiet"),
        "retry needs an existing staged set",
        7,
    )
    validate_refresh(options.files)
    git("add", "--", *options.files)
    commit(CommitOptions(messages=options.messages))


def inspect() -> None:
    if git("ls-files", "-u"):
        print(
            "## mode: conflict (merge/rebase in progress — do not commit; inform the user)\n## unmerged files"
        )
        emit(git("diff", "--name-only", "--diff-filter=U"))
        return
    staged = not succeeds("diff", "--cached", "--quiet")
    if staged:
        print(
            "## mode: staged (commit exactly this set; pass no paths)\n## staged files"
        )
        emit(git("diff", "--cached", "--name-status"))
        print("## not included (unstaged/untracked)")
        emit(git("diff", "--name-only"))
    else:
        print(
            "## mode: unstaged (select only files belonging to the change)\n## unstaged files"
        )
        emit(git("diff", "--name-status"))
        print("## untracked files")
    emit(git("ls-files", "--others", "--exclude-standard"))
    print("## recent subjects")
    emit(probe("log", "-5", "--format=%s"))
    print(f"## {'staged' if staged else 'unstaged'} diff (truncated at 300 lines)")
    emit(git("diff", *(["--cached"] if staged else []), "--unified=2"), 300)


def diff(paths: list[str]) -> None:
    require(paths, "diff needs at least one path", 64)
    for path in paths:
        if succeeds("ls-files", "--error-unmatch", "--", path):
            emit(git("diff", "--unified=2", "--", path), 300)
        else:
            require(Path(path).is_file(), f"no such file: {path}", 64)
            emit(
                decode(
                    invoke(
                        [
                            "git",
                            "diff",
                            "--no-index",
                            "--unified=2",
                            "--",
                            os.devnull,
                            path,
                        ]
                    ).stdout
                ),
                300,
            )


def run(args: list[str]) -> None:
    from .remediation import remediate

    operations = {"commit": commit, "retry": retry, "remediate": remediate}
    operation = args[0] if args else ""
    if operation == "inspect":
        inspect()
    elif operation == "diff":
        diff(args[1:])
    elif operation in operations:
        operations[operation](parse(args[1:], operation))
    else:
        raise RefusalError(
            "usage: commit.sh inspect | diff <path>... | commit [-m <msg>]... [<path>]... | retry --after-hook-failure --refresh-staged <path>... -m <msg> | remediate --after-hook-failure --command <command> --refresh-staged <path>... -m <msg>",
            64,
        )
