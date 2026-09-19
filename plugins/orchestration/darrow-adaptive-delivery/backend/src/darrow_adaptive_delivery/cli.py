"""Console boundaries: stable stdout records, stderr refusals, exit 2."""

from __future__ import annotations

import sys
from collections.abc import Callable
from io import TextIOWrapper

from . import claude, doctor
from . import preflight as preparation
from .common import RefusalError


def execute(name: str, run: Callable[[list[str]], str]) -> int:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    try:
        output = run(sys.argv[1:])
    except (RefusalError, OSError, UnicodeError) as error:
        print(f"{name}: {error}", file=sys.stderr)
        return 2
    sys.stdout.write(output)
    return 0


def preflight() -> int:
    return execute("adaptive-delivery-preflight", preparation.run)


def claude_route() -> int:
    return execute("claude-agent-route", claude.run)


def host_doctor() -> int:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    try:
        output = doctor.run(sys.argv[1:])
    except doctor.UsageError:
        sys.stderr.write(doctor.USAGE)
        return 2
    except doctor.DiagnosisError as error:
        sys.stdout.write(error.output)
        sys.stderr.write(error.diagnostic)
        return 1
    sys.stdout.write(output)
    return 0
