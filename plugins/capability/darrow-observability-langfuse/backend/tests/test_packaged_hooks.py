"""Exercise packaged hook registration and the real host launcher."""

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

import pytest

PLUGIN = Path(__file__).resolve().parents[2]


def manifest(path: str) -> Any:
    return json.loads((PLUGIN / path).read_text(encoding="utf-8"))


def handlers(event: str) -> list[dict[str, Any]]:
    return [
        handler
        for registration in manifest("hooks/hooks.json")["hooks"][event]
        for handler in registration["hooks"]
    ]


def test_manifest_identity() -> None:
    claude = manifest(".claude-plugin/plugin.json")
    codex = manifest(".codex-plugin/plugin.json")
    assert claude["name"] == codex["name"] == "darrow-observability-langfuse"
    assert re.fullmatch(r"\d+\.\d+\.\d+", claude["version"])
    assert claude["version"] == codex["version"]
    assert codex["skills"] == "./skills/"
    assert codex["hooks"] == "./hooks/hooks.json"
    assert (PLUGIN / "hooks/stop.sh").is_file()
    assert (PLUGIN / "hooks/stop.ps1").is_file()
    marketplace = json.loads(
        (PLUGIN.parents[2] / ".claude-plugin/marketplace.json").read_text()
    )
    entry = next(p for p in marketplace["plugins"] if p["name"] == claude["name"])
    assert entry["source"] == "./plugins/capability/darrow-observability-langfuse"


@pytest.mark.parametrize("event", ["UserPromptSubmit", "Stop"])
def test_capture_and_delivery_registration(event: str) -> None:
    registered = handlers(event)
    first = registered[0]
    assert first["type"] == "command"
    assert "${PLUGIN_ROOT}" in first["command"]
    assert "hooks/stop.sh" in first["command"]
    assert "${PLUGIN_ROOT}" in first["commandWindows"]
    assert "hooks/stop.ps1" in first["commandWindows"]
    assert any(not h.get("async") and "--drain" not in h["command"] for h in registered)
    assert any(h.get("async") is True and "--drain" in h["command"] for h in registered)
    assert any(
        h.get("async") is True and "--drain" in h["commandWindows"] for h in registered
    )


def test_session_start_recovers_delivery() -> None:
    assert any(
        h.get("async") is True and "--drain" in h["command"]
        for h in handlers("SessionStart")
    )


@pytest.mark.parametrize("event", ["Interrupt", "SessionEnd"])
def test_terminal_receipt_registration(event: str) -> None:
    registered = handlers(event)
    assert registered
    for handler in registered:
        assert not handler.get("async")
        assert "--drain" not in handler["command"]
        assert handler["timeout"] <= 3


def launcher_environment() -> dict[str, str]:
    return {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("DARROW_LANGFUSE_")
    }


def host_command(command: dict[str, Any], shell: str | None) -> str | list[str]:
    field = "commandWindows" if os.name == "nt" else "command"
    registered = command[field]
    assert isinstance(registered, str)
    expanded = registered.replace("${PLUGIN_ROOT}", str(PLUGIN))
    if os.name == "nt":
        return expanded
    assert shell is not None
    return [shell, "-c", expanded]


@pytest.mark.parametrize("shell", [None] if os.name == "nt" else ["bash", "/bin/bash"])
def test_disabled_packaged_command(shell: str | None) -> None:
    subprocess.run(
        host_command(handlers("Stop")[0], shell),
        input="{}\n",
        text=True,
        check=True,
        capture_output=True,
        shell=os.name == "nt",
        env={
            **launcher_environment(),
            "PLUGIN_ROOT": str(PLUGIN),
            "DARROW_LANGFUSE_ENABLED": "false",
        },
    )


@pytest.mark.parametrize("shell", [None] if os.name == "nt" else ["bash", "/bin/bash"])
def test_stop_reconstructs_trace(shell: str | None) -> None:
    payload = {
        "session_id": "session-main",
        "turn_id": "turn-1",
        "cwd": str(PLUGIN.parents[2]),
        "transcript_path": str(PLUGIN / "tests/fixtures/main-rollout.jsonl"),
        "hook_event_name": "Stop",
    }
    result = subprocess.run(
        host_command(handlers("Stop")[0], shell),
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=True,
        shell=os.name == "nt",
        env={
            **launcher_environment(),
            "CODEX_PLUGIN_ROOT": str(PLUGIN),
            "DARROW_LANGFUSE_ENABLED": "true",
            "DARROW_LANGFUSE_CAPTURE_CONTENT": "true",
            "DARROW_LANGFUSE_DRY_RUN": "true",
            "DARROW_LANGFUSE_STRICT": "true",
            "DARROW_LANGFUSE_WORK_ITEM_ID": "EXT-7",
        },
    )
    document = json.loads(result.stdout)
    assert document["status"] == "dry-run"
    assert len(document["traces"]) == 1
    trace = document["traces"][0]
    assert trace["name"] == "Codex Turn"
    assert trace["session_id"] == "session-main:attribution:0"
    assert trace["metadata"]["codex.thread_id"] == "session-main"
    assert trace["metadata"]["darrow.work_item_id"] == "EXT-7"
    assert trace["metadata"]["darrow.attribution_source"] == "configuration"
    assert trace["metadata"]["darrow.attribution_epoch"] == trace["session_id"]
    assert trace["input"] == "Inspect the repository"
    assert "README.md" in trace["output"]
    generation = next(o for o in trace["observations"] if o["type"] == "generation")
    assert generation["model"] == "gpt-5.6-sol"
    assert generation["usage_details"]["total_tokens"] == 120
    tool = next(o for o in generation["children"] if o["type"] == "tool")
    assert tool["name"] == "rg --files"
    assert tool["output"] == "README.md\npackage.json"
    agent = next(
        o
        for o in trace["observations"]
        if o["type"] == "agent" and o["name"] == "Codex Subagent Turn"
    )
    assert agent["session_id"] == "child-1"
    assert any(
        o["type"] == "generation" and o["model"] == "gpt-5.6-luna"
        for o in agent["children"]
    )
