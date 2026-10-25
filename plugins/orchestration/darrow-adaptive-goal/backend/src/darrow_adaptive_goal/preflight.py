"""Prepare immutable repository evidence and resolve one selected route."""

from __future__ import annotations

import os
import re
from pathlib import Path

from . import placement, verification_input
from .arguments import options, require
from .common import PLUGIN, RefusalError, git_text, read_text, record, repository
from .routes import catalog, validate_tuple

USAGE = """usage:
  adaptive-goal-preflight prepare --repo <path> --host <codex|claude>
  adaptive-goal-preflight route --repo <path> --host <codex|claude> --profile <profile> [--route <harness|provider|model|effort>] [--main-route <harness|provider|model|effort>]
  adaptive-goal-preflight codex-verification-input --task-name <name> --assignment-file <absolute-utf8-file>
"""


def observation(repo: Path, label: str, *args: str) -> str:
    try:
        return git_text(repo, *args)
    except (RefusalError, OSError) as error:
        raise RefusalError(f"cannot read {label}: {repo}") from error


def instruction_records(repo: Path) -> str:
    result = ""
    for name in ("AGENTS.md", "CLAUDE.md"):
        path = repo / name
        if path.exists() or path.is_symlink():
            read_text(path, "repository instruction is unreadable")
            result += record("instruction", str(path))
    return result


def prepare(repo: Path, host: str, plugin: Path) -> str:
    revision = observation(repo, "repository revision", "rev-parse", "HEAD")
    status = observation(
        repo, "working tree state", "status", "--porcelain=v1", "--untracked-files=all"
    )
    routes = [route for route in catalog(repo, plugin) if route.host == host]
    result = record("format", "darrow-native-goal-prepared-v2")
    result += record("repo", str(repo)) + record("base_revision", revision)
    result += record("working_tree", "dirty" if status else "clean")
    result += instruction_records(repo)
    for route in routes:
        result += record("route", route.profile, *route.tuple)
        result += record("route_policy_source", route.profile, route.source)
    if not routes:
        raise RefusalError(f"no routes for host={host}")
    return result


def explicit_tuple(
    value: str, host: str, label: str = "explicit route", option: str = "--route"
) -> tuple[str, str, str, str]:
    fields = value.split("|")
    if len(fields) != 4 or not all(fields):
        raise RefusalError(f"{option} must be harness|provider|model|effort")
    route = (fields[0], fields[1], fields[2], fields[3])
    validate_tuple(label, host, route)
    return route


def selected(
    repo: Path, host: str, profile: str, values: dict[str, str], plugin: Path
) -> str:
    explicit = values.get("route", "")
    routes = catalog(repo, plugin)
    source = "user" if explicit else "policy"
    provenance = ""
    if explicit:
        route = explicit_tuple(explicit, host)
    else:
        match = next((item for item in routes if item.key == (host, profile)), None)
        if match is None:
            raise RefusalError(f"no route for host={host} profile={profile}")
        route = match.tuple
        provenance = record("policy_route_source", match.source)
    main: placement.RouteTuple | None
    if "main-route" in values:
        main = explicit_tuple(values["main-route"], host, "main route", "--main-route")
        main_source = "user"
    else:
        main, main_source = placement.observed(host, os.environ), "session"
    return (
        record("format", "darrow-native-goal-route-v3")
        + record("profile", profile)
        + record("selected_route", *route)
        + record("route_source", source)
        + provenance
        + placement.records(route, main, main_source, routes)
    )


COMMANDS = {
    "prepare": (set(), set(), "prepare requires --repo and --host"),
    "route": (
        {"--profile", "--route", "--main-route"},
        {"profile"},
        "route requires --repo, --host, and --profile",
    ),
}


def parse(args: list[str]) -> tuple[str, dict[str, str]]:
    command, *rest = args
    if command not in COMMANDS:
        raise RefusalError(f"unknown command: {command}")
    names, required, message = COMMANDS[command]
    values = options(rest, names | {"--repo", "--host"}, command + " ")
    require(values, required | {"repo", "host"}, message)
    return command, values


def run(args: list[str], plugin: Path = PLUGIN) -> str:
    if not args:
        raise RefusalError(USAGE.rstrip())
    if args[0] in {"-h", "--help", "help"}:
        return USAGE
    if args[0] == "codex-verification-input":
        return verification_input.run(args[1:])
    command, values = parse(args)
    return dispatch(command, values, plugin)


def dispatch(command: str, values: dict[str, str], plugin: Path) -> str:
    host = values["host"]
    if host not in {"codex", "claude"}:
        raise RefusalError(f"unsupported host: {host}")
    profile = values.get("profile", "routine")
    if not re.fullmatch(r"[a-z0-9-]+", profile):
        raise RefusalError(f"unsupported profile: {profile}")
    repo = repository(values["repo"])
    if command == "prepare":
        return prepare(repo, host, plugin)
    return selected(repo, host, profile, values, plugin)
