"""Deterministic admission arithmetic and explicit reply framing."""

from collections.abc import Mapping
from dataclasses import dataclass


def integer(values: Mapping[str, object], name: str, default: int, minimum: int) -> int:
    value = values.get(name, default)
    if type(value) is not int or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")
    return value


@dataclass(frozen=True)
class Limits:
    wip: int = 1
    schedule_seconds: int = 900

    @classmethod
    def from_mapping(cls, values: Mapping[str, object]) -> "Limits":
        return cls(
            integer(values, "WORK_IN_PROGRESS_LIMIT", 1, 0),
            integer(values, "SCHEDULE_SECONDS", 900, 1),
        )


def allowance(limits: Limits, occupied: int, eligible: int) -> int:
    return min(max(0, limits.wip - occupied), 1, eligible)
