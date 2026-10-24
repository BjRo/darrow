"""Conventional names and opaque ticket-id contracts."""

import re

from .process import RefusalError, git, require, succeeds

TYPES = "feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert"
KEBAB = r"[a-z0-9]+(-[a-z0-9]+)*"


def validate_ticket_id(ticket_id: str, *, task: bool = False) -> None:
    require(
        re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]*", ticket_id),
        f"ticket ID contains unsupported branch characters: {ticket_id}",
        5,
    )
    if task:
        require(
            len(ticket_id) <= 55
            and succeeds("check-ref-format", "--branch", f"ci/{ticket_id}-a"),
            f"ticket ID cannot form a valid task branch: {ticket_id}",
            5,
        )


def validate_suffix(name: str, ticket_id: str) -> None:
    slug = name.split("/", 1)[1]
    require(
        slug.startswith(ticket_id + "-"),
        f"branch must lead with the supplied ticket ID exactly: {name}",
        5,
    )
    require(
        slug.count(ticket_id) == 1,
        f"supplied ticket ID must occur exactly once: {name}",
        5,
    )
    require(
        re.fullmatch(KEBAB, slug[len(ticket_id) + 1 :]),
        f"branch suffix must be lowercase kebab-case: {name}",
        5,
    )


def validate_unbound_slug(name: str) -> None:
    parts = name.split("/", 1)[1].split("-")
    for index, part in enumerate(parts):
        ordinary = re.fullmatch(r"[a-z0-9]+", part)
        ticket = (
            re.fullmatch(r"[A-Z]+", part)
            and index + 1 < len(parts)
            and parts[index + 1].isdigit()
        )
        require(
            ordinary or ticket,
            f"slug segments must be lowercase (ticket ids like DAR-123 may be caps): {name}",
            5,
        )


def validate_name(name: str, ticket_id: str = "", *, task: bool = False) -> None:
    if ticket_id:
        validate_ticket_id(ticket_id, task=task)
    shape = "<ticket-id>-<kebab-suffix>" if task else "<kebab-slug>"
    require(
        re.fullmatch(f"({TYPES})/.+", name)
        and succeeds("check-ref-format", "--branch", name),
        f"branch name must be <type>/{shape}: {name}",
        5,
    )
    if ticket_id:
        validate_suffix(name, ticket_id)
    else:
        validate_unbound_slug(name)
    require(len(name) <= 60, f"branch name exceeds 60 chars ({len(name)})", 5)


def correlated(name: str, ticket_id: str) -> bool:
    try:
        validate_name(name, ticket_id, task=True)
    except RefusalError:
        return False
    return True


def discover(ticket_id: str) -> list[str]:
    validate_ticket_id(ticket_id, task=True)
    try:
        rows = git(
            "for-each-ref",
            "--sort=refname",
            "--format=%(refname:lstrip=2)%09%(objectname)",
            "refs/heads",
        )
    except RefusalError as error:
        raise RefusalError("error: cannot enumerate local task branches", 3) from error
    matches = []
    for row in rows.splitlines():
        name, tip = row.split("\t")
        if correlated(name, ticket_id):
            matches.append(f"{name} (at {tip})")
    return matches
