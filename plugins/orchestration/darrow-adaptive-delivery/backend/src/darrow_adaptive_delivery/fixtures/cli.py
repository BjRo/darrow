"""One eval-only entrypoint for synthetic capabilities and their installation."""

from __future__ import annotations

import sys
from pathlib import Path

from ..cli import execute
from ..common import CheckRequiredError, RefusalError
from . import install, proof, readiness, review

USAGE = """usage: adaptive-delivery-fixture <operation> [arguments]
  install readiness|review|verification REPO FIXTURE_DIR codex|claude|both
  readiness REPO [record|render-only]
  review REPO comprehensive|verify|fingerprint [contract]
  verification REPO initial|follow-up
  proof complete ARTIFACT|artifact|current
"""


def dispatch(args: list[str]) -> str:
    if not args or args[0] in {"-h", "--help"}:
        return USAGE
    command, *rest = args
    if command == "install" and len(rest) == 4:
        return install.install(rest[0], Path(rest[1]), Path(rest[2]), rest[3])
    if command == "readiness" and 1 <= len(rest) <= 2:
        return readiness.assess(Path(rest[0]), rest[1] if len(rest) == 2 else "record")
    return assess(command, rest)


def assess(command: str, args: list[str]) -> str:
    if command == "review" and 2 <= len(args) <= 3:
        return review.assess(Path(args[0]), args[1], args[2] if len(args) == 3 else "")
    if command == "verification" and len(args) == 2:
        if not Path(__file__).with_name("verification.py").is_file():
            raise RefusalError("verification fixture is not installed")
        from . import verification

        return verification.assess(Path(args[0]), args[1])
    if command == "proof" and 1 <= len(args) <= 2:
        return proof.validate(Path.cwd(), args[0], args[1] if len(args) == 2 else "")
    raise RefusalError(USAGE.rstrip())


def main() -> int:
    try:
        return execute("adaptive-delivery-fixture", dispatch)
    except CheckRequiredError as error:
        print(error)
        return 1
    except proof.InvalidProofError as error:
        print(f"review proof: {error}", file=sys.stderr)
        return 1
