"""Single mutations with state reads and explicit no-op refusals."""

from ...arguments import Arguments
from ...errors import TicketError
from ...validation import check_attribution, read_body
from . import relations
from .provider import Provider, labels_from
from .validation import (
    check_label,
    check_markers,
    existing_label,
)


def write_body(args: Arguments) -> None:
    path = args.value("body-file")
    if not path:
        raise TicketError("error: --body-file required")
    body = read_body(path)
    if args.command == "describe":
        check_markers(body, "use relate to change relations")
    check_attribution(body)
    provider = Provider.resolve()
    provider.verify(args.reference)
    operation = "comment" if args.command == "comment" else "edit"
    output = provider.run("issue", operation, args.reference, "--body-file", path)
    if args.command == "comment":
        url = next((line for line in reversed(output.splitlines()) if line.strip()), "")
        print(f"commented on #{args.reference}: {url}")
    else:
        print(f"#{args.reference} description replaced")


def transition(args: Arguments) -> None:
    provider = Provider.resolve()
    state, title = provider.verify(args.reference)
    target = "closed" if args.command == "close" else "open"
    if state == target:
        raise TicketError(f"error: #{args.reference} is already {target} — {title}", 9)
    provider.run("issue", args.command, args.reference)
    print(f"#{args.reference}: {state} -> {target} — {title}")


def label_ticket(args: Arguments) -> None:
    add, remove = args.value("add"), args.value("remove")
    if bool(add) == bool(remove):
        raise TicketError("error: exactly one of --add or --remove")
    provider = Provider.resolve()
    provider.verify(args.reference)
    current = labels_from(provider.issue(args.reference, "labels").get("labels"))
    value = add or remove
    check_label(value)
    if add:
        existing_label(add, provider.labels())
    if (value in current) == bool(add):
        condition = "already has" if add else "does not have"
        raise TicketError(f"error: #{args.reference} {condition} label: {value}", 9)
    flag, sign = ("--add-label", "+") if add else ("--remove-label", "-")
    provider.run("issue", "edit", args.reference, flag, value)
    print(f"#{args.reference} labels: {sign}{value}")


def relate_ticket(args: Arguments) -> None:
    operations = [
        (name, value) for name, values in args.options.items() for value in values
    ]
    if len(operations) != 1:
        raise TicketError("error: exactly one relation change per invocation")
    operation, target = operations[0]
    if target == args.reference:
        raise TicketError(f"error: #{args.reference} cannot relate to itself")
    provider = Provider.resolve()
    provider.verify(args.reference)
    remove = operation.startswith("remove-")
    if operation.endswith("parent"):
        relations.update_parent(provider, args.reference, target, remove=remove)
    else:
        relations.update_dependency(provider, args.reference, target, remove=remove)
    print(f"#{args.reference} relations:")
    print(relations.report(provider, args.reference))
