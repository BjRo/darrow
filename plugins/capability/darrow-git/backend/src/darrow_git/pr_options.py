"""Public PR arguments shared by inspection and creation."""

from collections import deque
from dataclasses import dataclass, field

from .arguments import take_value
from .process import RefusalError, require
from .templates import validate_choice


@dataclass
class PrOptions:
    title: str = ""
    bodies: list[str] = field(default_factory=list)
    base: str = ""
    template: str = ""
    draft: bool = False


def parse(args: list[str], *, creating: bool) -> PrOptions:
    options = PrOptions()
    remaining = deque(args)
    while remaining:
        consume(options, remaining.popleft(), remaining, creating)
    if creating:
        require(options.title, "--title required", 2)
        require(options.bodies, "at least one -b body section required", 2)
    validate_choice(options.template)
    return options


def consume(options: PrOptions, flag: str, args: deque[str], creating: bool) -> None:
    if creating and flag == "--draft":
        options.draft = True
        return
    flags = {"--base": "base", "--template": "template"}
    if creating:
        flags.update({"--title": "title", "-b": "bodies"})
    if flag not in flags:
        raise RefusalError(f"error: unknown argument: {flag}", 2)
    value = read_value(args, flag)
    if flag == "-b":
        options.bodies.append(value)
    else:
        setattr(options, flags[flag], value)


def read_value(args: deque[str], flag: str) -> str:
    description = {"--base": "a non-empty value", "--template": "a filename"}.get(
        flag, "a value"
    )
    value = take_value(args, f"{flag} needs {description}")
    if flag == "--base":
        require(value, "--base needs a non-empty value", 2)
    if flag == "-b":
        require(value.strip(), "-b section is empty", 2)
    return value
