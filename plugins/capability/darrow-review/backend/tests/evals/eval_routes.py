"""Independent oracle for retained review-reader identities and routes."""

import argparse
import json
import re
from pathlib import Path
from typing import Any


def row(path: Path, key: str) -> list[str]:
    matches = [
        line.split("\t")[1:]
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.split("\t")[0] == key
    ]
    assert len(matches) == 1, f"{path}: expected one {key}"
    return matches[0]


def route(host: str, profile: str) -> list[str]:
    routes = {
        ("codex", "default"): ["codex", "openai", "gpt-6-sol", "xhigh"],
        ("claude", "default"): ["claude", "anthropic", "claude-opus-5", "xhigh"],
        ("codex", "override"): ["codex", "openai", "gpt-5.5", "xhigh"],
        ("claude", "override"): ["claude", "anthropic", "claude-sonnet-5", "high"],
    }
    return routes[host, profile]


def identities(directory: Path, axes: list[str], expected: list[str]) -> dict[str, str]:
    field = "requested_route" if expected[0] == "codex" else "observed_route"
    result = {}
    for axis in axes:
        path = directory / f"{axis}-route.tsv"
        assert row(path, "axis") == [axis]
        assert row(path, field) == expected
        assert row(path, "route_bound") == ["true"]
        agent = row(path, "agent_id")
        assert len(agent) == 1 and agent[0]
        result[axis] = agent[0]
    assert len(set(result.values())) == len(axes), "reader identities must be distinct"
    if axes == ["standards"]:
        assert not (directory / "spec-route.tsv").exists()
    return result


def events_of(events: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [event for event in events if event.get("type") == kind]


def ordinal(event: dict[str, Any], key: str) -> int:
    value = event.get(key)
    assert isinstance(value, int) and not isinstance(value, bool) and value > 0
    return value


def codex_evidence(
    events: list[dict[str, Any]],
    agents: dict[str, str],
    expected: list[str],
) -> None:
    launches = events_of(events, "darrow.codex_native_spawn")
    assert len(launches) == len(agents), "unexpected native spawn count"
    ordinals: list[int] = []
    for axis, agent in agents.items():
        matches = [event for event in launches if event.get("agent_ref") == agent]
        assert len(matches) == 1
        event = matches[0]
        assert event.get("status") == "accepted"
        assert event.get("review_axis") == axis
        assert event.get("model") == expected[2]
        assert event.get("reasoning_effort") == expected[3]
        assert event.get("fork_turns") == "none"
        if len(agents) > 1:
            ordinals.append(ordinal(event, "accepted_ordinal"))
    if len(agents) > 1:
        waits = [
            ordinal(event, "ordinal")
            for event in events_of(events, "darrow.codex_native_wait")
        ]
        assert waits
        assert max(ordinals) < min(waits), (
            "both readers must be accepted before waiting"
        )


def agent_calls(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [call for item in value for call in agent_calls(item)]
    if isinstance(value, dict):
        if value.get("name") == "Agent":
            return [value]
        return [call for item in value.values() for call in agent_calls(item)]
    return []


def claude_calls(events: list[dict[str, Any]], axes: list[str], subagent: str) -> None:
    batches = [agent_calls(event) for event in events]
    calls = [call for batch in batches for call in batch]
    assert len(calls) == len(axes)
    assert any(len(batch) == len(axes) for batch in batches), (
        "readers need one launch batch"
    )
    observed_axes = []
    for call in calls:
        arguments = call["input"]
        assert arguments["subagent_type"] == subagent
        matches = re.findall(
            r"(?m)^- review_axis: (standards|spec)\s*$", arguments["prompt"]
        )
        assert len(matches) == 1
        observed_axes.extend(matches)
    assert sorted(observed_axes) == sorted(axes)


def claude_evidence(
    directory: Path,
    events: list[dict[str, Any]],
    agents: dict[str, str],
    expected: list[str],
) -> None:
    subagent = f"darrow-review:review-reader-{expected[2]}-{expected[3]}"
    claude_calls(events, list(agents), subagent)
    launches = events_of(events, "darrow.review_agent_launch")
    assert len(launches) == len(agents)
    batches = []
    for axis, agent in agents.items():
        observed = directory / f"{axis}-observed-route.tsv"
        assert row(observed, "agent_id") == [agent]
        assert row(observed, "observed_route") == expected
        verify_provider(directory, axis, len(agents))
        matching = [event for event in launches if event.get("agent_id") == agent]
        assert len(matching) == 1
        event = matching[0]
        assert event.get("review_axis") == axis
        assert event.get("subagent_type") == subagent
        batches.append(event.get("batch"))
    if len(agents) > 1:
        assert all(type(batch) is int for batch in batches)
        assert len(set(batches)) == 1


def verify_provider(directory: Path, axis: str, count: int) -> None:
    if count > 1:
        for suffix in ("route", "observed-route"):
            assert row(directory / f"{axis}-{suffix}.tsv", "provider_evidence") == [
                "current-host-environment-default"
            ]


def verify(git_dir: Path, host: str, profile: str, axes: list[str]) -> None:
    selections = sorted(git_dir.glob("**/darrow-review.*/reviewer-route.tsv"))
    assert selections, "missing reviewer route"
    directory = selections[-1].parent
    expected = route(host, profile)
    agents = identities(directory, axes, expected)
    events = [
        json.loads(line)
        for line in (git_dir / "retained-harness.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    assert all(isinstance(event, dict) for event in events)
    if host == "codex":
        codex_evidence(events, agents, expected)
    else:
        claude_evidence(directory, events, agents, expected)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=("codex", "claude"), required=True)
    parser.add_argument("--profile", choices=("default", "override"), required=True)
    parser.add_argument(
        "--axes", choices=("standards", "spec"), nargs="+", required=True
    )
    arguments = parser.parse_args()
    verify(Path(".git"), arguments.host, arguments.profile, arguments.axes)


if __name__ == "__main__":
    main()
