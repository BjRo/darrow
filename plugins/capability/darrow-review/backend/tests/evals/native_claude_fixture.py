"""Controlled native-view builder for Claude route-oracle counterexamples only."""

import hashlib
import json
from pathlib import Path
from typing import Any


def retain_claude(view: Path, events: list[dict[str, Any]]) -> None:
    files: dict[str, str] = {}
    parent = []
    results = []
    for number, event in enumerate(events):
        if event.get("type") != "darrow.review_agent_launch":
            continue
        agent = event["agent_id"]
        call = f"call-{number}"
        axis = event["review_axis"]
        subagent = event["subagent_type"]
        batch = f"batch-{event['batch']}"
        arguments = {
            "subagent_type": subagent,
            "run_in_background": False,
            "prompt": f"- review_axis: {axis}",
        }
        if f"project/root/subagents/agent-{agent}.meta.json" in files:
            arguments["resume"] = agent
        parent.append(
            {
                "type": "assistant",
                "message": {
                    "id": batch,
                    "content": [
                        {
                            "type": "tool_use",
                            "id": call,
                            "name": "Agent",
                            "input": arguments,
                        }
                    ],
                },
            }
        )
        results.append(
            {
                "type": "user",
                "message": {
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": call,
                            "content": "bounded reader judgment",
                        }
                    ]
                },
            }
        )
        model, effort = subagent.removeprefix("darrow-review:review-reader-").rsplit(
            "-", 1
        )
        stem = f"project/root/subagents/agent-{agent}"
        files[stem + ".meta.json"] = json.dumps(
            {
                "toolUseId": call,
                "agentType": subagent,
                "requestShape": "foreground",
                "finished": True,
            }
        )
        files[stem + ".jsonl"] = json.dumps(
            {
                "type": "assistant",
                "agentId": agent,
                "sessionId": "root",
                "effort": effort,
                "message": {"model": model},
            }
        )
    files["project/root.jsonl"] = "\n".join(
        json.dumps(row) for row in [*parent, *results]
    )
    entries = []
    for name, text in files.items():
        path = view / "claude" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        entries.append(
            {"path": name, "sha256": hashlib.sha256(text.encode()).hexdigest()}
        )
    (view / "index.json").write_text(
        json.dumps(
            {
                "format": "sevro.native-transcripts.v2",
                "host": "claude",
                "role": "candidate",
                "rootSessionId": "root",
                "completeness": "complete",
                "issues": [],
                "files": entries,
            }
        )
    )
