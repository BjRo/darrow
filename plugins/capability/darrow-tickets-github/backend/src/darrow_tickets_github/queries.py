"""Read-only commands and compact authoritative output."""

import re

from . import relations
from .arguments import Arguments
from .errors import TicketError
from .provider import (
    Provider,
    array_value,
    labels_from,
    number_field,
    object_value,
    string_field,
)
from .validation import check_label, check_type, type_label


def inspect_backend(args: Arguments) -> None:
    provider = Provider.resolve()
    provider.inspect()
    labels = provider.labels()
    print("## backend: github")
    print(
        "## types: bug, feature, task, chore (create maps the type to an existing label; none -> created unlabeled)"
    )
    print("## labels")
    print("\n".join(labels[:50]) or "(none defined)")
    if len(labels) > 50:
        print(f"## note: label list truncated at 50 ({len(labels)} fetched)")


def get_ticket(args: Arguments) -> None:
    provider = Provider.resolve()
    number = provider.read_id(args.reference)
    meta = provider.issue(number, "number,state,title,url,labels")
    authoritative = number_field(meta, "number")
    state = string_field(meta, "state").lower()
    title = string_field(meta, "title")
    url = string_field(meta, "url")
    labels = ", ".join(labels_from(meta.get("labels"))) or "(none)"
    body_value = provider.issue(number, "body").get("body")
    body = normalize_body(body_value)
    relation_report = relations.report(provider, number)
    print(
        f"backend: github\nticket-token: {authoritative}\n#{authoritative} {state} — {title}\n{url}\nlabels: {labels}"
    )
    print(relation_report)
    print(f"## body\n{body}")


def normalize_body(value: object) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise TicketError("error: malformed GitHub backend field: body", 4)
    return value.replace("\r\n", "\n").removesuffix("\r").rstrip("\n")


def list_labels(args: Arguments, provider: Provider) -> tuple[list[str], list[str]]:
    labels = list(args.values("label"))
    filters = []
    kind = args.value("type")
    if kind:
        check_type(kind)
        mapped = type_label(kind, provider.labels())
        if not mapped:
            raise TicketError(
                f"error: no existing label maps to type {kind} — cannot filter by it", 8
            )
        labels.append(mapped)
        filters.append(f"type={kind}")
    return labels, filters


def list_options(args: Arguments, provider: Provider) -> tuple[list[str], str]:
    labels, filters = list_labels(args, provider)
    filters.insert(0, f"state={args.value('state', 'open')}")
    options: list[str] = []
    for label in labels:
        check_label(label)
        options.extend(("--label", label))
        filters.append(f"label={label}")
    for name in ("search", "milestone"):
        value = args.value(name)
        if value:
            options.extend((f"--{name}", value))
            filters.append(
                f'{name}="{value}"' if name == "search" else f"{name}={value}"
            )
    return options, ", ".join(filters)


def list_row(value: object) -> str:
    item = object_value(value)
    number = number_field(item, "number")
    state = string_field(item, "state").lower()
    title = string_field(item, "title")
    labels = labels_from(item.get("labels"))
    suffix = f" ({', '.join(labels)})" if labels else ""
    return f"#{number} {state}  {title}{suffix}"


def list_tickets(args: Arguments) -> None:
    state = args.value("state", "open")
    if state not in {"open", "closed", "all"}:
        raise TicketError(f"error: --state must be open, closed or all: {state}")
    limit_text = args.value("limit", "20")
    if not re.fullmatch(r"[1-9][0-9]*", limit_text):
        raise TicketError(f"error: --limit must be a positive number: {limit_text}")
    limit = int(limit_text)
    provider = Provider.resolve()
    options, filters = list_options(args, provider)
    data = provider.json(
        "issue",
        "list",
        "--state",
        state,
        "--limit",
        str(limit + 1),
        *options,
        "--json",
        "number,state,title,labels",
    )
    rows = [list_row(item) for item in array_value(data)]
    print("backend: github")
    print_list(rows, limit, filters)


def print_list(rows: list[str], limit: int, filters: str) -> None:
    if not rows:
        print(f"no matches ({filters})")
        return
    print("\n".join(rows[:limit]))
    if len(rows) > limit:
        print(f"total: more than {limit} ({filters})")
        print(f"note: list truncated at {limit} — narrow the filters or raise --limit")
    else:
        print(f"total: {len(rows)} ({filters})")
