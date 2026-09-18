"""Small option grammar preserving the helpers' refusal contract."""

from __future__ import annotations

from .common import RefusalError


def options(args: list[str], names: set[str], label: str) -> dict[str, str]:
    result: dict[str, str] = {}
    position = 0
    while position < len(args):
        name = args[position]
        if name not in names:
            raise RefusalError(f"unknown {label}option: {name}")
        if position + 1 == len(args) or not args[position + 1]:
            raise RefusalError(f"missing value for {name}")
        result[name.removeprefix("--")] = args[position + 1]
        position += 2
    return result


def require(values: dict[str, str], names: set[str], message: str) -> None:
    if not names <= values.keys():
        raise RefusalError(message)
