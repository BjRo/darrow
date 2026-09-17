"""Parse the compatibility branch command arguments without changing refusals."""

from dataclasses import dataclass

from .process import RefusalError, require


@dataclass
class BranchOptions:
    name: str = ""
    base: str = ""
    token: str = ""
    worktree: bool = False
    at: str | None = None


def option_value(args: list[str], index: int, task: bool) -> str:
    flag = args[index]
    messages = {
        "--from": "--from needs a value",
        "--ticket-token": "--ticket-token needs a non-empty opaque value",
        "--at": "--at needs a non-empty path" if task else "--at needs a value",
    }
    require(index + 1 < len(args), messages[flag], 2)
    value = args[index + 1]
    if flag == "--ticket-token" or (flag == "--at" and task):
        require(value, messages[flag], 2)
    return value


def parse(args: list[str], *, task: bool) -> BranchOptions:
    options = BranchOptions()
    index = 0
    while index < len(args):
        index += consume(options, args, index, task)
    require(options.name, "no branch name given", 2)
    if task:
        require(
            options.token,
            "prepare requires the active provider's opaque ticket token",
            2,
        )
    require(options.at is None or options.worktree, "--at requires --worktree", 2)
    require(options.at != "", "--at needs a non-empty path", 2)
    return options


def consume(options: BranchOptions, args: list[str], index: int, task: bool) -> int:
    flag = args[index]
    fields = {"--from": "base", "--ticket-token": "token", "--at": "at"}
    if flag in fields:
        setattr(options, fields[flag], option_value(args, index, task))
        return 2
    if flag == "--worktree":
        options.worktree = True
        return 1
    if flag.startswith("-"):
        raise RefusalError(f"error: unknown flag: {flag}", 2)
    require(not options.name, "exactly one branch name allowed", 2)
    options.name = flag
    return 1
