"""Evidence input order and presentation metadata."""

from dataclasses import dataclass, field
from pathlib import Path

from .process import RefusalError, require
from .publication import FULL_COMMIT


@dataclass(frozen=True)
class AttachmentInput:
    path: Path
    kind: str
    text: str


@dataclass
class EvidenceOptions:
    expected: str = ""
    body: str = ""
    attachments: list[AttachmentInput] = field(default_factory=list)


def attachment(args: list[str], index: int) -> AttachmentInput:
    flag = args[index]
    kind = flag.removeprefix("--")
    require(
        len(args) >= index + 4 and args[index + 1],
        f"{flag} needs a path and presentation text",
    )
    presentation_flag = "--alt" if kind == "image" else "--explanation"
    require(
        args[index + 2] == presentation_flag,
        f"{flag} must be followed by {presentation_flag}",
    )
    text = args[index + 3]
    require(text.strip(), f"{kind} presentation text must be meaningful")
    require(
        not any(char in text for char in "\n\r\t"),
        f"{kind} presentation text must be one line",
    )
    return AttachmentInput(Path(args[index + 1]), kind, text)


def consume(options: EvidenceOptions, args: list[str], index: int) -> int:
    flag = args[index]
    if flag in {"--image", "--video"}:
        options.attachments.append(attachment(args, index))
        return index + 4
    if flag in {"--expected-head", "--body-file"}:
        require(len(args) > index + 1 and args[index + 1], f"{flag} needs a value")
        setattr(
            options,
            "expected" if flag == "--expected-head" else "body",
            args[index + 1],
        )
        return index + 2
    raise RefusalError(f"error: unknown argument: {flag}")


def parse(args: list[str]) -> EvidenceOptions:
    options = EvidenceOptions()
    index = 0
    while index < len(args):
        index = consume(options, args, index)
    require(
        FULL_COMMIT.fullmatch(options.expected),
        "--expected-head requires a full commit ID",
    )
    require(options.body, "--body-file is required")
    require(len(options.attachments) <= 50, "at most 50 attachments are supported")
    return options
