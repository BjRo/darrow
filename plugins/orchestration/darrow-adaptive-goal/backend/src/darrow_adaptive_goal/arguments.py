"""Small option grammar preserving the helpers' refusal contract."""

from __future__ import annotations

from .common import RefusalError


def options(args: list[str], names: set[str], label: str) -> dict[str, str]:
    result: dict[str, str] = {}
    tokens = iter(args)
    for name in tokens:
        if name not in names:
            raise RefusalError(f"unknown {label}option: {name}")
        value = next(tokens, "")
        if not value:
            raise RefusalError(f"missing value for {name}")
        result[name.removeprefix("--")] = value
    return result


def require(values: dict[str, str], names: set[str], message: str) -> None:
    if not names <= values.keys():
        raise RefusalError(message)
