"""Prepare immutable repository evidence and resolve one selected route."""

from __future__ import annotations

import re
from pathlib import Path

from .arguments import options, require
from .common import PLUGIN, RefusalError, git_text, read_text, record, repository
from .routes import catalog, validate_owner, validate_tuple

USAGE = """usage:
  adaptive-delivery-preflight prepare --repo <path> --host <codex|claude>
  adaptive-delivery-preflight route --repo <path> --host <codex|claude> --profile <profile> [--route <harness|provider|model|effort>]
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
    workflows = plugin / "skills/adaptive-delivery/references/workflows"
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
        validate_owner(host, route.model)
        result += record("route", route.profile, *route.tuple)
        result += record("route_policy_source", route.profile, route.source)
    if not routes:
        raise RefusalError(f"no routes for host={host}")
    return result + workflow_records(workflows)


def explicit_tuple(value: str, host: str) -> tuple[str, str, str, str]:
    fields = value.split("|")
    if len(fields) != 4 or not all(fields):
        raise RefusalError("--route must be harness|provider|model|effort")
    route = (fields[0], fields[1], fields[2], fields[3])
    validate_tuple("explicit route", host, route)
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
    validate_owner(host, route[2])
    return (
        record("format", "darrow-native-goal-route-v2")
        + record("profile", profile)
        + record("selected_route", *route)
        + record("route_source", source)
        + provenance
    )


def parse(args: list[str]) -> tuple[str, dict[str, str]]:
    command, *rest = args
    if command not in {"prepare", "route"}:
        raise RefusalError(f"unknown command: {command}")
    names = {"--repo", "--host"}
    required = {"repo", "host"}
    message = "prepare requires --repo and --host"
    if command == "route":
        names |= {"--profile", "--route"}
        required.add("profile")
        message = "route requires --repo, --host, and --profile"
    values = options(rest, names, command + " ")
    require(values, required, message)
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
    return selected(repo, host, profile, values.get("route", ""), plugin)
