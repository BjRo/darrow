"""The public Codex SessionStart hook binds read intent to the host catalog."""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
from pathlib import Path

import pytest


def hook_invocation(plugin: Path, host: str) -> list[str]:
    manifest = json.loads((plugin / ".codex-plugin/plugin.json").read_text())
    hooks = json.loads((plugin / manifest["hooks"]).read_text())
    descriptor = hooks["hooks"]["SessionStart"][0]["hooks"][0]
    field = "command" if host == "bash" else "commandWindows"
    arguments = shlex.split(descriptor[field].replace("${PLUGIN_ROOT}", str(plugin)))
    executable = (
        shutil.which("bash")
        if host == "bash"
        else (shutil.which("pwsh") or shutil.which("powershell.exe"))
    )
    if executable is None:
        pytest.skip(f"{host} is not installed")
    arguments[0] = executable
    return arguments


def trap_provider(directory: Path, name: str) -> None:
    script = directory / name
    script.write_text(
        '#!/bin/sh\nprintf unexpected >>"$DARROW_HOOK_UNEXPECTED_TOOL"\nexit 99\n'
    )
    script.chmod(0o755)
    (directory / f"{name}.cmd").write_text(
        '@echo unexpected>>"%DARROW_HOOK_UNEXPECTED_TOOL%"\r\n@exit /b 99\r\n'
    )


def snapshot(directory: Path) -> dict[Path, bytes]:
    return {
        path.relative_to(directory): path.read_bytes()
        for path in directory.rglob("*")
        if path.is_file()
    }


@pytest.fixture
def installed_plugin(tmp_path: Path) -> Path:
    source = Path(__file__).resolve().parents[2]
    manifest = json.loads((source / ".codex-plugin/plugin.json").read_text())
    assert manifest.get("hooks"), "Codex read-ticket discovery hook is not registered"
    plugin = tmp_path / "plugin with ' quotes"
    shutil.copytree(source / ".codex-plugin", plugin / ".codex-plugin")
    shutil.copytree(source / "hooks", plugin / "hooks")
    skill = plugin / "skills/read-ticket/SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("Complete read skill fixture.\n")
    return plugin


@pytest.mark.parametrize("host", ["bash", "powershell"])
def test_session_start_uses_catalog_binding(
    tmp_path: Path, installed_plugin: Path, host: str
) -> None:
    plugin = installed_plugin
    skill = plugin / "skills/read-ticket/SKILL.md"
    invocation = hook_invocation(plugin, host)
    working = tmp_path / "another repository"
    working.mkdir()
    (working / "README.md").write_text("Unrelated repository.\n")
    binaries = tmp_path / "bin"
    binaries.mkdir()
    for name in ("git", "gh", "uv"):
        trap_provider(binaries, name)
    receipt = tmp_path / "unexpected-provider"
    environment = {
        **os.environ,
        "PATH": str(binaries) + os.pathsep + os.environ["PATH"],
        "DARROW_HOOK_UNEXPECTED_TOOL": str(receipt),
    }
    before = snapshot(tmp_path)
    result = subprocess.run(
        invocation,
        cwd=working,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert str(plugin) not in result.stdout, (
        "hook execution copies are not skill locations"
    )
    assert "DARROW_READ_TICKET_SKILL_PATH_V1:" not in result.stdout
    assert "DARROW_READ_TICKET_SESSION_HINT_V1:" in result.stdout
    assert "darrow-tickets:read-ticket" in result.stdout
    assert skill.read_text() not in result.stdout
    assert not result.stderr
    assert not receipt.exists()
    assert snapshot(tmp_path) == before
