"""Session context supplies discovery without repository or provider effects."""

import json
import shlex
import subprocess
from pathlib import Path

import pytest


def test_session_command_descriptor_preserves_the_installed_path() -> None:
    source = Path(__file__).resolve().parents[2]
    hooks = json.loads((source / ".claude-plugin/hooks.json").read_text())
    handler = hooks["hooks"]["SessionStart"][0]["hooks"][0]
    assert "args" not in handler, "native hooks require a complete command string"
    plugin = "/installed/plugin with ' quotes"
    arguments = shlex.split(handler["command"].replace("${CLAUDE_PLUGIN_ROOT}", plugin))
    assert arguments == [
        "uv",
        "run",
        "--quiet",
        "--no-project",
        plugin + "/backend/scripts/run_locked.py",
        "darrow-tickets-claude-context",
    ]


def test_session_context_is_nonmutating(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    from darrow_tickets.claude_context import main

    def unexpected_provider(*args: object, **kwargs: object) -> None:
        pytest.fail("context hook attempted a subprocess")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(subprocess, "run", unexpected_provider)
    main()
    output = capsys.readouterr()
    payload = json.loads(output.out)
    assert set(payload) == {"hookSpecificOutput"}
    context = payload["hookSpecificOutput"]
    assert set(context) == {"hookEventName", "additionalContext"}
    assert context["hookEventName"] == "SessionStart"
    assert isinstance(context["additionalContext"], str)
    assert context["additionalContext"].strip()
    assert not output.err
    assert list(tmp_path.iterdir()) == []
