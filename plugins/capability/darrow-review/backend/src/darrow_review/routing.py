"""Resolve configured strong reviewer routes and retain native application records."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from .common import (
    ReviewError,
    document,
    new_record,
    package_root,
    read_text,
    record_file,
    require,
    root_directory,
    serialize,
)
from .provider import direct


@dataclass(frozen=True)
class Route:
    host: str
    provider: str
    model: str
    effort: str
    source: str = "bundled"

    def fields(self) -> list[str]:
        return [self.host, self.provider, self.model, self.effort]

    def as_object(self) -> dict[str, str]:
        return dict(
            zip(("host", "provider", "model", "effort"), self.fields(), strict=True)
        )

    def validate(self) -> None:
        require(
            (self.host, self.provider)
            in (("codex", "openai"), ("claude", "anthropic")),
            f"reviewer host and provider disagree: host={self.host} provider={self.provider}",
        )
        require(
            re.fullmatch("[A-Za-z0-9._-]+", self.model),
            f"unsafe reviewer model ID: {self.model}",
        )
        require(
            self.effort in ("low", "medium", "high", "xhigh", "max"),
            f"unsupported reviewer effort: {self.effort}",
        )

    def strong(self) -> None:
        self.validate()
        routes = {
            ("codex", "gpt-6-sol"): ("high", "xhigh", "max"),
            ("codex", "gpt-5.6-sol"): ("high", "xhigh", "max"),
            ("codex", "gpt-5.5"): ("high", "xhigh"),
            ("claude", "claude-opus-5"): ("xhigh",),
            ("claude", "claude-sonnet-5"): ("high",),
        }
        require(
            self.effort in routes.get((self.host, self.model), ()),
            f"unsupported strong reviewer route: host={self.host} provider={self.provider} model={self.model} effort={self.effort}",
        )

    def body(self) -> str:
        return serialize(
            {
                "format": "darrow-reviewer-route-v3",
                "selected_route": self.as_object(),
                "route_source": self.source,
            }
        )


def parse_reviewer(value: object, source: str) -> Route:
    if not isinstance(value, dict):
        raise ReviewError("invalid reviewer configuration: reviewer must be an object")
    require(
        set(value) == {"host", "harness", "provider", "model", "effort"},
        "invalid reviewer configuration: each reviewer must contain exactly five fields",
    )
    require(
        all(
            isinstance(field, str) and re.fullmatch("[A-Za-z0-9][A-Za-z0-9._-]*", field)
            for field in value.values()
        ),
        "invalid reviewer configuration: unsafe or empty reviewer value",
    )
    require(
        value["host"] == value["harness"],
        f"{source} reviewer host and harness disagree for host={value['host']}",
    )
    route = Route(
        str(value["host"]),
        str(value["provider"]),
        str(value["model"]),
        str(value["effort"]),
        source,
    )
    route.strong()
    return route


def catalog(path: Path, source: str) -> dict[str, Route]:
    config = document(read_text(path, "reviewer configuration"))
    require(
        set(config) <= {"reviewers", "routes"},
        "invalid reviewer configuration: unknown root field",
    )
    values = config.get("reviewers", [])
    if not isinstance(values, list):
        raise ReviewError("invalid reviewer configuration: reviewers must be an array")
    require(
        values or source == "repository",
        "invalid reviewer configuration: bundled reviewers array must not be empty",
    )
    result: dict[str, Route] = {}
    for value in values:
        route = parse_reviewer(value, source)
        require(
            route.host not in result,
            f"invalid reviewer configuration: duplicate reviewer for host={route.host}",
        )
        result[route.host] = route
    return result


def resolve(repo: str, host: str) -> Route:
    require(host in ("codex", "claude"), f"unsupported host: {host}")
    if host == "claude":
        direct()
    root = root_directory(repo)
    bundled = catalog(package_root().parent / "config/reviewers.json", "bundled")
    config = root / ".darrow/config.json"
    require(
        not config.is_symlink(),
        f"repository reviewer configuration is unreadable or unsafe: {config}",
    )
    if config.exists():
        overrides = catalog(config, "repository")
        require(
            overrides.keys() <= bundled.keys(),
            "repository reviewer host is not in bundled catalog",
        )
        bundled.update(overrides)
    require(host in bundled, f"no reviewer route for host={host}")
    return bundled[host]


def load_route(path: str, expected_host: str = "") -> Route:
    records = document(record_file(path))
    require(
        set(records) == {"format", "selected_route", "route_source"},
        f"incomplete or duplicate route record: {path}",
    )
    require(
        records["format"] == "darrow-reviewer-route-v3",
        f"invalid route format record: {path}",
    )
    fields = records["selected_route"]
    require(
        isinstance(fields, dict)
        and set(fields) == {"host", "provider", "model", "effort"}
        and all(isinstance(value, str) and value for value in fields.values()),
        f"invalid selected route record: {path}",
    )
    require(
        records["route_source"] in ("bundled", "repository"),
        f"invalid route source: {path}",
    )
    selected = cast(dict[str, str], fields)
    route = Route(
        selected["host"],
        selected["provider"],
        selected["model"],
        selected["effort"],
        cast(str, records["route_source"]),
    )
    route.validate()
    require(
        not expected_host or route.host == expected_host,
        f"route record host mismatch: expected={expected_host} actual={route.host}",
    )
    return route


def select(repo: str, host: str, record: str) -> str:
    route = resolve(repo, host)
    path = new_record(record, route.body())
    return serialize(
        {
            "format": "darrow-reviewer-route-selection-v3",
            "record": str(path),
            "selected_route": route.as_object(),
            "route_source": route.source,
            "model": route.model,
            "reasoning_effort": route.effort,
        }
    )


def claude_agent(route: Route) -> str:
    require(
        route.provider == "anthropic", f"unsupported Claude provider: {route.provider}"
    )
    direct()
    require(
        (route.model, route.effort)
        in (("claude-opus-5", "xhigh"), ("claude-sonnet-5", "high")),
        f"unsupported Claude reviewer route: {route.model}/{route.effort}",
    )
    name = f"review-reader-{route.model}-{route.effort}"
    path = package_root().parent / "agents" / f"{name}.md"
    lines = read_text(path, "review reader").splitlines()
    for label, expected in (
        ("name", name),
        ("model", route.model),
        ("effort", route.effort),
        ("background", "false"),
    ):
        require(
            f"{label}: {expected}" in lines,
            f"review reader {label} does not match route: {path}",
        )
    validate_overrides(route)
    return serialize(
        {
            "format": "darrow-review-claude-agent-v3",
            "selected_route": route.as_object(),
            "subagent_type": "darrow-review:" + name,
            "model": route.model,
            "effort": route.effort,
            "agent_file": str(path),
        }
    )


def validate_overrides(route: Route) -> None:
    for variable, expected, label in (
        ("CLAUDE_CODE_SUBAGENT_MODEL", route.model, "model"),
        ("CLAUDE_CODE_EFFORT_LEVEL", route.effort, "effort"),
    ):
        override = os.environ.get(variable, "")
        require(
            override in ("", expected),
            f"{variable} overrides selected {label}: {override}",
        )


def observed(path: str) -> tuple[Route, str]:
    records = document(record_file(path))
    require(
        set(records)
        == {"format", "agent_id", "transcript", "provider_evidence", "observed_route"},
        f"incomplete or duplicate observed-route record: {path}",
    )
    require(
        records["format"] == "darrow-review-claude-route-v3",
        f"invalid observed-route format: {path}",
    )
    for field in ("agent_id", "transcript", "provider_evidence"):
        require(
            isinstance(records[field], str) and records[field],
            f"invalid observed {field} record: {path}",
        )
    agent_id = cast(str, records["agent_id"])
    require(re.fullmatch("[A-Za-z0-9]+", agent_id), "unsafe observed agent ID")
    transcript = cast(str, records["transcript"])
    require(
        Path(transcript).is_absolute(),
        f"observed transcript path is not absolute: {path}",
    )
    read_text(transcript, "observed transcript")
    require(
        records["provider_evidence"] == "current-host-environment-default",
        f"invalid observed provider evidence: {path}",
    )
    observed_route = records["observed_route"]
    require(
        isinstance(observed_route, dict)
        and set(observed_route) == {"host", "provider", "model", "effort"}
        and all(isinstance(value, str) and value for value in observed_route.values()),
        f"invalid observed route: {path}",
    )
    fields = cast(dict[str, str], observed_route)
    route = Route(
        fields["host"],
        fields["provider"],
        fields["model"],
        fields["effort"],
    )
    route.validate()
    require(route.host == "claude", "observed route is not a Claude route")
    return route, agent_id


def confirm(
    route_path: str,
    axis: str,
    application: str,
    *,
    agent: str = "",
    observed_path: str = "",
) -> str:
    require(axis in ("standards", "spec"), f"unsupported review axis: {axis}")
    route = load_route(route_path, "claude" if observed_path else "codex")
    records: dict[str, object] = {
        "format": "darrow-reviewer-route-application-v3",
        "selected_route": route.as_object(),
    }
    if observed_path:
        actual, agent = observed(observed_path)
        require(
            actual.fields() == route.fields(),
            "selected reviewer route does not match transcript-observed route",
        )
        records["observed_route"] = actual.as_object()
        records["provider_evidence"] = "current-host-environment-default"
    else:
        require(
            re.fullmatch("[A-Za-z0-9._/@:-]+", agent),
            f"unsafe reviewer agent ID: {agent}",
        )
        records["requested_route"] = route.as_object()
    records.update(
        {
            "route_applied_by": "native-subagent",
            "route_bound": "true",
            "axis": axis,
            "agent_id": agent,
        }
    )
    path = new_record(application, serialize(records))
    return serialize(
        {"format": "darrow-reviewer-record-location-v3", "record": str(path)}
    )
