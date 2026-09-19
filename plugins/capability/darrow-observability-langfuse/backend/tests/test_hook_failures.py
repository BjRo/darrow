"""Failure and configuration contracts through each native host launcher."""

import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parents[2]


@dataclass
class Hook:
    command: list[str]
    root: Path
    project: Path
    home: Path
    environment: dict[str, str]

    def run(
        self, *args: str, payload: str | None = None, **environment: str
    ) -> subprocess.CompletedProcess[str]:
        document = {
            "session_id": "test",
            "turn_id": "0",
            "hook_event_name": "Stop",
            "cwd": str(self.project),
            "transcript_path": str(self.root / "missing.jsonl"),
        }
        return subprocess.run(
            [*self.command, *args],
            input=json.dumps(document) if payload is None else payload,
            text=True,
            capture_output=True,
            check=False,
            cwd=self.project,
            env={**self.environment, **environment},
            timeout=60,
        )

    def configure(self, directory: Path) -> None:
        (directory / ".codex/darrow-langfuse.json").write_text(
            json.dumps({"enabled": True, "strict": True}),
            encoding="utf-8",
        )

    def path_without_uv(self) -> str:
        directory = self.root / "without uv"
        directory.mkdir(exist_ok=True)
        if os.name != "nt":
            for name in ("dirname", "tr", "sed"):
                executable = shutil.which(name)
                assert executable is not None
                destination = directory / name
                if not destination.exists():
                    destination.symlink_to(executable)
        return str(directory)


@pytest.fixture(params=[None] if os.name == "nt" else ["bash", "/bin/bash"])
def hook(request: pytest.FixtureRequest, tmp_path: Path) -> Hook:
    if os.name == "nt":
        powershell = shutil.which("powershell.exe")
        assert powershell is not None
        command = [
            powershell,
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(PLUGIN / "hooks/stop.ps1"),
        ]
    else:
        shell = shutil.which(str(request.param))
        assert shell is not None
        command = [shell, str(PLUGIN / "hooks/stop.sh")]
    project, home = tmp_path / "project", tmp_path / "home"
    for directory in (project, home):
        (directory / ".codex").mkdir(parents=True)
    environment = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(
            ("DARROW_LANGFUSE_", "LANGFUSE_", "OTEL_", "UV_", "CODEX_")
        )
    }
    environment.update(
        {"HOME": str(home), "UV_OFFLINE": "1", "CODEX_PLUGIN_ROOT": str(PLUGIN)}
    )
    return Hook(command, tmp_path, project, home, environment)


@pytest.mark.parametrize("strict", [False, True])
def test_missing_uv_respects_strictness(hook: Hook, strict: bool) -> None:
    result = hook.run(
        payload="",
        PATH=hook.path_without_uv(),
        DARROW_LANGFUSE_DEBUG="true",
        DARROW_LANGFUSE_STRICT=str(strict).lower(),
    )
    assert (result.returncode != 0) == strict
    assert "uv is required but was not found" in result.stderr


def test_broken_uv_fails_open(hook: Hook) -> None:
    result = hook.run(
        payload="", UV_PROJECT_ENVIRONMENT=os.devnull, DARROW_LANGFUSE_ENABLED="false"
    )
    assert result.returncode == 0, result.stderr


def test_malformed_input_refused_in_strict_mode(hook: Hook) -> None:
    result = hook.run(payload="not-json", DARROW_LANGFUSE_STRICT="true")
    assert result.returncode != 0
    assert "hook input is not valid JSON" in result.stderr


@pytest.mark.parametrize("location", ["home", "project"])
def test_file_strict_configuration(hook: Hook, location: str) -> None:
    hook.configure(getattr(hook, location))
    result = hook.run()
    assert result.returncode != 0
    assert "Langfuse credentials are missing" in result.stderr


@pytest.mark.parametrize("strict", ["1", "true", "yes", "on", " TRUE ", " Yes "])
def test_environment_strict_values_reach_backend_and_launcher(
    hook: Hook, strict: str
) -> None:
    result = hook.run(DARROW_LANGFUSE_ENABLED="true", DARROW_LANGFUSE_STRICT=strict)
    assert result.returncode != 0
    assert "Langfuse credentials are missing" in result.stderr
    missing_uv = hook.run(
        payload="", PATH=hook.path_without_uv(), DARROW_LANGFUSE_STRICT=strict
    )
    assert missing_uv.returncode != 0
    assert "uv is required but was not found" in missing_uv.stderr


def test_environment_false_overrides_file_strictness(hook: Hook) -> None:
    hook.configure(hook.project)
    result = hook.run(DARROW_LANGFUSE_STRICT="off")
    assert result.returncode == 0, result.stderr


def test_pre_python_failure_cannot_resolve_file_strictness(hook: Hook) -> None:
    hook.configure(hook.project)
    result = hook.run(UV_PROJECT_ENVIRONMENT=os.devnull)
    assert result.returncode == 0, result.stderr


def test_capture_succeeds_and_strict_export_failure_redacts_secret(hook: Hook) -> None:
    fixtures = PLUGIN / "tests/fixtures"
    rollout = hook.project / "rollout.jsonl"
    shutil.copyfile(fixtures / "main-rollout.jsonl", rollout)
    shutil.copyfile(
        fixtures / "rollout-2026-08-24-child-1.jsonl",
        hook.project / "rollout-2026-08-24-child-1.jsonl",
    )
    hook.configure(hook.project)
    payload = json.dumps(
        {
            "session_id": "session-main",
            "turn_id": "turn-1",
            "cwd": str(hook.project),
            "transcript_path": str(rollout),
            "hook_event_name": "Stop",
        }
    )
    environment = {
        "DARROW_LANGFUSE_ENABLED": "true",
        "DARROW_LANGFUSE_CAPTURE_CONTENT": "false",
        "LANGFUSE_PUBLIC_KEY": "pk-test-not-secret",
        "LANGFUSE_SECRET_KEY": "sk-must-never-appear",
        "LANGFUSE_BASE_URL": "http://127.0.0.1:1",
    }
    capture = hook.run(payload=payload, **environment)
    assert capture.returncode == 0, capture.stderr
    drain = hook.run("--drain", payload=payload, **environment)
    assert drain.returncode != 0
    assert "darrow-langfuse:" in drain.stderr
    assert environment["LANGFUSE_SECRET_KEY"] not in drain.stderr
