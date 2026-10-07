"""Prepare immutable repository evidence and resolve one selected route."""

from __future__ import annotations

import os
import re
from pathlib import Path

from . import placement
from .arguments import options, require
from .common import PLUGIN, RefusalError, git_text, read_text, record, repository
from .routes import catalog, validate_tuple

USAGE = """usage:
  adaptive-goal-preflight prepare --repo <path> --host <codex|claude>
  adaptive-goal-preflight route --repo <path> --host <codex|claude> --profile <profile> [--route <harness|provider|model|effort>]
  adaptive-goal-preflight placement --repo <path> --host <codex|claude> --selected-route <harness|provider|model|effort> [--main-route <harness|provider|model|effort>]
"""
WORKFLOWS = (
    "fix-bug",
    "implement-feature",
    "change-feature",
    "refactor",
    "migration",
    "mechanical",
)


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


def workflow_records(directory: Path) -> str:
    result = ""
    for name in WORKFLOWS:
        path = directory / f"{name}.md"
        read_text(path, "workflow document is unreadable")
        result += record("workflow", name, str(path))
    return result


def prepare(repo: Path, host: str, plugin: Path) -> str:
    workflows = plugin / "skills/adaptive-goal/references/workflows"
    if not workflows.is_dir():
        raise RefusalError(f"workflow directory is missing: {workflows}")
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
    return result + workflow_records(workflows)


def explicit_tuple(
    value: str, host: str, label: str = "explicit route", option: str = "--route"
) -> tuple[str, str, str, str]:
    fields = value.split("|")
    if len(fields) != 4 or not all(fields):
        raise RefusalError(f"{option} must be harness|provider|model|effort")
    route = (fields[0], fields[1], fields[2], fields[3])
    validate_tuple(label, host, route)
    return route


def selected(repo: Path, host: str, profile: str, explicit: str, plugin: Path) -> str:
    source = "user" if explicit else "policy"
    provenance = ""
    if explicit:
        route = explicit_tuple(explicit, host)
    else:
        match = next(
            (item for item in catalog(repo, plugin) if item.key == (host, profile)),
            None,
        )
        if match is None:
            raise RefusalError(f"no route for host={host} profile={profile}")
        route = match.tuple
        provenance = record("policy_route_source", match.source)
    return (
        record("format", "darrow-native-goal-route-v2")
        + record("profile", profile)
        + record("selected_route", *route)
        + record("route_source", source)
        + provenance
    )


def placed(repo: Path, host: str, values: dict[str, str], plugin: Path) -> str:
    selected_route = explicit_tuple(
        values["selected-route"], host, "selected route", "--selected-route"
    )
    routes = catalog(repo, plugin)
    if "main-route" in values:
        main = explicit_tuple(values["main-route"], host, "main route", "--main-route")
        return placement.report(selected_route, main, "user", routes)
    main_route = placement.observed(host, os.environ)
    return placement.report(selected_route, main_route, "session", routes)


COMMANDS = {
    "prepare": (set(), set(), "prepare requires --repo and --host"),
    "route": (
        {"--profile", "--route"},
        {"profile"},
        "route requires --repo, --host, and --profile",
    ),
    "placement": (
        {"--selected-route", "--main-route"},
        {"selected-route"},
        "placement requires --repo, --host, and --selected-route",
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
    if command == "placement":
        return placed(repo, host, values, plugin)
    return selected(repo, host, profile, values.get("route", ""), plugin)
