"""Small literal option parser preserving flag-looking argument values."""

from collections import defaultdict
from collections.abc import Iterator, Sequence
from dataclasses import dataclass

from .errors import TicketError

OPTIONS = {
    "inspect": (),
    "get": (),
    "list": ("state", "type", "label", "search", "milestone", "limit"),
    "create": (
        "title",
        "type",
        "body-file",
        "label",
        "milestone",
        "assignee",
        "depends-on",
        "parent",
    ),
    "comment": ("body-file",),
    "describe": ("body-file",),
    "close": (),
    "reopen": (),
    "label": ("add", "remove"),
    "relate": ("depends-on", "remove-depends-on", "parent", "remove-parent"),
}
POSITIONAL = {"get", "comment", "describe", "close", "reopen", "label", "relate"}


@dataclass
class Arguments:
    command: str
    reference: str
    options: dict[str, list[str]]

    def value(self, name: str, default: str = "") -> str:
        return self.options.get(name, [default])[-1]

    def values(self, name: str) -> list[str]:
        return self.options.get(name, [])


def reference(command: str, args: list[str]) -> str:
    if command not in POSITIONAL:
        return ""
    if not args:
        suffix = " or canonical URL" if command == "get" else ""
        raise TicketError(f"error: {command} needs a ticket id{suffix}")
    if command == "get" and len(args) != 1 and args[1] != "--provider":
        raise TicketError("error: get accepts exactly one ticket reference")
    if command in {"close", "reopen"} and len(args) != 1 and args[1] != "--provider":
        raise TicketError(f"error: unknown {command} argument: {args[1]}")
    value = args.pop(0)
    return value


def option_value(command: str, flag: str, tokens: Iterator[str]) -> str:
    # Implemented with an iterator so empty and flag-looking values stay literal.
    if flag == "remove-parent":
        return ""
    try:
        value = next(tokens)
    except StopIteration as exc:
        if command == "create" and flag == "depends-on":
            raise TicketError("error: invalid ticket id: ") from exc
        raise TicketError(f"error: --{flag} needs a value") from exc
    return value


def parse(command: str, argv: Sequence[str]) -> Arguments:
    args = list(argv)
    target = reference(command, args)
    options: dict[str, list[str]] = defaultdict(list)
    tokens = iter(args)
    for token in tokens:
        flag = token.removeprefix("--")
        if token != f"--{flag}" or flag not in (*OPTIONS[command], "provider"):
            raise TicketError(f"error: unknown {command} argument: {token}")
        value = option_value(command, flag, tokens)
        options[flag].append(value)
    return Arguments(command, target, dict(options))
