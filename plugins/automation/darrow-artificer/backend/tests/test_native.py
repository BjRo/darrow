import json
import subprocess
from pathlib import Path

import pytest

from darrow_artificer import native
from darrow_artificer.installation import Installation


def rollout(
    home: Path,
    thread: str,
    parent: str | None = None,
    owner: str | None = None,
    model: str = "gpt-5.6-terra",
) -> Path:
    path = home / "sessions" / f"rollout-{thread}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    metadata = {"id": thread, "parent_thread_id": parent, "agent_path": owner}
    rows = [
        {"type": "session_meta", "payload": metadata},
        {"type": "session_meta", "payload": {"id": "inherited-parent"}},
        {"type": "turn_context", "payload": {"model": model, "effort": "medium"}},
    ]
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\n")
    return path


def test_native_identity_is_main_thread_with_bounded_children(
    installation: Installation,
) -> None:
    home = installation.root / "home"
    rollout(home, "parent")
    rollout(home, "child", "parent", "/root/owner")
    receipt = native.correlate(home, "parent", installation.grant)
    assert receipt.thread == "parent"
    assert receipt.model == "gpt-5.6-terra" and receipt.effort == "medium"
    with pytest.raises(ValueError, match="main thread"):
        native.correlate(home, "child", installation.grant)


def test_missing_and_incomplete_history(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="missing"):
        native.native_thread(tmp_path, "absent")
    path = rollout(tmp_path, "empty")
    path.write_text(json.dumps({"type": "session_meta", "payload": {"id": "empty"}}))
    with pytest.raises(ValueError, match="incomplete"):
        native.native_thread(tmp_path, "empty")


def test_route_change_refused(installation: Installation) -> None:
    home = installation.root / "home"
    rollout(home, "parent", model="wrong")
    rollout(home, "child", "parent", "/root/owner")
    with pytest.raises(ValueError, match="model/effort"):
        native.correlate(home, "parent", installation.grant)


def test_parent_requires_unique_observation(tmp_path: Path) -> None:
    path = tmp_path / "events"
    path.write_text('{"type":"turn.started"}\n')
    with pytest.raises(ValueError, match="unambiguous"):
        native.thread_id(path)
    path.write_text('{"type":"thread.started","thread_id":"original"}\n\n')
    assert native.thread_id(path) == "original"


def test_no_paid_environment_fallback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for name in (
        "OPENAI_API_KEY",
        "CODEX_API_KEY",
        "OPENAI_BASE_URL",
        "AWS_ACCESS_KEY_ID",
        "AZURE_OPENAI_API_KEY",
        "CODEX_HOME",
    ):
        monkeypatch.setenv(name, "unwanted")
    result = native.environment(tmp_path)
    assert result["CODEX_HOME"] == str(tmp_path)
    assert "unwanted" not in result.values()


def test_command_pins_parent_route_and_auth(installation: Installation) -> None:
    grant = installation.grant
    command = native.command(grant)
    assert command[:3] == [grant.codex, "app-server", "--stdio"]
    assert "--last" not in command
    assert 'forced_login_method="chatgpt"' in command
    assert 'model_provider="openai"' in command
    assert 'model="gpt-5.6-terra"' in command
    assert 'model_reasoning_effort="medium"' in command


def test_home_copies_whole_plugin_excludes_development(
    installation: Installation,
) -> None:
    grant = installation.grant
    credentials = Path(grant.credential_home)
    credentials.mkdir()
    (credentials / "auth.json").write_text("credential")
    plugin = installation.root / "plugin"
    (plugin / "backend").mkdir(parents=True)
    (plugin / ".codex-plugin").mkdir()
    (plugin / ".codex-plugin/plugin.json").write_text('{"name":"plugin"}')
    (plugin / "backend/pyproject.toml").write_text("runtime")
    (plugin / ".venv").mkdir()
    grant.plugins = [str(plugin)]
    home = installation.root / "home"
    native.prepare_home(home, grant)
    assert (home / "auth.json").is_symlink()
    assert (home / "skills/plugin/backend/pyproject.toml").read_text() == "runtime"
    assert not (home / "skills/plugin/.venv").exists()


def test_missing_login(installation: Installation) -> None:
    with pytest.raises(ValueError, match="normal Codex ChatGPT login"):
        native.prepare_home(installation.root / "home", installation.grant)


def test_cached_plugins_with_same_version_remain_independent(
    installation: Installation,
) -> None:
    grant = installation.grant
    credentials = Path(grant.credential_home)
    credentials.mkdir()
    (credentials / "auth.json").write_text("credential")
    plugins = []
    for name in ("darrow-first", "darrow-second"):
        plugin = installation.root / name / "0.1.0"
        (plugin / ".codex-plugin").mkdir(parents=True)
        (plugin / ".codex-plugin/plugin.json").write_text(json.dumps({"name": name}))
        (plugin / "runtime.txt").write_text(name)
        plugins.append(str(plugin))
    grant.plugins = plugins
    home = installation.root / "home"
    native.prepare_home(home, grant)
    for name in ("darrow-first", "darrow-second"):
        assert (home / "skills" / name / "runtime.txt").read_text() == name


def test_plugin_name_cannot_escape_native_home(tmp_path: Path) -> None:
    (tmp_path / ".codex-plugin").mkdir()
    (tmp_path / ".codex-plugin/plugin.json").write_text('{"name":"../outside"}')
    with pytest.raises(ValueError, match="plugin name"):
        native.plugin_name(tmp_path)


def test_active_goal_cannot_establish_delivery_completion(tmp_path: Path) -> None:
    evidence = tmp_path / "events"
    evidence.write_text(
        json.dumps(
            {"type": "artificer.settled", "thread_id": "root", "goal_status": "active"}
        )
        + "\n"
    )
    with pytest.raises(ValueError, match="goal completion"):
        native.require_completion(evidence, "root")


@pytest.mark.parametrize(
    "variant", ["valid", "version", "unconfirmed", "api", "expired"]
)
def test_login_gate(
    installation: Installation, monkeypatch: pytest.MonkeyPatch, variant: str
) -> None:
    grant = installation.grant
    grant.account_usage_accepted = variant != "unconfirmed"

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        if "--version" in command:
            return subprocess.CompletedProcess(
                command, 0, "wrong" if variant == "version" else native.VERSION, ""
            )
        if variant == "expired":
            raise subprocess.CalledProcessError(1, command)
        message = (
            "Logged in using API key" if variant == "api" else "Logged in using ChatGPT"
        )
        return subprocess.CompletedProcess(command, 0, "", message)

    monkeypatch.setattr(subprocess, "run", run)
    if variant == "valid":
        native.check_login(grant, installation.root)
    else:
        with pytest.raises((ValueError, subprocess.CalledProcessError)):
            native.check_login(grant, installation.root)
