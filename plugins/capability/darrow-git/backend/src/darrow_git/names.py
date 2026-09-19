"""Conventional names and opaque ticket-token contracts."""

import re

from .process import RefusalError, git, require, succeeds

TYPES = "feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert"
KEBAB = r"[a-z0-9]+(-[a-z0-9]+)*"


def validate_token(token: str, *, task: bool = False) -> None:
    require(
        re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]*", token),
        f"ticket token contains unsupported branch characters: {token}",
        5,
    )
    if task:
        require(
            len(token) <= 55
            and succeeds("check-ref-format", "--branch", f"ci/{token}-a"),
            f"ticket token cannot form a valid task branch: {token}",
            5,
        )


def validate_suffix(name: str, token: str) -> None:
    slug = name.split("/", 1)[1]
    require(
        slug.startswith(token + "-"),
        f"branch must lead with the supplied ticket token exactly: {name}",
        5,
    )
    require(
        slug.count(token) == 1,
        f"supplied ticket token must occur exactly once: {name}",
        5,
    )
    require(
        re.fullmatch(KEBAB, slug[len(token) + 1 :]),
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


def validate_name(name: str, token: str = "", *, task: bool = False) -> None:
    if token:
        validate_token(token, task=task)
    shape = "<opaque-token>-<kebab-suffix>" if task else "<kebab-slug>"
    require(
        re.fullmatch(f"({TYPES})/.+", name)
        and succeeds("check-ref-format", "--branch", name),
        f"branch name must be <type>/{shape}: {name}",
        5,
    )
    if token:
        validate_suffix(name, token)
    else:
        validate_unbound_slug(name)
    require(len(name) <= 60, f"branch name exceeds 60 chars ({len(name)})", 5)


def correlated(name: str, token: str) -> bool:
    try:
        validate_name(name, token, task=True)
    except RefusalError:
        return False
    return True


def discover(token: str) -> list[str]:
    validate_token(token, task=True)
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
        if correlated(name, token):
            matches.append(f"{name} (at {tip})")
    return matches
