"""Commit, retry, and remediation argument contracts."""

from collections import deque
from dataclasses import dataclass, field

from .arguments import take_value
from .process import RefusalError, require


@dataclass
class CommitOptions:
    messages: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    after_failure: bool = False
    command: str = ""


def parse(args: list[str], operation: str) -> CommitOptions:
    options = CommitOptions()
    remaining = deque(args)
    while remaining:
        consume(options, remaining.popleft(), remaining, operation)
    if operation == "commit":
        require(options.messages, "no -m message given", 2)
    else:
        validate_retry(options, operation)
    return options


def validate_retry(options: CommitOptions, operation: str) -> None:
    command_text = ", --command" if operation == "remediate" else ""
    require(
        options.after_failure and options.files and options.messages,
        f"{operation} needs --after-hook-failure{command_text}, --refresh-staged <path>..., and -m",
        2,
    )
    if operation == "remediate":
        require(
            options.command,
            "remediate needs --after-hook-failure, --command, --refresh-staged <path>..., and -m",
            2,
        )


def consume(
    options: CommitOptions, flag: str, args: deque[str], operation: str
) -> None:
    if flag == "-m" or (flag == "--command" and operation == "remediate"):
        value = take_value(args, f"{flag} needs a value")
        if flag == "-m":
            options.messages.append(value)
        else:
            options.command = value
        return
    if operation == "commit":
        options.files.append(flag)
        return
    consume_retry(options, flag, args, operation)


def consume_retry(
    options: CommitOptions, flag: str, args: deque[str], operation: str
) -> None:
    if flag == "--after-hook-failure":
        options.after_failure = True
        return
    if flag == "--refresh-staged":
        stops = {"-m", "--after-hook-failure", "--refresh-staged"}
        if operation == "remediate":
            stops.add("--command")
        while args and args[0] not in stops:
            options.files.append(args.popleft())
        return
    allowed = (
        "--after-hook-failure, "
        + ("--command, " if operation == "remediate" else "")
        + "--refresh-staged, and -m"
    )
    raise RefusalError(f"error: {operation} accepts only {allowed}", 2)
