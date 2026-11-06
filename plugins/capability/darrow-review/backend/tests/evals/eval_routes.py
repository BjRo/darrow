"""Independent oracle for retained review-reader identities and routes."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from native_claude_routes import verify_claude
from native_codex_routes import verify_codex
from prior_codex_routes import prior_bindings


def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for name, value in pairs:
        assert name not in result, f"duplicate JSON field: {name}"
        result[name] = value
    return result


def row(path: Path, key: str) -> list[str]:
    record = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)
    assert isinstance(record, dict) and key in record, f"{path}: expected one {key}"
    value = record[key]
    if isinstance(value, str):
        return [value]
    assert isinstance(value, dict) and set(value) == {
        "host",
        "provider",
        "model",
        "effort",
    }, f"{path}: invalid {key}"
    fields = [value[name] for name in ("host", "provider", "model", "effort")]
    assert all(isinstance(field, str) for field in fields)
    return fields


def route(host: str, profile: str) -> list[str]:
    routes = {
        ("codex", "default"): ["codex", "openai", "gpt-6.1-sol", "xhigh"],
        ("claude", "default"): ["claude", "anthropic", "claude-opus-5-5", "xhigh"],
        ("codex", "override"): ["codex", "openai", "gpt-5.6-sol", "xhigh"],
        ("claude", "override"): ["claude", "anthropic", "claude-sonnet-5-5", "high"],
    }
    return routes[host, profile]


def identities(directory: Path, axes: list[str], expected: list[str]) -> dict[str, str]:
    field = "requested_route" if expected[0] == "codex" else "observed_route"
    result = {}
    for axis in axes:
        path = directory / f"{axis}-route.json"
        assert row(path, "axis") == [axis]
        assert row(path, field) == expected
        assert row(path, "route_bound") == ["true"]
        agent = row(path, "agent_id")
        assert len(agent) == 1 and agent[0]
        result[axis] = agent[0]
    assert len(set(result.values())) == len(axes), "reader identities must be distinct"
    if axes == ["standards"]:
        assert not (directory / "spec-route.json").exists()
    return result


def verify_provider(directory: Path, axis: str, count: int) -> None:
    if count > 1:
        for suffix in ("route", "observed-route"):
            assert row(directory / f"{axis}-{suffix}.json", "provider_evidence") == [
                "current-host-environment-default"
            ]


def verify(
    git_dir: Path,
    host: str,
    profile: str,
    axes: list[str],
    review_state: Path | None = None,
    record_name: str = "result.json",
    placement: str | None = None,
) -> None:
    assert record_name in {"result.json", "verification.json"}, "invalid aggregate kind"
    review_root = review_state if review_state is not None else git_dir
    finalized = {
        path.parent for path in review_root.glob(f"**/darrow-review.*/{record_name}")
    }
    assert len(finalized) == 1, "route evidence requires exactly one finalized scope"
    directory = finalized.pop()
    assert (directory / "reviewer-route.json").is_file(), "missing reviewer route"
    expected = route(host, profile)
    agents = identities(directory, axes, expected)
    if host == "codex":
        view = os.environ.get("SEVRO_CANDIDATE_TRANSCRIPTS")
        assert view, "missing candidate native transcript view"
        verify_codex(Path(view), agents, expected, prior_bindings(directory), placement)
        return
    view = os.environ.get("SEVRO_CANDIDATE_TRANSCRIPTS")
    assert view, "missing candidate native transcript view"
    verify_claude(Path(view), agents, expected, placement)
    for axis, agent in agents.items():
        assert row(directory / f"{axis}-observed-route.json", "agent_id") == [agent]
        assert (
            row(directory / f"{axis}-observed-route.json", "observed_route") == expected
        )
        verify_provider(directory, axis, len(agents))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=("codex", "claude"), required=True)
    parser.add_argument("--profile", choices=("default", "override"), required=True)
    parser.add_argument(
        "--axes", choices=("standards", "spec"), nargs="+", required=True
    )
    parser.add_argument(
        "--record-kind", choices=("result", "verification"), default="result"
    )
    parser.add_argument("--placement", choices=("inline", "fallback"))
    arguments = parser.parse_args()
    review_root = os.environ.get("DARROW_REVIEW_STATE_DIR")
    assert review_root, "missing review-state directory"
    verify(
        Path(".git"),
        arguments.host,
        arguments.profile,
        arguments.axes,
        Path(review_root),
        f"{arguments.record_kind}.json",
        arguments.placement,
    )


if __name__ == "__main__":
    main()
