"""Console boundaries: stable stdout records, stderr refusals, exit 2."""

from __future__ import annotations

import sys
from collections.abc import Callable

from . import claude
from . import preflight as preparation
from .common import RefusalError


def execute(name: str, run: Callable[[list[str]], str]) -> int:
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
