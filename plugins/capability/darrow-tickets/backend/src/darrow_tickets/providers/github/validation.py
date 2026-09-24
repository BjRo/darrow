"""GitHub identifiers, label taxonomy, and relation marker rules."""

import re

from ...errors import TicketError

TYPE_LABELS = {
    "bug": ("bug",),
    "feature": ("feature", "enhancement"),
    "task": ("task",),
    "chore": ("chore",),
}


def norm_id(value: str) -> str:
    number = value.removeprefix("#")
    if not re.fullmatch(r"[0-9]+", number):
        raise TicketError(f"error: invalid ticket id: {value}")
    return number.lstrip("0") or "0"


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


def check_markers(body: str, instruction: str) -> None:
    if re.search(r"^(Depends-on|Parent): #[0-9]+$", body, re.MULTILINE):
        raise TicketError(
            f"error: relation lines in the body are not recorded — {instruction}"
        )
