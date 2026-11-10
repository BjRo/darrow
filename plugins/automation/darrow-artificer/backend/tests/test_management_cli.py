"""Retained management and publication boundaries through the local command."""

import json
import plistlib
import shutil
import subprocess
import time
from pathlib import Path

import pytest

from darrow_artificer import processes
from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation
from test_worker_cli import invoke, wait_stopped
from test_worker_cli import repository as repository
from test_worker_cli import services as services


def initialize(
    repository: Path,
    state: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    host: str = "claude",
) -> Installation:
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
        "--authorize-recurring-delivery",
    )
    return Installation(state)


def test_open_artificer_pr_holds_wip_until_closed(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys, host="codex")
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.status == "pr-open"
    forge = json.loads((services / "forge.json").read_text())
    forge["ready"] = [2]
    (services / "forge.json").write_text(json.dumps(forge))
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []
    forge["pr"]["state"] = "closed"
    (services / "forge.json").write_text(json.dumps(forge))
    admitted = invoke(monkeypatch, capsys, state, "tick")["admitted"]
    assert admitted
    assert site.claim(claim.id).status == "released"
    new = next(item for item in site.claims() if item.id != claim.id)
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and processes.alive(site.claim(new.id).process):
        time.sleep(0.02)
    assert not processes.alive(site.claim(new.id).process)


def test_cancel_preserves_effects_and_does_not_duplicate_reports(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    before = json.loads((services / "forge.json").read_text())["comments"]
    observed = invoke(monkeypatch, capsys, state, "cancel", claim.id)
    assert observed["status"] == "cancelled"
    assert Path(claim.worktree).is_dir()
    assert json.loads((services / "forge.json").read_text())["comments"] == before
    invoke(monkeypatch, capsys, state, "tick")
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, "cancel", claim.id)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch, capsys, state, "recover", claim.id, "--thread", "replacement"
        )


def test_failed_cancellation_is_visible(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)

    def denied(process: object) -> None:
        raise OSError("Process observation unavailable")

    monkeypatch.setattr(processes, "cancel_process", denied)
    observed = invoke(monkeypatch, capsys, state, "cancel", claim.id)
    assert observed["status"] == "needs-attention"
    assert "not confirmed" in str(observed["detail"])


def test_recovery_refuses_replacement_and_revoked_authority(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.native is not None
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch, capsys, state, "recover", claim.id, "--thread", "replacement"
        )
    invoke(monkeypatch, capsys, state, "revoke")
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            state,
            "recover",
            claim.id,
            "--thread",
            claim.native.thread,
        )


def test_revoked_grantor_cannot_admit(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    initialize(repository, state, monkeypatch, capsys)
    monkeypatch.setattr(GitHub, "writable", lambda *args: False)
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, "tick")
    assert "no longer" in capsys.readouterr().err


def test_schedule_requires_uv(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    initialize(repository, state, monkeypatch, capsys)
    monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, "schedule")
    assert "UV is required" in capsys.readouterr().err


@pytest.mark.parametrize("cause", ["host", "legacy", "origin", "git"])
def test_setup_refuses_conflicting_or_unavailable_inputs(
    repository: Path,
    tmp_path: Path,
    cause: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    initialize(repository, state, monkeypatch, capsys)
    host = "codex" if cause == "host" else "claude"
    if cause == "legacy":
        (repository / ".git/artificer/installation.json").write_text("{}")
    if cause == "origin":
        subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "remote",
                "set-url",
                "origin",
                "https://github.com/wrong/repo.git",
            ],
            check=True,
        )
    if cause == "git":
        monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(SystemExit):
        invoke(
            monkeypatch,
            capsys,
            tmp_path / "other",
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            host,
            "--authorize-recurring-delivery",
        )
    assert not (tmp_path / "other/grant.json").exists()


def test_schedule_preserves_existing_profile_locations(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    site = initialize(repository, state, monkeypatch, capsys)
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / "codex-profile"))
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path / "claude-profile"))
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda command, **kwargs: subprocess.CompletedProcess(command, 0, "", ""),
    )
    invoke(monkeypatch, capsys, state, "schedule")
    path = (
        tmp_path
        / "Library/LaunchAgents"
        / f"com.darrow.artificer.{site.grant.id}.plist"
    )
    definition = plistlib.loads(path.read_bytes())
    assert definition["EnvironmentVariables"]["CODEX_HOME"] == str(
        tmp_path / "codex-profile"
    )
    assert definition["EnvironmentVariables"]["CLAUDE_CONFIG_DIR"] == str(
        tmp_path / "claude-profile"
    )
