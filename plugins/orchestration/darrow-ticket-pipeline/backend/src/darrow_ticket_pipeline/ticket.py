"""Reconcile durable phase state, ordered attempts, and retained artifacts."""

import re
from dataclasses import dataclass

from .artifacts import Artifact, parse_artifact, positive_integer
from .model import (
    OUTCOMES,
    PHASES,
    PREFIX,
    STATUSES,
    TICKET_FORMAT,
    Attempt,
    History,
    PhaseState,
    require,
)


def sections(text: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    current = ""
    for line in text.split("\n"):
        if line.startswith("## Ticket Pipeline"):
            current = line
            require(
                current not in result or not current.startswith(PREFIX),
                "duplicate ticket section",
            )
            result.setdefault(current, [])
        else:
            result.setdefault(current, []).append(line)
    return result


def run_fields(lines: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in lines:
        if line.startswith("## "):
            break
        key, _, value = line.partition("\t")
        if key not in {"format", "run_id", "state", "repository", "base_revision"}:
            continue
        require(
            key not in fields and "\t" not in value, f"ticket body has no valid {key}"
        )
        fields[key] = value
    require(
        fields.get("format") == TICKET_FORMAT,
        "ticket body has no valid Ticket Pipeline Run format",
    )
    require("run_id" in fields, "ticket body has no valid run id")
    require(fields.get("state") in OUTCOMES | {"active"}, "unknown ticket run state")
    return fields


def phase_states(lines: list[str]) -> dict[str, PhaseState]:
    states: dict[str, PhaseState] = {}
    for line in lines:
        if not re.match(r"^\| (" + "|".join(PHASES) + r") \|", line):
            continue
        parts = [value.strip() for value in line.split("|")]
        require(len(parts) >= 4, "ticket phase table is malformed")
        phase, status, iteration = parts[1:4]
        require(
            phase not in states
            and len(iteration) <= 19
            and bool(re.fullmatch(r"[0-9]+", iteration)),
            "ticket phase table is malformed",
        )
        states[phase] = PhaseState(status, int(iteration))
    require(set(states) == set(PHASES), "ticket phase table is incomplete")
    return states


def parse_attempt(line: str) -> Attempt:
    parts = [value.strip() for value in line.split("|")][1:9]
    require(len(parts) == 8 and all(parts), "ticket execution ledger is malformed")
    phase, iteration, agent, harness, model, effort, status, summary = parts
    require(
        len(iteration) <= 19 and bool(re.fullmatch(r"[1-9][0-9]*", iteration)),
        "ticket ledger iteration is invalid",
    )
    require(status in STATUSES[phase] | {"launched"}, "ticket ledger status is invalid")
    return Attempt(
        phase, int(iteration), agent, harness, model, effort, status, summary
    )


def history_from(lines: list[str]) -> History:
    history = History()
    for line in lines:
        if not re.match(r"^\| (" + "|".join(PHASES) + r") \| [0-9]+ \|", line):
            continue
        attempt = parse_attempt(line)
        require(
            history.dependency(attempt.phase, attempt.iteration),
            "ticket ledger dependencies are contradictory",
        )
        history.advance(attempt)
    return history


def retained_artifacts(parts: dict[str, list[str]]) -> dict[tuple[str, int], Artifact]:
    artifacts: dict[tuple[str, int], Artifact] = {}
    for heading, lines in parts.items():
        if not heading.startswith(PREFIX + "Artifact — "):
            continue
        match = re.fullmatch(
            PREFIX + r"Artifact — (\w+) — Iteration ([1-9][0-9]*)", heading
        )
        require(match is not None, "ticket artifact heading is malformed")
        assert match is not None
        require(
            bool(lines) and lines[0] == "", "ticket artifact must follow a blank line"
        )
        artifact = parse_artifact("\n".join(lines[1:]), persisted=True)
        require(
            artifact.key
            == (match[1], positive_integer(match[2], "artifact heading iteration")),
            "ticket artifact heading does not match its header",
        )
        require(artifact.key not in artifacts, "duplicate ticket artifact")
        artifacts[artifact.key] = artifact
    return artifacts


@dataclass
class Ticket:
    text: str
    fields: dict[str, str]
    history: History

    @classmethod
    def parse(cls, text: str) -> "Ticket":
        parts = sections(text)
        required = {
            PREFIX + name
            for name in ("Run", "User Work Baseline", "Phase State", "Execution Ledger")
        }
        require(required <= parts.keys(), "ticket pipeline sections are incomplete")
        allowed = required | {PREFIX + "Escalation"}
        require(
            all(
                h in allowed or h.startswith(PREFIX + "Artifact — ")
                for h in parts
                if h.startswith("## Ticket Pipeline")
            ),
            "unknown pipeline-owned heading",
        )
        fields = run_fields(parts[PREFIX + "Run"])
        history = history_from(parts[PREFIX + "Execution Ledger"])
        require(
            history.states == phase_states(parts[PREFIX + "Phase State"]),
            "ticket phase state contradicts its ledger",
        )
        reconcile(history, retained_artifacts(parts), fields["run_id"])
        if fields["state"] == "verified":
            require(history.converged(), "verified ticket has unconverged evidence")
        return cls(text, fields, history)


def reconcile(
    history: History, artifacts: dict[tuple[str, int], Artifact], run_id: str
) -> None:
    completed = [a for a in history.attempts if a.status != "launched"]
    require(
        len(completed) == len(artifacts), "ticket ledger and artifact counts differ"
    )
    for attempt in completed:
        require(
            attempt.key in artifacts, "ticket ledger is missing its retained artifact"
        )
        artifact = artifacts[attempt.key]
        require(
            (artifact.run_id, artifact.agent, artifact.status, artifact.summary)
            == (run_id, attempt.agent, attempt.status, attempt.summary),
            "ticket artifact contradicts its ledger",
        )
