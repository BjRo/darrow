"""Public capture and native correlation counterexamples for Codex routes."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from native_codex_routes import verify_codex
from native_fixture import read_view, retain_native, write_view
from test_eval_routes import evidence

AGENTS = {"standards": "standards-child", "spec": "spec-child"}
ROUTE = ["codex", "openai", "gpt-6.1-sol", "xhigh"]


def prepared(tmp_path: Path) -> Path:
    view = tmp_path / "native-view"
    retain_native(view, evidence(tmp_path, "codex", ["standards", "spec"]))
    return view


def test_current_capture_accepts_bound_completed_readers(tmp_path: Path) -> None:
    verify_codex(prepared(tmp_path), AGENTS, ROUTE)


def earlier_events(tmp_path: Path, *, inherited: bool = False) -> list[dict[str, Any]]:
    current = evidence(tmp_path, "codex", ["standards", "spec"])
    earlier = dict(
        current[0],
        agent_ref="old-standards",
        turn_id="earlier",
        fork_turns="all" if inherited else "none",
        accepted_ordinal=-1,
    )
    return [
        earlier,
        {"type": "darrow.codex_native_wait", "turn_id": "earlier", "ordinal": 0},
        *current,
    ]


@pytest.mark.parametrize("inherited", [True, False])
def test_earlier_unbound_reader_cannot_be_hidden_by_later_valid_readers(
    tmp_path: Path, inherited: bool
) -> None:
    view = tmp_path / "native-view"
    retain_native(view, earlier_events(tmp_path, inherited=inherited))
    with pytest.raises(AssertionError, match="unbound earlier reviewer"):
        verify_codex(view, AGENTS, ROUTE)


def test_validated_prior_readers_remain_separately_bound(tmp_path: Path) -> None:
    view = tmp_path / "native-view"
    retain_native(view, earlier_events(tmp_path))
    verify_codex(view, AGENTS, ROUTE, [({"standards": "old-standards"}, ROUTE)])


def test_prior_binding_cannot_excuse_inherited_context(tmp_path: Path) -> None:
    view = tmp_path / "native-view"
    retain_native(view, earlier_events(tmp_path, inherited=True))
    with pytest.raises(AssertionError):
        verify_codex(view, AGENTS, ROUTE, [({"standards": "old-standards"}, ROUTE)])


def test_unrelated_implementation_child_in_earlier_turn_is_allowed(
    tmp_path: Path,
) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path)
    events[0]["task_name"] = "implement_feature"
    events[0]["message"] = "Implement the approved feature and update its tests."
    retain_native(view, events)
    verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize(
    "mutation",
    [
        "partial",
        "peer role",
        "missing root",
        "bad hash",
        "duplicate file",
        "escaping path",
    ],
)
def test_current_capture_rejects_invalid_index(tmp_path: Path, mutation: str) -> None:
    view = prepared(tmp_path)
    index = json.loads((view / "index.json").read_text())
    actions: dict[str, Callable[[], Any]] = {
        "partial": lambda: index.update(completeness="partial"),
        "peer role": lambda: index.update(role="semantic"),
        "missing root": lambda: index.update(rootSessionId="unrelated"),
        "bad hash": lambda: index["files"][0].update(sha256="0" * 64),
        "duplicate file": lambda: index["files"].append(index["files"][0]),
        "escaping path": lambda: index["files"][0].update(path="../../outside.jsonl"),
    }
    actions[mutation]()
    (view / "index.json").write_text(json.dumps(index))
    with pytest.raises(AssertionError):
        verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize("task", ["review_code", "anonymous_reader", "unmarked_child"])
def test_unbound_earlier_launch_without_axis_marker_is_rejected(
    tmp_path: Path, task: str
) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path, inherited=True)
    events[0]["task_name"] = task
    retain_native(view, events)
    with pytest.raises(AssertionError, match="unbound earlier"):
        verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize(
    "task",
    ["implement_spec", "implement_review", "implementation_standards", "update_spec"],
)
def test_explicit_implementation_role_can_include_review_terms(
    tmp_path: Path, task: str
) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path)
    events[0]["task_name"] = task
    events[0]["message"] = (
        "Implement the approved specification change and update its tests."
    )
    retain_native(view, events)
    verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize(
    "message",
    [
        "Review the changes against the specification. Remain read-only and return findings.",
        "Implement the approved change.\nRemain read-only and return findings.",
        "encrypted fixture message",
    ],
)
def test_implementation_label_does_not_establish_or_override_assignment(
    tmp_path: Path, message: str
) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path, inherited=True)
    events[0].update(task_name="implement_spec", message=message)
    retain_native(view, events)
    with pytest.raises(AssertionError, match="unbound earlier"):
        verify_codex(view, AGENTS, ROUTE)


def test_prior_review_and_fix_verification_can_share_a_coordinator_turn(
    tmp_path: Path,
) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path)
    events[0]["turn_id"] = "turn"
    events[1]["turn_id"] = "turn"
    retain_native(view, events)
    verify_codex(view, AGENTS, ROUTE, [({"standards": "old-standards"}, ROUTE)])


def inherited_context(parent: list[dict[str, Any]]) -> None:
    arguments = json.loads(parent[1]["payload"]["arguments"])
    arguments["fork_turns"] = "all"
    parent[1]["payload"]["arguments"] = json.dumps(arguments)


def test_implementation_label_cannot_hide_a_reader_packet(tmp_path: Path) -> None:
    view = tmp_path / "native-view"
    events = earlier_events(tmp_path, inherited=True)
    events[0].update(
        task_name="implement_spec",
        message="- review_axis: spec\nReview the prior changes.",
    )
    retain_native(view, events)
    with pytest.raises(AssertionError, match="unbound earlier"):
        verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize("inherited", [False, True])
def test_prior_assessment_coordinator_is_bound_to_its_completed_native_children(
    tmp_path: Path,
    inherited: bool,
) -> None:
    view = prepared(tmp_path)
    captured = read_view(view)
    prior_view = tmp_path / "prior-view"
    retain_native(
        prior_view,
        [
            {
                "type": "darrow.codex_native_spawn",
                "status": "accepted",
                "agent_ref": "old-standards",
                "review_axis": "standards",
                "model": ROUTE[2],
                "reasoning_effort": ROUTE[3],
                "fork_turns": "none",
                "accepted_ordinal": 1,
            },
            {"type": "darrow.codex_native_wait", "ordinal": 2},
        ],
    )
    old = read_view(prior_view)
    coordinator, reader = old["root"], old["child-0"]
    coordinator[0]["payload"].update(
        id="prior-coordinator", parent_thread_id="root", agent_path="/root/prior_review"
    )
    reader[0]["payload"].update(id="prior-reader", parent_thread_id="prior-coordinator")
    coordinator[2]["payload"]["item"]["agent_thread_id"] = "prior-reader"
    coordinator.insert(
        1,
        {
            "type": "event_msg",
            "payload": {"type": "task_started", "turn_id": "coordinator-turn"},
        },
    )
    coordinator.extend(
        [
            reader[2],
            {
                "type": "event_msg",
                "payload": {
                    "type": "task_complete",
                    "turn_id": "coordinator-turn",
                    "last_agent_message": "bounded reader result",
                },
            },
        ]
    )
    arguments = {
        "task_name": "prior_review",
        "fork_turns": "all" if inherited else "none",
        "model": "gpt-6-luna",
        "reasoning_effort": "medium",
        "message": "Coordinate the prior review.",
    }
    captured["root"][1:1] = [
        {
            "type": "response_item",
            "payload": {
                "type": "function_call",
                "name": "spawn_agent",
                "call_id": "coordinator-call",
                "arguments": json.dumps(arguments),
                "internal_chat_message_metadata_passthrough": {"turn_id": "earlier"},
            },
        },
        {
            "type": "event_msg",
            "payload": {
                "type": "item_completed",
                "item": {
                    "type": "SubAgentActivity",
                    "kind": "started",
                    "id": "coordinator-call",
                    "agent_thread_id": "prior-coordinator",
                    "agent_path": "/root/prior_review",
                    "model": "gpt-6-luna",
                    "reasoning_effort": "medium",
                },
            },
        },
        {
            "type": "response_item",
            "payload": {
                "type": "function_call_output",
                "call_id": "coordinator-call",
                "output": json.dumps({"task_name": "/root/prior_review"}),
            },
        },
    ]
    captured.update({"prior-coordinator": coordinator, "prior-reader": reader})
    write_view(view, captured)
    if inherited:
        with pytest.raises(AssertionError):
            verify_codex(view, AGENTS, ROUTE, [({"standards": "old-standards"}, ROUTE)])
    else:
        verify_codex(view, AGENTS, ROUTE, [({"standards": "old-standards"}, ROUTE)])


@pytest.mark.parametrize(
    "mutation",
    [
        "wrong parent",
        "missing acceptance",
        "wrong accepted path",
        "wrong effective model",
        "inherited context",
        "missing final",
        "missing completion",
        "wrong completed turn",
        "empty final",
        "different completed message",
        "wrong child id",
        "wrong coordinator turn",
    ],
)
def test_current_capture_rejects_uncorrelated_records(
    tmp_path: Path, mutation: str
) -> None:
    view = prepared(tmp_path)
    index = json.loads((view / "index.json").read_text())
    captured = {
        Path(entry["path"]).stem: [
            json.loads(line)
            for line in (view / "codex" / entry["path"]).read_text().splitlines()
        ]
        for entry in index["files"]
    }
    child = captured["child-0"]
    parent = captured["root"]
    actions: dict[str, Callable[[], Any]] = {
        "wrong parent": lambda: child[0]["payload"].update(parent_thread_id="peer"),
        "missing acceptance": lambda: parent.pop(3),
        "wrong accepted path": lambda: parent[3]["payload"].update(
            output='{"task_name":"unrelated"}'
        ),
        "wrong effective model": lambda: parent[2]["payload"]["item"].update(
            model="unrelated"
        ),
        "inherited context": lambda: inherited_context(parent),
        "missing final": lambda: child.pop(2),
        "missing completion": lambda: child.pop(3),
        "wrong completed turn": lambda: child[3]["payload"].update(turn_id="peer"),
        "empty final": lambda: child[2]["payload"]["content"][0].update(text=""),
        "different completed message": lambda: child[3]["payload"].update(
            last_agent_message="unrelated"
        ),
        "wrong child id": lambda: parent[2]["payload"]["item"].update(
            agent_thread_id="child-1"
        ),
        "wrong coordinator turn": lambda: parent[4]["payload"][
            "internal_chat_message_metadata_passthrough"
        ].update(turn_id="peer"),
    }
    actions[mutation]()
    write_view(view, captured)
    with pytest.raises((AssertionError, KeyError)):
        verify_codex(view, AGENTS, ROUTE)
