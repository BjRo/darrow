"""Validate caller input without contacting the provider."""

import re
from pathlib import Path

from .errors import TicketError

TYPE_LABELS = {
    "bug": ("bug",),
    "feature": ("feature", "enhancement"),
    "task": ("task",),
    "chore": ("chore",),
}
HEADINGS = {
    "bug": ("Observed", "Expected", "Reproduction"),
    "feature": ("Motivation", "Acceptance criteria"),
    "task": ("Outcome", "Done criteria"),
    "chore": ("Outcome", "Done criteria"),
}
TOOLS = r"claude|gpt|chatgpt|codex|copilot|cursor|gemini"
ATTRIBUTION = re.compile(
    rf"co-authored-by:.*\b({TOOLS}|ai)\b|"
    rf"co[- ]?authored[- ]by +({TOOLS})\b|"
    rf"(generated|built|written|created|made|assisted)[- ](with|by|using) "
    rf"+\[?({TOOLS}|an? ai\b|ai\b)|🤖",
    re.IGNORECASE,
)


def norm_id(value: str) -> str:
    number = value.removeprefix("#")
    if not re.fullmatch(r"[0-9]+", number):
        raise TicketError(f"error: invalid ticket id: {value}")
    return number.lstrip("0") or "0"


def check_type(kind: str) -> None:
    if kind not in TYPE_LABELS:
        raise TicketError(f"error: unknown type: {kind} (bug, feature, task, chore)")


def type_label(kind: str, labels: list[str]) -> str:
    return next((label for label in TYPE_LABELS[kind] if label in labels), "")


def check_label(value: str) -> None:
    if "," in value:
        raise TicketError(
            f"error: labels containing commas are not supported by the gh backend: {value}",
            8,
        )


def existing_label(value: str, labels: list[str]) -> None:
    check_label(value)
    if value not in labels:
        choices = "\n".join(labels[:50])
        raise TicketError(
            f"error: label does not exist in the tracker: {value} — pick from:\n{choices}",
            8,
        )


def check_title(title: str) -> None:
    if not title.strip():
        raise TicketError("error: title is empty", 5)
    if title.endswith("."):
        raise TicketError("error: title has trailing period", 5)
    if "\n" in title:
        raise TicketError("error: title must be a single line", 5)


def read_body(path: str) -> str:
    try:
        if not Path(path).is_file():
            raise OSError("not a regular file")
        # Preserve original line endings; only get normalizes web-UI CRLF bodies.
        body = Path(path).read_bytes().decode("utf-8").rstrip("\n")
    except (OSError, UnicodeError) as exc:
        raise TicketError(f"error: body file is not a readable file: {path}") from exc
    if not body.strip():
        raise TicketError(f"error: body file is empty: {path}")
    return body


def check_attribution(text: str) -> None:
    if ATTRIBUTION.search(text):
        raise TicketError("error: AI attribution is not allowed in tickets", 6)


def check_markers(body: str, instruction: str) -> None:
    if re.search(r"^(Depends-on|Parent): #[0-9]+$", body, re.MULTILINE):
        raise TicketError(
            f"error: relation lines in the body are not recorded — {instruction}"
        )


def section_lines(body: str) -> list[tuple[str, bool]]:
    """Pair lines with whether they may be interpreted as headings."""
    fenced = False
    result = []
    for raw in body.splitlines():
        line = raw.rstrip()
        fence = bool(re.match(r"^ {0,3}(```|~~~)", line))
        if fence:
            fenced = not fenced
        result.append((line, not (fence or fenced)))
    return result


def section_filled(lines: list[tuple[str, bool]], start: int) -> bool:
    for line, heading in lines[start:]:
        if heading and re.match(r"^#{1,2}[ \t]", line):
            return False
        if line.strip():
            return True
    return False


def check_structure(kind: str, body: str) -> None:
    lines = section_lines(body)
    for name in HEADINGS[kind]:
        heading = f"## {name}"
        try:
            start = lines.index((heading, True)) + 1
        except ValueError as exc:
            raise TicketError(
                f"error: required section missing for type {kind}: {heading}", 7
            ) from exc
        if not section_filled(lines, start):
            raise TicketError(f"error: required section is empty: {heading}", 7)
