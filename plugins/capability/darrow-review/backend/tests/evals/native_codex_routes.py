"""Correlate Review routes using Sevro's public candidate transcript view."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, cast


def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        assert key not in result, f"duplicate JSON field: {key}"
        result[key] = value
    return result


def decode(text: str) -> dict[str, Any]:
    result = json.loads(text, object_pairs_hook=unique)
    assert isinstance(result, dict), "expected JSON object"
    return result


def one(values: list[Any], description: str) -> Any:
    assert len(values) == 1, f"expected one {description}"
    return values[0]


def payloads(rows: list[dict[str, Any]], kind: str) -> list[tuple[int, dict[str, Any]]]:
    return [
        (index, row["payload"])
        for index, row in enumerate(rows)
        if isinstance(row.get("payload"), dict) and row["payload"].get("type") == kind
    ]


def sessions(view: Path) -> tuple[str, dict[str, list[dict[str, Any]]]]:
    index = decode((view / "index.json").read_text(encoding="utf-8"))
    assert index.get("format") in {
        "sevro.native-transcripts.v1",
        "sevro.native-transcripts.v2",
    }, "unsupported native transcript view"
    assert (index.get("host"), index.get("role")) == ("codex", "candidate")
    assert index.get("completeness") == "complete" and index.get("issues") == []
    root = index.get("rootSessionId")
    assert isinstance(root, str) and root
    files = index.get("files")
    assert isinstance(files, list) and files
    result: dict[str, list[dict[str, Any]]] = {}
    names: set[str] = set()
    for entry in files:
        name = entry["path"]
        assert isinstance(name, str) and name not in names
        names.add(name)
        path = (view / "codex" / name).resolve()
        assert path.is_relative_to((view / "codex").resolve())
        content = path.read_bytes()
        assert hashlib.sha256(content).hexdigest() == entry["sha256"]
        if path.suffix == ".jsonl":
            rows = [
                decode(line) for line in content.decode().splitlines() if line.strip()
            ]
            meta = one(
                [row["payload"] for row in rows if row.get("type") == "session_meta"],
                "session metadata",
            )
            identity = meta["id"]
            assert isinstance(identity, str) and identity not in result
            result[identity] = rows
    assert root in result
    return root, result


def metadata(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        one(
            [row["payload"] for row in rows if row.get("type") == "session_meta"],
            "session metadata",
        ),
    )


def ancestry(root: str, captured: dict[str, list[dict[str, Any]]], child: str) -> None:
    seen: set[str] = set()
    current = child
    while current != root:
        assert current not in seen and current in captured, "unbound child ancestry"
        seen.add(current)
        parent = metadata(captured[current]).get("parent_thread_id")
        assert isinstance(parent, str) and parent
        current = parent


def completed(rows: list[dict[str, Any]]) -> None:
    starts = payloads(rows, "task_started")
    finals = [
        (index, value)
        for index, value in payloads(rows, "message")
        if value.get("role") == "assistant" and value.get("phase") == "final_answer"
    ]
    completions = payloads(rows, "task_complete")
    for end, completion in completions:
        turn = completion.get("turn_id")
        assert isinstance(turn, str) and turn, "missing completed turn identity"
        start, _ = one(
            [
                (i, p)
                for i, p in starts
                if p.get("turn_id") == completion.get("turn_id")
            ],
            "completed turn start",
        )
        messages = [(i, p) for i, p in finals if start < i < end]
        if messages:
            text = "".join(
                part.get("text", "")
                for part in messages[-1][1]["content"]
                if part.get("type") == "output_text"
            )
            assert text.strip() and text == completion.get("last_agent_message")
            return
    raise AssertionError("missing completed reader final")


def axis_of(arguments: dict[str, Any]) -> str:
    task = arguments.get("task_name")
    assert isinstance(task, str) and task
    axes = re.findall(
        r"(?<![A-Za-z0-9])(standards|spec)(?![A-Za-z0-9])",
        task,
    )
    assert len(axes) == 1, "missing or ambiguous axis task label"
    markers = re.findall(
        r"(?m)^- review_axis: (standards|spec)\s*$", arguments.get("message", "")
    )
    if markers:
        assert markers == axes, "conflicting plaintext review axis"
    axis = axes[0]
    assert isinstance(axis, str)
    return axis


def launch(
    rows: list[dict[str, Any]], agent: str, axis: str, expected: list[str]
) -> tuple[int, str, str]:
    starts = [
        (i, p["item"])
        for i, p in payloads(rows, "item_completed")
        if p.get("item", {}).get("type") == "SubAgentActivity"
        and p["item"].get("kind") == "started"
        and p["item"].get("agent_path") == agent
    ]
    started_at, started = one(starts, "native reader start")
    call_id = started["id"]
    called_at, call = one(
        [
            (i, p)
            for i, p in payloads(rows, "function_call")
            if p.get("call_id") == call_id
        ],
        "reader request",
    )
    assert call.get("name") == "spawn_agent"
    arguments = decode(call["arguments"])
    assert axis_of(arguments) == axis
    assert arguments.get("fork_turns") == "none"
    assert [arguments.get("model"), arguments.get("reasoning_effort")] == expected[2:]
    assert [started.get("model"), started.get("reasoning_effort")] == expected[2:]
    accepted_at, output = one(
        [
            (i, p)
            for i, p in payloads(rows, "function_call_output")
            if p.get("call_id") == call_id
        ],
        "accepted reader result",
    )
    assert decode(output["output"]).get("task_name") == agent
    assert called_at < started_at < accepted_at
    turn = call["internal_chat_message_metadata_passthrough"]["turn_id"]
    assert isinstance(turn, str) and turn
    child = started["agent_thread_id"]
    assert isinstance(child, str) and child
    return accepted_at, turn, child


def reader_returns(rows: list[dict[str, Any]], bindings: dict[str, str]) -> list[int]:
    positions = []
    for index, payload in payloads(rows, "item_completed"):
        item = payload.get("item", {})
        if (item.get("type"), item.get("kind")) != (
            "SubAgentActivity",
            "completed",
        ):
            continue
        child, agent = item.get("agent_thread_id"), item.get("agent_path")
        if child in bindings or agent in bindings.values():
            assert child in bindings and bindings[child] == agent, (
                "uncorrelated native reader result"
            )
            positions.append(index)
    return positions


def bound_readers(
    root: str,
    captured: dict[str, list[dict[str, Any]]],
    agents: dict[str, str],
    expected: list[str],
) -> tuple[str, str, set[str]]:
    children = {
        axis: one(
            [
                identity
                for identity, rows in captured.items()
                if metadata(rows).get("agent_path") == agent
            ],
            "bound child session",
        )
        for axis, agent in agents.items()
    }
    parents = {
        metadata(captured[child]).get("parent_thread_id") for child in children.values()
    }
    parent = one(list(parents), "reader coordinator")
    assert isinstance(parent, str) and parent in captured
    ancestry(root, captured, parent)
    rows = captured[parent]
    accepted: list[int] = []
    turns: set[str] = set()
    for axis, agent in agents.items():
        position, turn, child = launch(rows, agent, axis, expected)
        assert child == children[axis]
        completed(captured[child])
        accepted.append(position)
        turns.add(turn)
    turn = one(list(turns), "reader coordinator turn")
    calls = [
        (i, p)
        for i, p in payloads(rows, "function_call")
        if p.get("internal_chat_message_metadata_passthrough", {}).get("turn_id")
        == turn
    ]
    identifiers = {rows[index]["payload"]["call_id"] for index in accepted}
    first = min(i for i, p in calls if p.get("call_id") in identifiers)
    waits = [i for i, p in calls if p.get("name") == "wait_agent" and i > first]
    bindings = {child: agents[axis] for axis, child in children.items()}
    boundaries = waits + [i for i in reader_returns(rows, bindings) if i > first]
    end = min(boundaries) if boundaries else max(accepted) + 1
    spawns = [
        p["call_id"]
        for i, p in calls
        if first <= i < end and p.get("name") == "spawn_agent"
    ]
    assert set(spawns) == identifiers and len(spawns) == len(agents), (
        "unexpected native spawn count"
    )
    if len(agents) > 1:
        assert boundaries and max(accepted) < end, (
            "both readers must be accepted before waiting or receiving results"
        )
    return parent, turn, identifiers


def implementation_request(call: dict[str, Any]) -> bool:
    arguments = decode(call["arguments"])
    message = arguments.get("message", "")
    explicit_role = re.search(r"(?im)^\s*(?:please\s+)?implement\b", message)
    review_assignment = re.search(
        r"(?im)^\s*(?:please\s+)?review\b|\bread[- ]only\b", message
    )
    reader_packet = re.search(r"(?m)^- review_axis: (standards|spec)\s*$", message)
    reader_command = re.search(r"review-result\s+read-(?:fix-)?reader\b", message)
    return bool(
        explicit_role
        and not review_assignment
        and not reader_packet
        and not reader_command
    )


def coordinator_request(
    parent: str,
    captured: dict[str, list[dict[str, Any]]],
    call: dict[str, Any],
    coordinators: set[str],
) -> bool:
    starts = [
        (i, p["item"])
        for i, p in payloads(captured[parent], "item_completed")
        if p.get("item", {}).get("type") == "SubAgentActivity"
        and p["item"].get("kind") == "started"
        and p["item"].get("id") == call.get("call_id")
    ]
    if not starts or starts[0][1]["agent_thread_id"] not in coordinators:
        return False
    started_at, started = one(starts, "prior coordinator start")
    child = started["agent_thread_id"]
    assert metadata(captured[child]).get("parent_thread_id") == parent
    assert metadata(captured[child]).get("agent_path") == started["agent_path"]
    accepted_at, output = one(
        [
            (i, p)
            for i, p in payloads(captured[parent], "function_call_output")
            if p.get("call_id") == call.get("call_id")
        ],
        "accepted prior coordinator",
    )
    called_at, _ = one(
        [
            (i, p)
            for i, p in payloads(captured[parent], "function_call")
            if p.get("call_id") == call.get("call_id")
        ],
        "prior coordinator request",
    )
    assert called_at < started_at < accepted_at
    assert decode(output["output"]).get("task_name") == started["agent_path"]
    arguments = decode(call["arguments"])
    assert arguments.get("fork_turns") == "none"
    assert [arguments.get("model"), arguments.get("reasoning_effort")] == [
        started.get("model"),
        started.get("reasoning_effort"),
    ]
    completed(captured[child])
    return True


def verify_codex(
    view: Path,
    agents: dict[str, str],
    expected: list[str],
    prior: list[tuple[dict[str, str], list[str]]] | None = None,
) -> None:
    root, captured = sessions(view)
    groups = [bound_readers(root, captured, agents, expected)]
    groups.extend(
        bound_readers(root, captured, old, route) for old, route in prior or []
    )
    authorized: dict[str, set[str]] = {}
    for parent, _, identifiers in groups:
        assert not identifiers.intersection(authorized.get(parent, set())), (
            "reused assessment reader"
        )
        authorized.setdefault(parent, set()).update(identifiers)
    for parent in authorized:
        for _, call in payloads(captured[parent], "function_call"):
            if call.get("name") == "spawn_agent":
                assert (
                    call.get("call_id") in authorized[parent]
                    or implementation_request(call)
                    or coordinator_request(parent, captured, call, set(authorized))
                ), "unbound earlier reviewer launch"
