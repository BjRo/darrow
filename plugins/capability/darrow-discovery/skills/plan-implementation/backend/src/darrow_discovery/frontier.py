"""Validate and render one implementation-planning decision frontier."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from dataclasses import dataclass
from io import TextIOWrapper
from typing import cast

PROGRAM_NAME = "darrow-render-plan-frontier"
USAGE = (
    f"usage: {PROGRAM_NAME} --evidence TEXT --question TEXT --option LABEL "
    "--option LABEL [--option LABEL ...] --choice LABEL --rationale TEXT "
    "--deferred TEXT"
)
FIELD_FLAGS = {
    "--evidence": "evidence",
    "--question": "question",
    "--choice": "choice",
    "--rationale": "rationale",
    "--deferred": "deferred",
}


class UsageError(Exception):
    """Signal malformed command syntax."""


class FrontierError(Exception):
    """Signal a structurally invalid frontier."""


@dataclass(frozen=True)
class Frontier:
    """Fields used to render one root question and its deferred children."""

    evidence: str
    question: str
    options: tuple[str, ...]
    choice: str
    rationale: str
    deferred: str


def parse(arguments: Sequence[str]) -> Frontier:
    """Parse the renderer's stable flag-and-value command contract."""
    fields = dict.fromkeys(FIELD_FLAGS.values(), "")
    options: list[str] = []
    if len(arguments) % 2:
        raise UsageError
    for index in range(0, len(arguments), 2):
        flag, value = arguments[index : index + 2]
        if flag == "--option":
            options.append(value)
        elif flag in FIELD_FLAGS:
            fields[FIELD_FLAGS[flag]] = value
        else:
            raise UsageError
    return Frontier(options=tuple(options), **fields)


def _validate_fields(frontier: Frontier) -> None:
    values = (
        frontier.evidence,
        frontier.question,
        frontier.choice,
        frontier.rationale,
        frontier.deferred,
    )
    for value in values:
        if not value:
            raise FrontierError("every frontier field must be non-empty")
        if "\n" in value:
            raise FrontierError("frontier fields must each be one line")


def _validate_options(frontier: Frontier) -> None:
    if len(frontier.options) < 2:
        raise FrontierError("the root question must declare at least two option labels")
    for option in frontier.options:
        if not option:
            raise FrontierError("root option labels must be non-empty")
        if "\n" in option:
            raise FrontierError("root option labels must each be one line")


def _validate_presentation(frontier: Frontier) -> None:
    if frontier.question.count("?") != 1:
        raise FrontierError("the root question must contain exactly one question mark")
    if "(" in frontier.question or ")" in frontier.question:
        raise FrontierError(
            "the root question must use short option labels without "
            "parenthesized mechanics"
        )
    if "?" in frontier.rationale + frontier.deferred:
        raise FrontierError("only the root question may ask a question")
    deferred = f" {frontier.deferred.lower()} "
    if any(token in deferred for token in ("(", ")", " vs ", " versus ")):
        raise FrontierError(
            "deferred decisions must be category names without child-option examples"
        )


def _validate_choice(frontier: Frontier) -> None:
    question = frontier.question.lower()
    choice = frontier.choice.lower()
    choice_found = False
    for option in frontier.options:
        normalized = option.lower()
        if normalized not in question:
            raise FrontierError(f"root option '{option}' is absent from the question")
        if normalized == choice:
            choice_found = True
    if not choice_found:
        raise FrontierError(
            "the recommended choice must equal one declared root option"
        )


def validate(frontier: Frontier) -> None:
    """Apply the renderer's structural checks in their stable order."""
    _validate_fields(frontier)
    _validate_options(frontier)
    _validate_presentation(frontier)
    _validate_choice(frontier)


def render(frontier: Frontier) -> str:
    """Render an already validated frontier in the canonical Markdown shape."""
    evidence = frontier.evidence.removesuffix(".")
    rationale = frontier.rationale.removesuffix(".")
    deferred = frontier.deferred.removesuffix(".")
    return (
        f"Evidence: {evidence}.\n\n"
        f"Q1 — {frontier.question}\n\n"
        f"Recommendation: Choose {frontier.choice} because {rationale}.\n\n"
        f"Deferred: {deferred}. After your answer, I will recompute the next "
        "frontier.\n"
    )


def main(arguments: Sequence[str] | None = None) -> int:
    """Run the renderer and return its public process status."""
    actual_arguments = tuple(sys.argv[1:] if arguments is None else arguments)
    try:
        frontier = parse(actual_arguments)
    except UsageError:
        print(USAGE, file=sys.stderr)
        return 2
    try:
        validate(frontier)
    except FrontierError as error:
        print(error, file=sys.stderr)
        return 2
    sys.stdout.write(render(frontier))
    return 0


def entrypoint() -> None:
    """Run the installed console entrypoint."""
    cast(TextIOWrapper, sys.stdout).reconfigure(encoding="utf-8", newline="\n")
    cast(TextIOWrapper, sys.stderr).reconfigure(encoding="utf-8", newline="\n")
    raise SystemExit(main())
