"""Preserve the reference ticket serialization, including user-owned content."""

from collections.abc import Callable

from .model import PHASES, PREFIX, TICKET_FORMAT, Attempt


def initialize(body: str, run_id: str, repo: str, revision: str, baseline: str) -> str:
    rows = "".join(f"| {phase} | pending | 0 |\n" for phase in PHASES)
    return (
        body + f"\n\n{PREFIX}Run\n\nformat\t{TICKET_FORMAT}\n"
        f"run_id\t{run_id}\nstate\tactive\nrepository\t{repo}\nbase_revision\t{revision}\n"
        f"\n{PREFIX}User Work Baseline\n\n```text\n"
        + (baseline or "(clean)\n")
        + "```\n"
        f"\n{PREFIX}Phase State\n\n| Phase | Status | Iteration |\n| --- | --- | ---: |\n"
        + rows
        + f"\n{PREFIX}Execution Ledger\n\n"
        "| Phase | Iteration | Agent | Harness | Model | Effort | Status | Summary |\n"
        "| --- | ---: | --- | --- | --- | --- | --- | --- |\n"
    )


def transform_section(text: str, heading: str, transform: Callable[[str], str]) -> str:
    inside = False
    output: list[str] = []
    for line in text.rstrip("\n").split("\n"):
        if line.startswith("## "):
            inside = line == heading
        output.append(transform(line) if inside else line)
    # awk preserves existing trailing blank records, plus a final newline.
    trailing = len(text) - len(text.rstrip("\n"))
    return "\n".join(output) + "\n" * max(1, trailing)


def update_phase(text: str, phase: str, status: str, iteration: int) -> str:
    return transform_section(
        text,
        PREFIX + "Phase State",
        lambda line: (
            f"| {phase} | {status} | {iteration} |"
            if line.startswith(f"| {phase} |")
            else line
        ),
    )


def append_attempt(text: str, attempt: Attempt) -> str:
    # Insert immediately before the next section, keeping its preceding blank lines.
    heading = PREFIX + "Execution Ledger\n"
    start = 0 if text.startswith(heading) else text.index("\n" + heading) + 1
    end = text.find("\n## ", start)
    if end == -1:
        return text + attempt.row() + "\n"
    return text[: end + 1] + attempt.row() + "\n" + text[end + 1 :]


def replace_attempt(text: str, attempt: Attempt) -> str:
    return transform_section(
        text,
        PREFIX + "Execution Ledger",
        lambda line: (
            attempt.row()
            if line.startswith(f"| {attempt.phase} | {attempt.iteration} |")
            else line
        ),
    )


def finish(text: str, status: str, reason: str) -> str:
    result = transform_section(
        text,
        PREFIX + "Run",
        lambda line: f"state\t{status}" if line.startswith("state\t") else line,
    )
    if status == "needs_human":
        result += f"\n{PREFIX}Escalation\n\n{reason}\n"
    return result
