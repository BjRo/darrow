"""Parse branch command arguments without changing refusals."""

from collections import deque
from dataclasses import dataclass

from .arguments import take_value
from .process import RefusalError, require


@dataclass
class BranchOptions:
    name: str = ""
    base: str = ""
    ticket_id: str = ""
    worktree: bool = False
    at: str | None = None


def option_value(args: deque[str], flag: str, task: bool) -> str:
    messages = {
        "--from": "--from needs a value",
        "--ticket-id": "--ticket-id needs a non-empty opaque value",
        "--at": "--at needs a non-empty path" if task else "--at needs a value",
    }
    value = take_value(args, messages[flag])
    if flag == "--ticket-id" or (flag == "--at" and task):
        require(value, messages[flag], 2)
    return value


def parse(args: list[str], *, task: bool) -> BranchOptions:
    options = BranchOptions()
    remaining = deque(args)
    while remaining:
        consume(options, remaining.popleft(), remaining, task)
    require(options.name, "no branch name given", 2)
    if task:
        require(
            options.ticket_id,
            "prepare requires the active provider's opaque ticket ID",
            2,
        )
    require(options.at is None or options.worktree, "--at requires --worktree", 2)
    require(options.at != "", "--at needs a non-empty path", 2)
    return options


def consume(options: BranchOptions, flag: str, args: deque[str], task: bool) -> None:
    fields = {"--from": "base", "--ticket-id": "ticket_id", "--at": "at"}
    if flag in fields:
        setattr(options, fields[flag], option_value(args, flag, task))
        return
    if flag == "--worktree":
        options.worktree = True
        return
    if flag.startswith("-"):
        raise RefusalError(f"error: unknown flag: {flag}", 2)
    require(not options.name, "exactly one branch name allowed", 2)
    options.name = flag
