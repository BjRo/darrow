"""Public CLI boundaries with stable status codes."""

import argparse
import io
import sys
from collections.abc import Callable, Sequence
from typing import NoReturn

from darrow_ia import checks, report, setup
from darrow_ia.filesystem import resolve_root
from darrow_ia.graph import (
    Audit,
    check_reachability,
    choose_runtime,
    cycles,
    inventory,
    traverse,
)

DOCTOR_USAGE = "usage: ia-doctor inspect|verify [--runtime auto|both|codex|claude] [--mirror source=target]... [repository]"
SETUP_USAGE = "usage: ia-setup inspect [repository]"


class UsageError(Exception):
    """Arguments do not match the public command contract."""


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> NoReturn:
        raise UsageError(self.usage)


def parser(doctor: bool) -> Parser:
    result = Parser(add_help=False, usage=DOCTOR_USAGE if doctor else SETUP_USAGE)
    result.add_argument(
        "mode", choices=("inspect", "verify") if doctor else ("inspect",)
    )
    if doctor:
        result.add_argument(
            "--runtime", choices=("auto", "both", "codex", "claude"), default="auto"
        )
        result.add_argument("--mirror", action="append", default=[])
    result.add_argument("repository", nargs="?", default=".")
    return result


def doctor(arguments: Sequence[str]) -> int:
    args = parser(True).parse_intermixed_args(arguments)
    root = resolve_root(args.repository)
    for spec in args.mirror:
        try:
            checks.mirror_paths(spec, root)
        except ValueError as error:
            raise UsageError(f"error: {error}") from error
    audit = Audit(root, choose_runtime(root, args.runtime))
    inventory(audit)
    extra = checks.check_mirrors(audit, args.mirror)
    traverse(audit, extra)
    check_reachability(audit)
    audit.findings["instruction-cycle"].update(cycles(audit.edges))
    checks.duplicates(audit, args.mirror, checks.root_adapter(audit))
    checks.metrics(audit)
    print(report.render(audit), end="")
    return int(args.mode == "verify" and report.failed(audit))


def setup_command(arguments: Sequence[str]) -> int:
    args = parser(False).parse_args(arguments)
    print(setup.inspect(resolve_root(args.repository)), end="")
    return 0


def run(command: Callable[[Sequence[str]], int], arguments: Sequence[str]) -> int:
    try:
        configure_output()
        return command(arguments)
    except UsageError as error:
        print(error, file=sys.stderr)
        return 64
    except (OSError, ValueError, RuntimeError) as error:
        # Process boundary: inaccessible evidence must never produce a passing audit.
        print(f"error: {error}", file=sys.stderr)
        return 2


def configure_output() -> None:
    """Keep machine-facing path records UTF-8 on native Windows pipes too."""
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")


def doctor_entrypoint() -> None:
    sys.exit(run(doctor, sys.argv[1:]))


def setup_entrypoint() -> None:
    sys.exit(run(setup_command, sys.argv[1:]))
