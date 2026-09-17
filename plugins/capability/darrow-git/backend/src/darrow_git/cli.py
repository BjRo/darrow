"""Console entrypoints with stable process exit contracts."""

import io
import sys
from collections.abc import Callable

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


def create_commit() -> None:
    from .commit import run

    execute(run)


def create_pr() -> None:
    from .pr import run

    execute(run)


def publish_evidence() -> None:
    from .evidence import run

    execute(run)
