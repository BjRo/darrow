"""Hidden oracle for focused feedback followed by successful final verification."""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from pathlib import Path


class InvalidCadenceError(ValueError):
    """Required successful focused and final evidence is absent or invalid."""


def event(line: str) -> tuple[str, bool]:
    fields = line.removesuffix("\n").split("\t")
    if (
        len(fields) != 2
        or fields[0] not in {"focused", "final"}
        or fields[1] not in {"pass", "fail"}
    ):
        raise InvalidCadenceError(f"Invalid verification record: {line.rstrip()}")
    return fields[0], fields[1] == "pass"


def advance(
    focused: bool, final: bool, observation: tuple[str, bool]
) -> tuple[bool, bool]:
    stage, passed = observation
    if stage == "focused":
        return passed, final and passed
    return focused, focused and passed


def validate(lines: Iterable[str]) -> None:
    focused = final = False
    for line in lines:
        focused, final = advance(focused, final, event(line))
    if not (focused and final):
        raise InvalidCadenceError(
            "Successful focused feedback must precede successful final verification; "
            "later failures require fresh successful evidence"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    args = parser.parse_args(argv)
    try:
        with args.path.open(encoding="utf-8") as stream:
            validate(stream)
    except (OSError, UnicodeError, InvalidCadenceError) as error:
        print(f"Missing or invalid verification cadence: {error}")
        return 1
    print("Successful focused feedback and final verification retained")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
