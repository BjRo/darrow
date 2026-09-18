"""Strict command options with the existing usage and diagnostic interface."""

from dataclasses import dataclass, field

from .errors import DecisionError
from .model import CONTROL, STATUSES, byte_length

USAGE = """usage: decision inspect [--dir <path>] [--repo <path>]
       decision list [--dir <path>] [--repo <path>]
                     [--status Proposed|Accepted|Rejected|Deprecated|Superseded]
                     [--search <text>] [--related-to <ADR-NNNN>] [--limit <n>]
       decision next-id [--dir <path>] [--repo <path>] [--title <title>]
       decision validate [--dir <path>] [--repo <path>]
       decision catalog rebuild|check [--dir <path>] [--repo <path>]
       decision canonical-path --path <path> [--repo <path>]
       decision check-transition --from <status> --to <status>"""

OPTIONS = {
    "inspect": ("repo", "dir"),
    "validate": ("repo", "dir"),
    "catalog": ("repo", "dir"),
    "list": ("repo", "dir", "status", "search", "related-to", "limit"),
    "next-id": ("repo", "dir", "title"),
    "canonical-path": ("repo", "path"),
    "check-transition": ("from", "to"),
}


@dataclass(frozen=True)
class Arguments:
    command: str
    action: str = ""
    values: dict[str, str] = field(default_factory=dict)

    def get(self, name: str, default: str = "") -> str:
        return self.values.get(name, default)


def parse_arguments(argv: list[str]) -> Arguments:
    if not argv or argv[0] not in OPTIONS:
        raise DecisionError(USAGE)
    command, *rest = argv
    action = ""
    if command == "catalog":
        if not rest or rest[0] not in ("rebuild", "check"):
            raise DecisionError(USAGE)
        action, *rest = rest
    values = parse_options(command, rest)
    required = {"canonical-path": ("path",), "check-transition": ("from", "to")}.get(
        command, ()
    )
    if any(key not in values for key in required):
        raise DecisionError(USAGE)
    validate_values(values)
    return Arguments(command, action, values)


def parse_options(command: str, rest: list[str]) -> dict[str, str]:
    if len(rest) % 2:
        raise DecisionError(USAGE)
    values = {}
    allowed = {"--" + name for name in OPTIONS[command]}
    for flag, value in zip(rest[::2], rest[1::2], strict=True):
        if flag not in allowed:
            raise DecisionError(USAGE)
        values[flag[2:]] = value
    return values


def validate_values(values: dict[str, str]) -> None:
    for name in (
        "repo",
        "dir",
        "status",
        "search",
        "related-to",
        "title",
        "path",
        "from",
        "to",
    ):
        if CONTROL.search(values.get(name, "")):
            raise DecisionError(f"--{name} contains unsupported control bytes")
    if byte_length(values.get("path", "")) > 1000:
        raise DecisionError("--path must be at most 1000 bytes")


def check_transition(arguments: Arguments) -> None:
    old, new = arguments.get("from"), arguments.get("to")
    if not old or not new:
        raise DecisionError(USAGE)
    for value in (old, new):
        if value not in STATUSES:
            raise DecisionError(f"unsupported decision status: {value}")
    allowed = {
        ("Proposed", "Accepted"),
        ("Proposed", "Rejected"),
        ("Accepted", "Deprecated"),
        ("Accepted", "Superseded"),
    }
    if (old, new) not in allowed:
        raise DecisionError(f"unsupported decision transition: {old} -> {new}", 3)
    print(f"{old} -> {new}: allowed")
