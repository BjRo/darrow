"""Commit, retry, and remediation argument contracts."""

from dataclasses import dataclass, field

from .process import RefusalError, require


@dataclass
class CommitOptions:
    messages: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    after_failure: bool = False
    command: str = ""


def parse(args: list[str], operation: str) -> CommitOptions:
    options = CommitOptions()
    index = 0
    while index < len(args):
        index = consume(options, args, index, operation)
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


def consume(options: CommitOptions, args: list[str], index: int, operation: str) -> int:
    flag = args[index]
    if flag == "-m" or (flag == "--command" and operation == "remediate"):
        require(index + 1 < len(args), f"{flag} needs a value", 2)
        if flag == "-m":
            options.messages.append(args[index + 1])
        else:
            options.command = args[index + 1]
        return index + 2
    if operation == "commit":
        options.files.append(flag)
        return index + 1
    return consume_retry(options, args, index, operation)


def consume_retry(
    options: CommitOptions, args: list[str], index: int, operation: str
) -> int:
    flag = args[index]
    if flag == "--after-hook-failure":
        options.after_failure = True
        return index + 1
    if flag == "--refresh-staged":
        index += 1
        stops = {"-m", "--after-hook-failure", "--refresh-staged"}
        if operation == "remediate":
            stops.add("--command")
        while index < len(args) and args[index] not in stops:
            options.files.append(args[index])
            index += 1
        return index
    allowed = (
        "--after-hook-failure, "
        + ("--command, " if operation == "remediate" else "")
        + "--refresh-staged, and -m"
    )
    raise RefusalError(f"error: {operation} accepts only {allowed}", 2)
