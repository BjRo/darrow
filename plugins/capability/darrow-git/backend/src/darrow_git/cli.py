"""Console entrypoints with stable process exit contracts."""

import io
import sys
from collections.abc import Callable

from . import commit, remediation
from .commit_options import parse as parse_commit
from .process import RefusalError


def execute(operation: Callable[[list[str]], None]) -> None:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", errors="surrogateescape", newline="\n")
    try:
        operation(sys.argv[1:])
    except RefusalError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(error.code) from error
    except OSError as error:
        # Explicit CLI filesystem boundary: refuse rather than leak a traceback
        # or suggest completion after an unreadable artifact/provider failure.
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(4) from error


def create_branch() -> None:
    from .branch import run

    execute(run)


def prepare_branch() -> None:
    from .branch import run

    execute(lambda args: run(args, task=True))


def run_commit(args: list[str]) -> None:
    operations = {
        "commit": commit.commit,
        "retry": commit.retry,
        "remediate": remediation.remediate,
    }
    operation = args[0] if args else ""
    if operation == "inspect":
        commit.inspect()
    elif operation == "diff":
        commit.diff(args[1:])
    elif operation in operations:
        operations[operation](parse_commit(args[1:], operation))
    else:
        raise RefusalError(
            "usage: darrow-create-commit inspect | diff <path>... | commit [-m <msg>]... [<path>]... | retry --after-hook-failure --refresh-staged <path>... -m <msg> | remediate --after-hook-failure --command <command> --refresh-staged <path>... -m <msg>",
            64,
        )


def create_commit() -> None:
    execute(run_commit)


def create_pr() -> None:
    from .pr import run

    execute(run)


def publish_evidence() -> None:
    from .evidence import run

    execute(run)
