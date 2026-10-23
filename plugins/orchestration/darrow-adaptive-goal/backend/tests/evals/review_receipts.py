"""Hidden oracle for candidate-bound synthetic review receipts."""

from __future__ import annotations

import argparse
from collections.abc import Iterable
from pathlib import Path


class InvalidReceiptError(ValueError):
    """Required current clear review evidence is absent or invalid."""


def validate(lines: Iterable[str], expected: str, record_format: str) -> int:
    expected_row = {
        "comprehensive": [expected, "clear", "comprehensive"],
        "events": ["review", expected],
    }[record_format]
    seen = 0
    for line in lines:
        fields = line.removesuffix("\n").split("\t")
        if record_format == "events" and fields[0] != "review":
            continue
        if fields != expected_row:
            raise InvalidReceiptError(
                f"Invalid independent review record: {line.rstrip()}"
            )
        seen += 1
    if not seen:
        raise InvalidReceiptError("Missing independent review evidence")
    return seen


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", required=True, choices=["comprehensive", "events"])
    parser.add_argument("--expected", required=True)
    parser.add_argument("path", type=Path)
    args = parser.parse_args(argv)
    print(f"Expected reviewed target: {args.expected}")
    try:
        with args.path.open(encoding="utf-8") as stream:
            count = validate(stream, args.expected, args.format)
    except (OSError, UnicodeError, InvalidReceiptError) as error:
        print(f"Missing or invalid independent review evidence: {error}")
        return 1
    print(f"Valid current independent review records: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
