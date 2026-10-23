"""Automatic native reader returns preserve the closed parallel launch batch."""

from pathlib import Path
from typing import Any

import pytest
from native_codex_routes import verify_codex
from native_fixture import read_view, retain_native, write_view
from test_eval_routes import evidence
from test_native_codex_routes import AGENTS, ROUTE


def returned(child: str, agent: str) -> dict[str, Any]:
    return {
        "type": "event_msg",
        "payload": {
            "type": "item_completed",
            "item": {
                "type": "SubAgentActivity",
                "kind": "completed",
                "agent_thread_id": child,
                "agent_path": agent,
            },
        },
    }


def automatic_view(tmp_path: Path, *, wait: bool = False) -> Path:
    view = tmp_path / "native-view"
    events = evidence(tmp_path, "codex", ["standards", "spec"])
    if not wait:
        events.pop()
    retain_native(view, events)
    captured = read_view(view)
    captured["root"].extend(
        [returned("child-0", AGENTS["standards"]), returned("child-1", AGENTS["spec"])]
    )
    write_view(view, captured)
    return view


def test_automatic_results_accept_both_readers_without_explicit_wait(
    tmp_path: Path,
) -> None:
    verify_codex(automatic_view(tmp_path), AGENTS, ROUTE)


@pytest.mark.parametrize("wait", [False, True])
@pytest.mark.parametrize("before", ["second request", "second acceptance"])
def test_automatic_result_before_second_acceptance_rejects_sequential_batch(
    tmp_path: Path, wait: bool, before: str
) -> None:
    view = automatic_view(tmp_path, wait=wait)
    captured = read_view(view)
    parent = captured["root"]
    receipt = parent.pop(-2)
    parent.insert(4 if before == "second request" else 6, receipt)
    write_view(view, captured)
    with pytest.raises(AssertionError):
        verify_codex(view, AGENTS, ROUTE)


@pytest.mark.parametrize(
    "mutation", ["missing", "wrong thread", "wrong path", "not completed"]
)
def test_automatic_results_need_native_binding_and_completion(
    tmp_path: Path, mutation: str
) -> None:
    view = automatic_view(tmp_path)
    captured = read_view(view)
    receipts = captured["root"][-2:]
    for receipt in receipts:
        item = receipt["payload"]["item"]
        if mutation == "wrong thread":
            item["agent_thread_id"] = "unrelated"
        elif mutation == "wrong path":
            item["agent_path"] = "unrelated"
        else:
            item["kind"] = "started"
    if mutation == "missing":
        del captured["root"][-2:]
    write_view(view, captured)
    with pytest.raises(AssertionError):
        verify_codex(view, AGENTS, ROUTE)


def test_extra_implementation_launch_before_automatic_result_closes_batch(
    tmp_path: Path,
) -> None:
    view = automatic_view(tmp_path)
    captured = read_view(view)
    extra = {
        "type": "response_item",
        "payload": {
            "type": "function_call",
            "name": "spawn_agent",
            "call_id": "extra-implementation",
            "arguments": '{"message":"Implement the approved feature."}',
            "internal_chat_message_metadata_passthrough": {"turn_id": "turn"},
        },
    }
    captured["root"].insert(-2, extra)
    write_view(view, captured)
    with pytest.raises(AssertionError, match="unexpected native spawn count"):
        verify_codex(view, AGENTS, ROUTE)
