"""Combine fixture row literals and JSON helper output into one JSON artifact."""

from __future__ import annotations

import json
import sys


def assemble(source: str) -> list[list[str]]:
    decoder = json.JSONDecoder()
    result: list[list[str]] = []
    position = 0
    while position < len(source):
        if source[position].isspace():
            position += 1
            continue
        if source[position] == "[":
            rows, length = decoder.raw_decode(source[position:])
            result.extend(rows)
            position += length
            continue
        end = source.find("\n", position)
        if end < 0:
            end = len(source)
        result.append(source[position:end].split("\t"))
        position = end + 1
    return result


if __name__ == "__main__":
    print(json.dumps(assemble(sys.stdin.read()), ensure_ascii=False))
