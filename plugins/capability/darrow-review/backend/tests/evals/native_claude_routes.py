"""Observe Claude reader routes from the public hash-verified native view."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

from native_codex_routes import decode, one


def captured(view: Path) -> tuple[str, dict[str, str]]:
    index = decode((view / "index.json").read_text())
    assert index.get("format") in {
        "sevro.native-transcripts.v1",
        "sevro.native-transcripts.v2",
    }
    assert (index.get("host"), index.get("role")) == ("claude", "candidate")
    assert index.get("completeness") == "complete" and index.get("issues") == []
    root = index.get("rootSessionId")
    assert isinstance(root, str) and root
    files = {}
    for entry in index["files"]:
        name = entry["path"]
        assert isinstance(name, str) and name not in files
        path = (view / "claude" / name).resolve()
        assert path.is_relative_to((view / "claude").resolve())
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"]
        files[name] = data.decode("utf-8")
    assert files
    return root, files


def blocks(event: dict[str, Any]) -> list[dict[str, Any]]:
    content = event.get("message", {}).get("content", [])
    return content if isinstance(content, list) else []


def route(text: str, agent: str, root: str, expected: list[str]) -> None:
    rows = [decode(line) for line in text.splitlines()]
    observations = [row for row in rows if row.get("type") == "assistant"]
    assert observations, "missing effective reader route"
    for row in observations:
        assert row.get("agentId") == agent and row.get("sessionId") == root
        assert [row.get("message", {}).get("model"), row.get("effort")] == expected


def launch(
    text: str, identity: str, axis: str | None, subagent: str
) -> tuple[str, int, int]:
    rows = [decode(line) for line in text.splitlines()]
    calls = [
        (index, row, block)
        for index, row in enumerate(rows)
        if row.get("type") == "assistant"
        for block in blocks(row)
        if block.get("type") == "tool_use" and block.get("id") == identity
    ]
    position, row, call = one(calls, "native Agent request")
    assert call.get("name") == "Agent"
    arguments = call["input"]
    assert arguments.get("subagent_type") == subagent
    assert arguments.get("run_in_background") is False
    assert not arguments.get("resume") and not arguments.get("model")
    if axis is not None:
        assert re.findall(
            r"(?m)^- review_axis: (standards|spec)\s*$", arguments.get("prompt", "")
        ) == [axis]
    results = [
        index
        for index, event in enumerate(rows)
        if event.get("type") == "user"
        for block in blocks(event)
        if block.get("tool_use_id") == identity
        and block.get("type") == "tool_result"
        and not block.get("is_error")
        and block.get("content")
    ]
    end = one(results, "completed Agent result")
    assert end > position
    batch = row["message"]["id"]
    assert isinstance(batch, str) and batch
    return batch, position, end


def bound_reader(
    root: str, files: dict[str, str], agent: str, expected: list[str]
) -> tuple[dict[str, Any], str]:
    suffix = f"/{root}/subagents/agent-{agent}.meta.json"
    name = one([name for name in files if name.endswith(suffix)], "reader sidecar")
    meta = decode(files[name])
    assert meta.get("finished") is True and meta.get("requestShape") == "foreground"
    route(files[name.removesuffix(".meta.json") + ".jsonl"], agent, root, expected[2:])
    parent = meta.get("parentAgentId")
    parent_suffix = f"/agent-{parent}.jsonl" if parent else f"/{root}.jsonl"
    parent_name = one(
        [name for name in files if name.endswith(parent_suffix)], "reader parent"
    )
    return meta, files[parent_name]


def placement(
    root: str, files: dict[str, str], meta: dict[str, Any], mode: str | None
) -> None:
    if mode is None:
        return
    parent = meta.get("parentAgentId")
    if mode == "inline":
        assert parent is None, "reader coordination is not inline"
        return
    assert isinstance(parent, str) and parent, "missing fallback coordinator"
    route = ["claude", "anthropic", "claude-sonnet-5-5", "medium"]
    coordinator, owner = bound_reader(root, files, parent, route)
    assert coordinator.get("parentAgentId") is None, "fallback adds another coordinator"
    launch(owner, coordinator["toolUseId"], None, coordinator["agentType"])


def verify_claude(
    view: Path, agents: dict[str, str], expected: list[str], mode: str | None = None
) -> None:
    root, files = captured(view)
    subagent = f"darrow-review:review-reader-{expected[2]}-{expected[3]}"
    batches, starts, ends, parents, identifiers = [], [], [], [], []
    for axis, agent in agents.items():
        meta, parent = bound_reader(root, files, agent, expected)
        assert meta.get("agentType") == subagent
        batch, start, end = launch(parent, meta["toolUseId"], axis, subagent)
        batches.append(batch)
        starts.append(start)
        ends.append(end)
        parents.append(meta.get("parentAgentId"))
        identifiers.append(meta["toolUseId"])
    assert len(set(batches)) == len(set(parents)) == 1, "readers need one launch batch"
    assert max(starts) < min(ends), "all readers must launch before the first result"
    placement(root, files, meta, mode)
    assert native_batch(parent, min(starts), min(ends)) == set(identifiers), (
        "unexpected native Agent launch in reader batch"
    )


def native_batch(text: str, start: int, end: int) -> set[str]:
    rows = [decode(line) for line in text.splitlines()]
    return {
        block["id"]
        for event in rows[start:end]
        for block in blocks(event)
        if block.get("type") == "tool_use" and block.get("name") == "Agent"
    }
