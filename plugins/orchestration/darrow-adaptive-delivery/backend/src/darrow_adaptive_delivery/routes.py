"""Parse the route catalog and apply repository policy without choosing intent."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from pathlib import Path

from .common import RefusalError, read_text

FIELDS = (
    "host",
    "profile",
    "harness",
    "provider",
    "model",
    "effort",
    "fallbackModel",
    "fallbackEffort",
)
SAFE_VALUE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")
EFFORTS = {"low", "medium", "high", "xhigh", "max", "ultra"}


class Pairs(list[tuple[str, object]]):
    """Retain duplicate object keys; reviewers remain opaque to this helper."""


def invalid(reason: str) -> RefusalError:
    return RefusalError(f"invalid route configuration: {reason}")


def object_fields(
    value: object, allowed: tuple[str, ...], label: str
) -> dict[str, object]:
    if not isinstance(value, Pairs):
        raise invalid(f"{label} must be an object")
    fields: dict[str, object] = {}
    for key, item in value:
        if key not in allowed:
            raise invalid(f"unknown {label} field: {key}")
        if key in fields:
            raise invalid(f"duplicate {label} field: {key}")
        fields[key] = item
    return fields


def safe_field(name: str, value: object) -> str:
    if not isinstance(value, str) or not SAFE_VALUE.fullmatch(value):
        raise invalid(f"unsafe or empty {name} value")
    return value


@dataclass(frozen=True)
class Route:
    host: str
    profile: str
    harness: str
    provider: str
    model: str
    effort: str
    fallback_model: str
    fallback_effort: str
    source: str = "bundled"

    @property
    def key(self) -> tuple[str, str]:
        return self.host, self.profile

    @property
    def tuple(self) -> tuple[str, str, str, str]:
        return self.harness, self.provider, self.model, self.effort


def parse_route(value: object) -> Route:
    fields = object_fields(value, FIELDS, "route")
    if len(fields) != 8:
        raise invalid("each route must contain exactly eight fields")
    return Route(*(safe_field(name, fields[name]) for name in FIELDS))


def reject_constant(value: str) -> object:
    raise invalid(f"invalid JSON value: {value}")


def parse_document(text: str, allow_missing: bool = False) -> list[Route]:
    try:
        value: object = json.loads(
            text, object_pairs_hook=Pairs, parse_constant=reject_constant
        )
    except (ValueError, RecursionError) as error:
        raise invalid(str(error)) from error
    root = object_fields(value, ("routes", "reviewers"), "root")
    if "routes" not in root and not allow_missing:
        raise invalid("root object must contain routes")
    return parse_routes(root.get("routes", []), allow_missing)


def parse_routes(value: object, allow_empty: bool) -> list[Route]:
    if not isinstance(value, list) or isinstance(value, Pairs):
        raise invalid("routes must be an array")
    if not value and not allow_empty:
        raise invalid("bundled routes array must not be empty")
    routes = [parse_route(item) for item in value]
    seen: set[tuple[str, str]] = set()
    for route in routes:
        if route.key in seen:
            raise invalid(
                f"duplicate route for host={route.host} profile={route.profile}"
            )
        seen.add(route.key)
    return routes


def validate_tuple(label: str, host: str, route: tuple[str, str, str, str]) -> None:
    harness, provider, model, effort = route
    if harness != host:
        raise RefusalError(f"{label} must use current host: {host}")
    if (host, provider) not in {("codex", "openai"), ("claude", "anthropic")}:
        raise RefusalError(f"{label} provider does not match host: {host}")
    if model == "none" or not SAFE_VALUE.fullmatch(model):
        raise RefusalError(f"{label} has no concrete safe model")
    if effort not in EFFORTS:
        raise RefusalError(f"{label} has unsupported effort: {effort}")


def validate_owner(host: str, model: str) -> None:
    if (host, model) == ("codex", "gpt-5.6-luna"):
        raise RefusalError(
            f"model is not eligible for adaptive-delivery ownership: {model}"
        )


def repository_routes(repo: Path) -> list[Route]:
    path = repo / ".darrow/config.json"
    if not path.exists() and not path.is_symlink():
        return []
    if path.is_symlink() or not path.is_file():
        raise RefusalError(
            f"repository route configuration is unreadable or unsafe: {path}"
        )
    text = read_text(path, "repository route configuration is unreadable or unsafe")
    try:
        return parse_document(text, allow_missing=True)
    except RefusalError as error:
        raise RefusalError(
            f"{error}\nrepository route configuration is invalid: {path}"
        ) from error


def catalog(repo: Path, plugin: Path) -> list[Route]:
    bundled = parse_document(
        read_text(plugin / "config/routes.json", "route configuration is unreadable")
    )
    overrides = repository_routes(repo)
    for source, routes in (("bundled", bundled), ("repository", overrides)):
        for route in routes:
            validate_tuple(
                f"{source} route for profile={route.profile}", route.host, route.tuple
            )
    keys = {route.key for route in bundled}
    for route in overrides:
        if route.key not in keys:
            raise RefusalError(
                f"repository route is not in bundled host/profile catalog: host={route.host} profile={route.profile}"
            )
    replacements = {
        route.key: replace(route, source="repository") for route in overrides
    }
    return [replacements.get(route.key, route) for route in bundled]
