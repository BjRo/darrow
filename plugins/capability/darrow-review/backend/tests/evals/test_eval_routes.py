"""Valid evidence and false-positive counterexamples for the independent eval oracle."""

import json
import os
from pathlib import Path
from typing import Any

import pytest
from eval_routes import row, verify
from native_fixture import retain_native


@pytest.fixture(autouse=True)
def native_view(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SEVRO_CANDIDATE_TRANSCRIPTS", str(tmp_path / "native-view"))


def evidence(root: Path, host: str, axes: list[str]) -> list[dict[str, Any]]:
    directory = root / "darrow-review.fixture"
    directory.mkdir()
    (directory / "reviewer-route.json").write_text("fixture\n")
    (directory / "result.json").write_text('{"format":"darrow-review-result-v3"}\n')
    model, provider = (
        ("gpt-6.1-sol", "openai")
        if host == "codex"
        else ("claude-opus-5-5", "anthropic")
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
    retain_native(Path(os.environ["SEVRO_CANDIDATE_TRANSCRIPTS"]), events)
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


def test_abandoned_preparation_cannot_replace_finalized_scope(tmp_path: Path) -> None:
    retain(tmp_path, evidence(tmp_path, "codex", ["standards", "spec"]))
    abandoned = tmp_path / "darrow-review.zzz-abandoned"
    abandoned.mkdir()
    (abandoned / "reviewer-route.json").write_text("fixture\n")
    verify(tmp_path, "codex", "default", ["standards", "spec"])


@pytest.mark.parametrize("mutation", ["missing", "ambiguous"])
def test_route_evidence_requires_one_finalized_scope(
    tmp_path: Path, mutation: str
) -> None:
    retain(tmp_path, evidence(tmp_path, "codex", ["standards"]))
    if mutation == "missing":
        (tmp_path / "darrow-review.fixture" / "result.json").unlink()
    else:
        other = tmp_path / "darrow-review.another"
        other.mkdir()
        (other / "result.json").write_text("{}\n")
    with pytest.raises(AssertionError, match="exactly one finalized scope"):
        verify(tmp_path, "codex", "default", ["standards"])


def test_followup_routes_select_verification_scope(tmp_path: Path) -> None:
    retain(tmp_path, evidence(tmp_path, "codex", ["standards", "spec"]))
    scope = tmp_path / "darrow-review.fixture"
    (scope / "result.json").rename(scope / "verification.json")
    original = tmp_path / "darrow-review.original"
    original.mkdir()
    (original / "result.json").write_text("{}\n")
    verify(
        tmp_path,
        "codex",
        "default",
        ["standards", "spec"],
        record_name="verification.json",
    )


@pytest.mark.parametrize("mutation", ["missing", "duplicate"])
def test_followup_does_not_substitute_or_choose_among_scopes(
    tmp_path: Path, mutation: str
) -> None:
    retain(tmp_path, evidence(tmp_path, "codex", ["standards"]))
    if mutation == "duplicate":
        for name in ("first", "second"):
            directory = tmp_path / f"darrow-review.{name}"
            directory.mkdir()
            (directory / "verification.json").write_text("{}\n")
    with pytest.raises(AssertionError, match="exactly one finalized scope"):
        verify(
            tmp_path,
            "codex",
            "default",
            ["standards"],
            record_name="verification.json",
        )


def test_unknown_aggregate_kind_is_refused(tmp_path: Path) -> None:
    with pytest.raises(AssertionError, match="invalid aggregate kind"):
        verify(tmp_path, "codex", "default", ["standards"], record_name="peer.json")


def test_later_bound_readers_do_not_hide_an_earlier_inherited_launch(
    tmp_path: Path,
) -> None:
    events = evidence(tmp_path, "codex", ["standards", "spec"])
    events.insert(
        0,
        {
            "type": "darrow.codex_native_spawn",
            "status": "unaccepted",
            "requested_ordinal": 1,
            "review_axis": "standards",
            "fork_turns": "all",
            "reasons": ["model", "reasoning_effort"],
        },
    )
    retain(tmp_path, events)
    with pytest.raises(AssertionError, match="unbound earlier reviewer launch"):
        verify(tmp_path, "codex", "default", ["standards", "spec"])
