"""Validate phase artifacts at the exported UTF-8 boundary."""

import re
from dataclasses import dataclass

from .model import ARTIFACT_FORMAT, HEADERS, LIMITS, STATUSES, require


def run_identifier(value: str) -> None:
    require(
        bool(re.fullmatch(r"[A-Za-z0-9._-]+", value)),
        "run id must use only letters, digits, dot, underscore, or hyphen",
        2,
    )
    require(len(value) <= 128, "run id must be at most 128 characters", 2)


def table_scalar(name: str, value: str, limit: int = 128) -> None:
    require(
        bool(value) and not any(c in value for c in "|\t\n"),
        f"{name} is empty or contains a table delimiter",
    )
    require(len(value) <= limit, f"{name} exceeds {limit} characters")


def positive_integer(value: str, label: str, code: int = 4) -> int:
    require(
        bool(re.fullmatch(r"[0-9]+", value)) and len(value) <= 19 and int(value) > 0,
        f"{label} must be a positive integer",
        code,
    )
    return int(value)


def reserved(text: str) -> bool:
    return bool(re.search(r"^## Ticket Pipeline(?:\s|$)", text, re.MULTILINE))


@dataclass(frozen=True)
class Artifact:
    run_id: str
    phase: str
    iteration: int
    agent: str
    status: str
    summary: str
    text: str

    @property
    def key(self) -> tuple[str, int]:
        return self.phase, self.iteration


def header(lines: list[str], number: int, key: str) -> str:
    line = lines[number - 1] if number <= len(lines) else ""
    require(
        line.startswith(key + "\t"), f"artifact line {number} must be {key}<TAB>value"
    )
    value = line[len(key) + 1 :]
    require(
        bool(value) and "\t" not in value,
        f"artifact field {key} must contain one non-empty value",
    )
    return value


def parse_artifact(text: str, *, persisted: bool = False) -> Artifact:
    lines = text.split("\n")
    values = dict(
        zip(
            HEADERS,
            (header(lines, n, key) for n, key in enumerate(HEADERS, 1)),
            strict=True,
        )
    )
    require(
        values["format"] == ARTIFACT_FORMAT,
        f"unsupported artifact format: {values['format']}",
    )
    require(len(lines) > 7 and lines[7] == "---", "artifact line 8 must be ---")
    evidence = "\n".join(lines[8:])
    require(bool(evidence.strip()), "artifact Markdown evidence is empty")
    require(
        not reserved(evidence),
        "artifact Markdown must not create pipeline-owned headings",
    )
    iteration = positive_integer(values["iteration"], "artifact iteration")
    phase = values["phase"]
    require(phase in STATUSES, f"unknown phase: {phase}")
    require(
        values["status"] in STATUSES[phase],
        f"status {values['status']} is invalid for phase {phase}",
    )
    if not persisted:
        validate_new(values, iteration)
    return Artifact(
        values["run_id"],
        phase,
        iteration,
        values["agent"],
        values["status"],
        values["summary"],
        text,
    )


def validate_new(values: dict[str, str], iteration: int) -> None:
    run_identifier(values["run_id"])
    phase = values["phase"]
    require(
        iteration <= LIMITS[phase], f"{phase} iteration exceeds limit {LIMITS[phase]}"
    )
    table_scalar("artifact agent", values["agent"])
    table_scalar("artifact summary", values["summary"], 500)
