"""Evidence input order and presentation metadata."""

from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from .arguments import take_value
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


def attachment(args: deque[str], flag: str) -> AttachmentInput:
    kind = flag.removeprefix("--")
    require(
        len(args) >= 3 and args[0],
        f"{flag} needs a path and presentation text",
    )
    path = Path(args.popleft())
    presentation_flag = "--alt" if kind == "image" else "--explanation"
    require(
        args.popleft() == presentation_flag,
        f"{flag} must be followed by {presentation_flag}",
    )
    text = args.popleft()
    require(text.strip(), f"{kind} presentation text must be meaningful")
    require(
        not any(char in text for char in "\n\r\t"),
        f"{kind} presentation text must be one line",
    )
    return AttachmentInput(path, kind, text)


def consume(options: EvidenceOptions, flag: str, args: deque[str]) -> None:
    if flag in {"--image", "--video"}:
        options.attachments.append(attachment(args, flag))
        return
    if flag in {"--expected-head", "--body-file"}:
        value = take_value(args, f"{flag} needs a value", 4)
        require(value, f"{flag} needs a value")
        setattr(
            options,
            "expected" if flag == "--expected-head" else "body",
            value,
        )
        return
    raise RefusalError(f"error: unknown argument: {flag}")


def parse(args: list[str]) -> EvidenceOptions:
    options = EvidenceOptions()
    remaining = deque(args)
    while remaining:
        consume(options, remaining.popleft(), remaining)
    require(
        FULL_COMMIT.fullmatch(options.expected),
        "--expected-head requires a full commit ID",
    )
    require(options.body, "--body-file is required")
    require(len(options.attachments) <= 50, "at most 50 attachments are supported")
    return options
