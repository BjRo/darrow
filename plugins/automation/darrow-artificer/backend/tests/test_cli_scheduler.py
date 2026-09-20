import json
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from darrow_artificer import cli, operations, scheduler, setup
from darrow_artificer.installation import Installation
from test_admission import existing


def test_schedule_defaults_and_absolute_entrypoint(installation: Installation) -> None:
    result = plistlib.loads(
        scheduler.definition(installation, "/abs/uv", Path("/plugin/backend"))
    )
    assert result["StartInterval"] == 900 and result["RunAtLoad"] is False
    assert result["ProgramArguments"] == [
        "/abs/uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        "/plugin/backend",
        "darrow-artificer",
        "--state",
        str(installation.root),
        "tick",
    ]
    grant = installation.grant
    grant.SCHEDULE_SECONDS = 1800
    installation.save_grant(grant)
    assert (
        plistlib.loads(
            scheduler.definition(installation, "/abs/uv", Path("/plugin/backend"))
        )["StartInterval"]
        == 1800
    )


def test_scheduler_install_remove(
    installation: Installation, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    monkeypatch.setattr(shutil, "which", lambda name: "/usr/bin/true")
    calls: list[list[str]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr(subprocess, "run", run)
    path = scheduler.install(installation, tmp_path)
    assert path.is_file() and calls[-1][1] == "bootstrap"
    with pytest.raises(FileExistsError):
        scheduler.install(installation, tmp_path)
    scheduler.remove(installation)
    assert not path.exists() and calls[-1][1] == "bootout"
    monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(ValueError, match="UV"):
        scheduler.install(installation, tmp_path)


def test_status_and_configuration(
    installation: Installation,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    claim = existing(installation, 157)
    monkeypatch.setattr(
        sys, "argv", ["darrow-artificer", "--state", str(installation.root), "status"]
    )
    cli.entrypoint()
    result = json.loads(capsys.readouterr().out)
    assert result["deliveries"][0]["issue"] == 157
    assert result["deliveries"][0]["id"] == claim.id
    args = cli.parser().parse_args(
        [
            "--state",
            str(installation.root),
            "configure",
            "--WORK_IN_PROGRESS_LIMIT",
            "0",
        ]
    )
    cli.dispatch(installation, args)
    assert installation.grant.WORK_IN_PROGRESS_LIMIT == 0
    args.WORK_IN_PROGRESS_LIMIT = -1
    with pytest.raises(ValueError):
        cli.configure(installation, args)
    assert installation.grant.WORK_IN_PROGRESS_LIMIT == 0


def test_cli_failure_is_visible(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        sys, "argv", ["darrow-artificer", "--state", str(tmp_path), "status"]
    )
    with pytest.raises(SystemExit) as failure:
        cli.entrypoint()
    assert failure.value.code == 1
    assert "needs attention" in capsys.readouterr().err


def test_explicit_init_flags_required() -> None:
    with pytest.raises(SystemExit):
        cli.parser().parse_args(
            [
                "--state",
                "/tmp/example",
                "init",
                "--repository",
                "o/r",
                "--checkout",
                "/tmp",
                "--plugin",
                "/plugin",
            ]
        )


def test_other_dispatches(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(operations, "tick", lambda site: [])
    monkeypatch.setattr(operations, "revoke", lambda site: None)
    claim = existing(installation, 1)
    monkeypatch.setattr(operations, "cancel", lambda site, delivery: claim)
    monkeypatch.setattr(operations, "recover", lambda *args: claim)
    monkeypatch.setattr(scheduler, "install", lambda *args: Path("/schedule"))
    monkeypatch.setattr(scheduler, "remove", lambda site: None)
    commands = [
        ["tick"],
        ["revoke"],
        ["cancel", claim.id],
        ["recover", claim.id, "--parent", "p", "--owner", "o"],
        ["schedule"],
        ["unschedule"],
    ]
    for command in commands:
        args = cli.parser().parse_args(["--state", str(installation.root), *command])
        cli.dispatch(installation, args)


def test_init_dispatch(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(setup, "initialize", lambda *args: installation.grant)
    monkeypatch.setattr(setup, "labels", lambda site: None)
    args = cli.parser().parse_args(
        [
            "--state",
            str(installation.root),
            "init",
            "--repository",
            "o/r",
            "--checkout",
            "/tmp",
            "--plugin",
            "/plugin",
            "--authorize-recurring-delivery",
            "--confirm-no-paid-credits-or-auto-reload",
        ]
    )
    assert cli.dispatch(installation, args) == installation.grant.model_dump()
