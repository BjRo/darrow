"""Public exported-file operations for the frozen phase machine."""

from dataclasses import replace
from pathlib import Path

from . import render, storage
from .artifacts import (
    parse_artifact,
    positive_integer,
    reserved,
    run_identifier,
    table_scalar,
)
from .model import LIMITS, OUTCOMES, PHASES, PREFIX, Attempt, require
from .ticket import Ticket


def init(args: dict[str, str]) -> str:
    body = storage.read(args["body-file"])
    baseline = storage.read(args["baseline-file"])
    require(
        not reserved(baseline)
        and not any(line.startswith("```") for line in baseline.split("\n")),
        "baseline file contains reserved ticket structure",
        2,
    )
    run_identifier(args["run-id"])
    require(
        Path(args["repo"]).is_absolute(),
        f"repository path must be absolute: {args['repo']}",
        2,
    )
    require(
        not any(c in args["base-revision"] for c in "\t\n"),
        "base revision must be one line without tabs",
        2,
    )
    require(
        not reserved(body),
        "ticket body already contains a reserved Ticket Pipeline heading",
    )
    text = render.initialize(
        body, args["run-id"], args["repo"], args["base-revision"], baseline
    )
    output = storage.write(args["output"], text)
    return f"run_id\t{args['run-id']}\nbody\t{output}\n"


def launch(args: dict[str, str]) -> str:
    ticket = Ticket.parse(storage.read(args["body-file"]))
    require(
        ticket.fields["state"] == "active", "cannot launch a child on a non-active run"
    )
    phase = args["phase"]
    require(phase in PHASES, f"unknown phase: {phase}", 2)
    iteration = positive_integer(args["iteration"], "iteration", 2)
    require(iteration <= LIMITS[phase], f"{phase} iteration exceeds its limit")
    for name in ("agent", "harness", "model", "effort"):
        table_scalar(name, args[name])
    require(
        not ticket.history.terminal(launching=True), "run already has a terminal phase"
    )
    require(
        ticket.history.dependency(phase, iteration),
        f"{phase} iteration {iteration} requires its completed dependencies",
    )
    require(
        ticket.history.status(phase) != "in_progress",
        f"{phase} already has an in-flight child",
    )
    attempt = Attempt(
        phase, iteration, args["agent"], args["harness"], args["model"], args["effort"]
    )
    text = render.update_phase(ticket.text, phase, "in_progress", iteration)
    output = storage.write(args["output"], render.append_attempt(text, attempt))
    return f"phase\t{phase}\t{iteration}\nbody\t{output}\n"


def record(args: dict[str, str]) -> str:
    body = storage.read(args["body-file"])
    raw = storage.read(args["artifact-file"])
    storage.output_available(args["output"])
    artifact = parse_artifact(raw)
    ticket = Ticket.parse(body)
    require(
        ticket.fields["run_id"] == artifact.run_id,
        "artifact run does not match ticket run",
    )
    require(
        ticket.fields["state"] == "active",
        "cannot record an artifact on a non-active run",
    )
    state = ticket.history.states[artifact.phase]
    require(state.status == "in_progress", "artifact has no durable in-flight launch")
    require(
        state.iteration == artifact.iteration,
        "artifact iteration does not match the in-flight launch",
    )
    attempt = next(a for a in ticket.history.attempts if a.key == artifact.key)
    require(
        attempt.agent == artifact.agent,
        "artifact child does not match the launch ledger",
    )
    completed = replace(attempt, status=artifact.status, summary=artifact.summary)
    text = render.update_phase(
        body, artifact.phase, artifact.status, artifact.iteration
    )
    text = render.replace_attempt(text, completed)
    text += f"\n{PREFIX}Artifact — {artifact.phase} — Iteration {artifact.iteration}\n\n{raw}\n"
    output = storage.write(args["output"], text)
    return f"run_id\t{artifact.run_id}\nphase\t{artifact.phase}\t{artifact.status}\nbody\t{output}\n"


def summary(args: dict[str, str]) -> str:
    ticket = Ticket.parse(storage.read(args["body-file"]))
    state = ticket.fields["state"]
    phases = "".join(
        f"phase\t{p}\t{s.status}\t{s.iteration}\n"
        for p, s in ticket.history.states.items()
    )
    next_phase = ticket.history.next_phase() if state == "active" else "none"
    return f"format\tdarrow-ticket-pipeline-summary-v1\nrun_id\t{ticket.fields['run_id']}\nstate\t{state}\n{phases}next_phase\t{next_phase}\n"


def reason_text(args: dict[str, str]) -> str:
    path = args.get("reason-file", "")
    if args["status"] != "needs_human":
        require(not path, "--reason-file is only valid with needs_human", 2)
        return ""
    require(bool(path), "needs_human requires --reason-file", 2)
    reason = storage.read(path)
    require(bool(reason.strip()), "reason file is empty", 2)
    require(
        not any(line.startswith("## Ticket Pipeline") for line in reason.split("\n")),
        "reason file must not create pipeline-owned headings",
        2,
    )
    return reason


def finish(args: dict[str, str]) -> str:
    ticket = Ticket.parse(storage.read(args["body-file"]))
    status = args["status"]
    require(status in OUTCOMES, f"invalid finish status: {status}", 2)
    storage.output_available(args["output"])
    require(
        ticket.fields["state"] == "active",
        f"cannot finish a {ticket.fields['state']} run",
    )
    reason = reason_text(args)
    if status == "verified":
        require(
            ticket.history.converged() and ticket.history.next_phase() == "complete",
            "verified run is not converged",
        )
    output = storage.write(args["output"], render.finish(ticket.text, status, reason))
    return f"run_id\t{ticket.fields['run_id']}\nstatus\t{status}\nbody\t{output}\n"
