"""Native transcript fixture builder for route-oracle unit controls only."""

import hashlib
import json
from pathlib import Path
from typing import Any


def retain_native(view: Path, events: list[dict[str, Any]]) -> None:
    parent: list[tuple[float, dict[str, Any]]] = []
    captures: dict[str, list[dict[str, Any]]] = {
        "root": [{"type": "session_meta", "payload": {"id": "root"}}]
    }
    for number, event in enumerate(events):
        if event.get("type") == "darrow.codex_native_wait":
            parent.append(
                (
                    event["ordinal"],
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "function_call",
                            "name": "wait_agent",
                            "internal_chat_message_metadata_passthrough": {
                                "turn_id": event.get("turn_id", "turn")
                            },
                        },
                    },
                )
            )
        elif event.get("type") == "darrow.codex_native_spawn":
            position = event.get("accepted_ordinal", event.get("requested_ordinal", 1))
            call_id = f"call-{number}"
            agent = event.get("agent_ref", "unaccepted")
            child = f"child-{number}"
            arguments = {
                "task_name": event.get("task_name", f"reader_{event['review_axis']}"),
                "fork_turns": event["fork_turns"],
                "model": event.get("model"),
                "reasoning_effort": event.get("reasoning_effort"),
                "message": event.get("message", "encrypted fixture message"),
            }
            parent.append(
                (
                    position - 0.2,
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "function_call",
                            "call_id": call_id,
                            "name": "spawn_agent",
                            "arguments": json.dumps(arguments),
                            "internal_chat_message_metadata_passthrough": {
                                "turn_id": event.get("turn_id", "turn")
                            },
                        },
                    },
                )
            )
            if event["status"] == "accepted":
                parent.extend(
                    [
                        (
                            position - 0.1,
                            {
                                "type": "event_msg",
                                "payload": {
                                    "type": "item_completed",
                                    "item": {
                                        "type": "SubAgentActivity",
                                        "kind": "started",
                                        "id": call_id,
                                        "agent_path": agent,
                                        "agent_thread_id": child,
                                        "model": event["model"],
                                        "reasoning_effort": event["reasoning_effort"],
                                    },
                                },
                            },
                        ),
                        (
                            position,
                            {
                                "type": "response_item",
                                "payload": {
                                    "type": "function_call_output",
                                    "call_id": call_id,
                                    "output": json.dumps({"task_name": agent}),
                                },
                            },
                        ),
                    ]
                )
                captures[child] = [
                    {
                        "type": "session_meta",
                        "payload": {
                            "id": child,
                            "parent_thread_id": "root",
                            "agent_path": agent,
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {"type": "task_started", "turn_id": child},
                    },
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "assistant",
                            "phase": "final_answer",
                            "content": [
                                {"type": "output_text", "text": "bounded reader result"}
                            ],
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "task_complete",
                            "turn_id": child,
                            "last_agent_message": "bounded reader result",
                        },
                    },
                ]
    captures["root"].extend(row for _, row in sorted(parent, key=lambda item: item[0]))
    write_view(view, captures)


def write_view(view: Path, captures: dict[str, list[dict[str, Any]]]) -> None:
    (view / "codex").mkdir(parents=True, exist_ok=True)
    files = []
    for name, rows in captures.items():
        content = "\n".join(json.dumps(row) for row in rows).encode() + b"\n"
        path = f"{name}.jsonl"
        (view / "codex" / path).write_bytes(content)
        files.append({"path": path, "sha256": hashlib.sha256(content).hexdigest()})
    (view / "index.json").write_text(
        json.dumps(
            {
                "format": "sevro.native-transcripts.v1",
                "host": "codex",
                "role": "candidate",
                "rootSessionId": "root",
                "completeness": "complete",
                "issues": [],
                "files": files,
            }
        )
    )


def read_view(view: Path) -> dict[str, list[dict[str, Any]]]:
    index = json.loads((view / "index.json").read_text())
    return {
        Path(entry["path"]).stem: [
            json.loads(line)
            for line in (view / "codex" / entry["path"]).read_text().splitlines()
        ]
        for entry in index["files"]
    }
