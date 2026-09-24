"""GitHub Issues adapter for the public ticket commands."""

from ...arguments import Arguments
from ...errors import TicketError
from .create import create_ticket
from .queries import get_ticket, inspect_backend, list_tickets
from .update import label_ticket, relate_ticket, transition, write_body
from .validation import norm_id


def normalize_references(args: Arguments) -> None:
    if args.command not in {"inspect", "list", "create", "get"}:
        args.reference = norm_id(args.reference)
    for flag in ("parent", "depends-on", "remove-depends-on"):
        if flag in args.options:
            args.options[flag] = [norm_id(value) for value in args.values(flag)]
    if args.command == "create":
        check_duplicate_dependencies(args.values("depends-on"))


def check_duplicate_dependencies(targets: list[str]) -> None:
    if len(targets) != len(set(targets)):
        repeated = next(value for value in targets if targets.count(value) > 1)
        raise TicketError(f"error: duplicate --depends-on: #{repeated}")


class GitHubAdapter:
    """Keep GitHub-specific validation and operations inside one adapter."""

    def execute(self, args: Arguments) -> None:
        normalize_references(args)
        commands = {
            "inspect": inspect_backend,
            "list": list_tickets,
            "get": get_ticket,
            "create": create_ticket,
            "comment": write_body,
            "describe": write_body,
            "close": transition,
            "reopen": transition,
            "label": label_ticket,
            "relate": relate_ticket,
        }
        commands[args.command](args)
