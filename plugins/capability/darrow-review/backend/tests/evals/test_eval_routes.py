"""Valid evidence and false-positive counterexamples for the independent eval oracle."""

import json
from pathlib import Path
from typing import Any

import pytest
from eval_routes import row, verify


def evidence(root: Path, host: str, axes: list[str]) -> list[dict[str, Any]]:
    directory = root / "darrow-review.fixture"
    directory.mkdir()
    (directory / "reviewer-route.json").write_text("fixture\n")
    model, provider = (
        ("gpt-6-sol", "openai") if host == "codex" else ("claude-opus-5", "anthropic")
    )
    route = {"host": host, "provider": provider, "model": model, "effort": "xhigh"}
    subagent = f"darrow-review:review-reader-{model}-xhigh"
    events: list[dict[str, Any]] = []
    calls = []
    for index, axis in enumerate(axes, 1):
        record = json.dumps(
            {
                "axis": axis,
                "agent_id": f"{axis}-child",
                "requested_route": route,
                "observed_route": route,
                "route_bound": "true",
                "provider_evidence": "current-host-environment-default",
            }
        )
        for suffix in ("route", "observed-route"):
            (directory / f"{axis}-{suffix}.json").write_text(record)
        if host == "codex":
            events.append(
                {
                    "type": "darrow.codex_native_spawn",
                    "status": "accepted",
                    "agent_ref": f"{axis}-child",
                    "review_axis": axis,
                    "model": model,
                    "reasoning_effort": "xhigh",
                    "fork_turns": "none",
                    "accepted_ordinal": index,
                }
            )
        else:
            events.append(
                {
                    "type": "darrow.review_agent_launch",
                    "agent_id": f"{axis}-child",
                    "review_axis": axis,
                    "subagent_type": subagent,
                    "batch": 1,
                }
            )
            calls.append(
                {
                    "name": "Agent",
                    "input": {
                        "subagent_type": subagent,
                        "prompt": f"- review_axis: {axis}",
                    },
                }
            )
    if host == "codex":
        events.append({"type": "darrow.codex_native_wait", "ordinal": 3})
    else:
        events.append({"type": "assistant", "message": {"content": calls}})
    return events


def retain(root: Path, events: list[dict[str, Any]]) -> None:
    # Whitespace and key order differ from the compact harness serialization.
    (root / "retained-harness.jsonl").write_text(
        "\n".join(
            json.dumps(event, sort_keys=True, separators=(", ", ": "))
            for event in events
        )
        + "\n",
    )


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("axes", [["standards"], ["standards", "spec"]])
def test_structured_evidence_ignores_json_formatting(
    tmp_path: Path,
    host: str,
    axes: list[str],
) -> None:
    retain(tmp_path, evidence(tmp_path, host, axes))
    verify(tmp_path, host, "default", axes)


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("mutation", ["missing", "duplicate", "axis", "identity"])
def test_single_axis_rejects_uncorrelated_launches(
    tmp_path: Path,
    host: str,
    mutation: str,
) -> None:
    events = evidence(tmp_path, host, ["standards"])
    if mutation == "missing":
        events.pop(0)
    elif mutation == "duplicate":
        events.append(events[0])
    elif mutation == "axis":
        events[0]["review_axis"] = "spec"
    else:
        events[0]["agent_ref" if host == "codex" else "agent_id"] = "unrelated"
    retain(tmp_path, events)
    with pytest.raises(AssertionError):
        verify(tmp_path, host, "default", ["standards"])


def test_duplicate_json_identity_is_not_evidence(tmp_path: Path) -> None:
    path = tmp_path / "route.json"
    path.write_text('{"agent_id":"first","agent_id":"second"}')
    with pytest.raises(AssertionError, match="duplicate JSON field"):
        row(path, "agent_id")


def test_review_evidence_can_be_outside_git_dir(tmp_path: Path) -> None:
    git_dir = tmp_path / "repo" / ".git"
    review_state = tmp_path / "review-state"
    git_dir.mkdir(parents=True)
    review_state.mkdir()
    retain(git_dir, evidence(review_state, "codex", ["standards"]))
    verify(git_dir, "codex", "default", ["standards"], review_state)
