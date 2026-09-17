"""Public PR arguments shared by inspection and creation."""

from dataclasses import dataclass, field

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
    index = 0
    while index < len(args):
        index += consume(options, args, index, creating)
    if creating:
        require(options.title, "--title required", 2)
        require(options.bodies, "at least one -b body section required", 2)
    validate_choice(options.template)
    return options


def consume(options: PrOptions, args: list[str], index: int, creating: bool) -> int:
    flag = args[index]
    if creating and flag == "--draft":
        options.draft = True
        return 1
    flags = {"--base": "base", "--template": "template"}
    if creating:
        flags.update({"--title": "title", "-b": "bodies"})
    if flag not in flags:
        raise RefusalError(f"error: unknown argument: {flag}", 2)
    value = read_value(args, index)
    if flag == "-b":
        options.bodies.append(value)
    else:
        setattr(options, flags[flag], value)
    return 2


def read_value(args: list[str], index: int) -> str:
    flag = args[index]
    description = {"--base": "a non-empty value", "--template": "a filename"}.get(
        flag, "a value"
    )
    require(index + 1 < len(args), f"{flag} needs {description}", 2)
    value = args[index + 1]
    if flag == "--base":
        require(value, "--base needs a non-empty value", 2)
    if flag == "-b":
        require(value.strip(), "-b section is empty", 2)
    return value
