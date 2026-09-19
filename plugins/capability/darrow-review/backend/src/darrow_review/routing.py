"""Resolve configured strong reviewer routes and retain native application records."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

from .common import (
    ReviewError,
    new_record,
    package_root,
    read_text,
    record_file,
    require,
    root_directory,
    serialize,
    unique_records,
)
from .provider import direct, json_object


@dataclass(frozen=True)
class Route:
    host: str
    provider: str
    model: str
    effort: str
    source: str = "bundled"

    def fields(self) -> list[str]:
        return [self.host, self.provider, self.model, self.effort]

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
            [
                ["format", "darrow-reviewer-route-v1"],
                ["selected_route", *self.fields()],
                ["route_source", self.source],
            ]
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
    config = json_object(read_text(path, "reviewer configuration"))
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
    records = unique_records(record_file(path), "route")
    require(
        set(records) == {"format", "selected_route", "route_source"},
        f"incomplete or duplicate route record: {path}",
    )
    require(
        records["format"] == ["darrow-reviewer-route-v1"],
        f"invalid route format record: {path}",
    )
    fields = records["selected_route"]
    require(len(fields) == 4 and all(fields), f"invalid selected route record: {path}")
    require(
        records["route_source"] in (["bundled"], ["repository"]),
        f"invalid route source: {path}",
    )
    route = Route(
        fields[0], fields[1], fields[2], fields[3], records["route_source"][0]
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
        [
            ["format", "darrow-reviewer-route-selection-v1"],
            ["record", str(path)],
            ["selected_route", *route.fields()],
            ["route_source", route.source],
            ["model", route.model],
            ["reasoning_effort", route.effort],
        ]
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
        [
            ["format", "darrow-review-claude-agent-v1"],
            ["selected_route", *route.fields()],
            ["subagent_type", "darrow-review:" + name],
            ["model", route.model],
            ["effort", route.effort],
            ["agent_file", str(path)],
        ]
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
    records = unique_records(record_file(path), "observed-route")
    require(
        set(records)
        == {"format", "agent_id", "transcript", "provider_evidence", "observed_route"},
        f"incomplete or duplicate observed-route record: {path}",
    )
    require(
        records["format"] == ["darrow-review-claude-route-v1"],
        f"invalid observed-route format: {path}",
    )
    for field in ("agent_id", "transcript", "provider_evidence"):
        require(len(records[field]) == 1, f"invalid observed {field} record: {path}")
    require(
        re.fullmatch("[A-Za-z0-9]+", records["agent_id"][0]), "unsafe observed agent ID"
    )
    transcript = records["transcript"][0]
    require(
        Path(transcript).is_absolute(),
        f"observed transcript path is not absolute: {path}",
    )
    read_text(transcript, "observed transcript")
    require(
        records["provider_evidence"] == ["current-host-environment-default"],
        f"invalid observed provider evidence: {path}",
    )
    require(len(records["observed_route"]) == 4, f"invalid observed route: {path}")
    route = Route(*records["observed_route"])
    route.validate()
    require(route.host == "claude", "observed route is not a Claude route")
    return route, records["agent_id"][0]


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
    records = [
        ["format", "darrow-reviewer-route-application-v1"],
        ["selected_route", *route.fields()],
    ]
    if observed_path:
        actual, agent = observed(observed_path)
        require(
            actual.fields() == route.fields(),
            "selected reviewer route does not match transcript-observed route",
        )
        records.extend(
            [
                ["observed_route", *actual.fields()],
                ["provider_evidence", "current-host-environment-default"],
            ]
        )
    else:
        require(
            re.fullmatch("[A-Za-z0-9._/@:-]+", agent),
            f"unsafe reviewer agent ID: {agent}",
        )
        records.append(["requested_route", *route.fields()])
    records.extend(
        [
            ["route_applied_by", "native-subagent"],
            ["route_bound", "true"],
            ["axis", axis],
            ["agent_id", agent],
        ]
    )
    path = new_record(application, serialize(records))
    return serialize(
        [["format", "darrow-reviewer-record-location-v1"], ["record", str(path)]]
    )
