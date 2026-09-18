"""Validate a proposed ticket before creation and report partial relation writes."""

import re
import tempfile
from pathlib import Path

from . import relations
from .arguments import Arguments
from .errors import TicketError
from .provider import Provider
from .validation import (
    check_attribution,
    check_markers,
    check_structure,
    check_title,
    check_type,
    existing_label,
    read_body,
    type_label,
)


def creation_body(args: Arguments) -> str:
    title, kind, path = (args.value(name) for name in ("title", "type", "body-file"))
    if not all((title, kind, path)):
        raise TicketError("error: --title, --type and --body-file are required")
    check_type(kind)
    check_title(title)
    body = read_body(path)
    check_markers(body, "pass --depends-on/--parent instead")
    check_attribution(f"{title}\n{body}")
    check_structure(kind, body)
    return body


def creation_labels(args: Arguments, provider: Provider) -> tuple[list[str], str]:
    available = provider.labels()
    labels = list(args.values("label"))
    for label in labels:
        existing_label(label, available)
    mapped = type_label(args.value("type"), available)
    if mapped and mapped not in labels:
        labels.append(mapped)
    return labels, mapped


def create_issue(
    args: Arguments, provider: Provider, body: str, labels: list[str]
) -> str:
    # Close before gh opens the file (required on native Windows); always clean up.
    with tempfile.TemporaryDirectory(prefix="darrow-ticket-") as directory:
        path = Path(directory) / "body.md"
        path.write_bytes((body + "\n").encode("utf-8"))
        command = [
            "issue",
            "create",
            "--title",
            args.value("title"),
            "--body-file",
            str(path),
        ]
        for label in labels:
            command.extend(("--label", label))
        for name in ("milestone", "assignee"):
            if args.value(name):
                command.extend((f"--{name}", args.value(name)))
        lines = provider.run(*command).splitlines()
        return next((line for line in reversed(lines) if line.strip()), "")


def report_creation(args: Arguments, url: str, labels: list[str], mapped: str) -> str:
    number = url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"[0-9]+", number):
        raise TicketError(
            f"error: could not parse the created issue number from: {url}", 4
        )
    print(f"backend: github\ncreated: #{number} {url}")
    kind = args.value("type")
    print(f"type: {kind} (label: {mapped})" if mapped else f"type: {kind}")
    if labels:
        print(f"labels: {', '.join(labels)}")
    for name in ("milestone", "assignee"):
        if args.value(name):
            print(f"{name}: {args.value(name)}")
    return number


def create_ticket(args: Arguments) -> None:
    body = creation_body(args)
    provider = Provider.resolve()
    labels, mapped = creation_labels(args, provider)
    parent = args.value("parent")
    targets = args.values("depends-on") + ([parent] if parent else [])
    for target in targets:
        provider.verify(target)
    url = create_issue(args, provider, body, labels)
    number = report_creation(args, url, labels, mapped)
    for target in args.values("depends-on"):
        relations.change_dependency(provider, number, target)
        print(f"depends-on: #{target} recorded")
    if parent:
        relations.change_parent(provider, number, parent)
        print(f"parent: #{parent} recorded")
    if not mapped:
        print(
            f"note: no existing label matches type {args.value('type')} — created without a type label"
        )
