"""Acceptance through the documented CLI; only external services are substituted."""

import json
import os
import shlex
import subprocess
import sys
import time
from pathlib import Path

import pytest

from darrow_artificer import cli, processes, setup
from darrow_artificer.github import GitHub, array_value
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim

COLLECTION = GitHub.collection
LOGIN = GitHub.login
WRITABLE = GitHub.writable


def test_codex_accepts_strict_native_result_schema(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_STRICT_SCHEMA", "1")
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert "Specification needed" in wait_stopped(Installation(state)).detail


def invoke(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    state: Path,
    *arguments: str,
) -> dict[str, object]:
    monkeypatch.setattr(
        sys, "argv", ["darrow-artificer", "--state", str(state), *arguments]
    )
    cli.entrypoint()
    result: dict[str, object] = json.loads(capsys.readouterr().out)
    return result


@pytest.fixture
def repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    original_executable = setup.executable
    monkeypatch.setattr(
        setup,
        "executable",
        lambda name: (
            "/usr/bin/true"
            if name in {"codex", "claude", "gh"}
            else original_executable(name)
        ),
    )
    path = tmp_path / "repository"
    subprocess.run(["git", "init", "-q", "-b", "main", str(path)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(path),
            "remote",
            "add",
            "origin",
            "https://github.com/o/r.git",
        ],
        check=True,
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(path),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "initial",
        ],
        check=True,
    )
    remote = tmp_path / "origin.git"
    subprocess.run(
        ["git", "init", "--bare", "-q", "-b", "main", str(remote)], check=True
    )
    subprocess.run(
        ["git", "-C", str(path), "push", "-q", str(remote), "HEAD:refs/heads/main"],
        check=True,
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(path),
            "config",
            f"url.{remote}.insteadOf",
            "https://github.com/o/r.git",
        ],
        check=True,
    )
    monkeypatch.setattr(GitHub, "login", lambda self: "writer")
    monkeypatch.setattr(GitHub, "writable", lambda *args: True)
    monkeypatch.setattr(
        GitHub,
        "collection",
        lambda *args: [{"name": "artificer:ready"}, {"name": "artificer:claimed"}],
    )
    return path


def test_workers_share_repository_capacity(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    for name in ("first", "second"):
        invoke(
            monkeypatch,
            capsys,
            tmp_path / name,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "codex",
            "--authorize-recurring-delivery",
        )
    invoke(
        monkeypatch,
        capsys,
        tmp_path / "first",
        "configure",
        "--WORK_IN_PROGRESS_LIMIT",
        "3",
    )
    observed = invoke(monkeypatch, capsys, tmp_path / "second", "status")
    assert observed["WORK_IN_PROGRESS_LIMIT"] == 3


def test_tick_runs_one_ticket_per_worker_with_shared_claims(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    for name in ("first", "second", "third"):
        invoke(
            monkeypatch,
            capsys,
            tmp_path / name,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--authorize-recurring-delivery",
        )
    invoke(
        monkeypatch,
        capsys,
        tmp_path / "first",
        "configure",
        "--WORK_IN_PROGRESS_LIMIT",
        "2",
    )
    ready = [1, 2, 3]
    claimed: list[int] = []
    monkeypatch.setattr(
        GitHub,
        "issues",
        lambda self, label, state: [
            {"number": n} for n in (ready if label == "artificer:ready" else claimed)
        ],
    )
    monkeypatch.setattr(GitHub, "nominated", lambda *args: True)
    monkeypatch.setattr(GitHub, "unblocked", lambda *args: True)

    def reserve(self: GitHub, issue: int, correlation: str) -> None:
        ready.remove(issue)
        claimed.append(issue)

    def launch(site: Installation, claim: Claim) -> None:
        claim.status = "running"
        claim.process = processes.identity(os.getpid())
        site.save(claim)

    monkeypatch.setattr(GitHub, "reserve", reserve)
    monkeypatch.setattr(processes, "launch", launch)
    first = invoke(monkeypatch, capsys, tmp_path / "first", "tick")
    assert len(array_value(first["admitted"])) == 1
    assert invoke(monkeypatch, capsys, tmp_path / "first", "tick")["admitted"] == []
    assert (
        len(
            array_value(
                invoke(monkeypatch, capsys, tmp_path / "second", "tick")["admitted"]
            )
        )
        == 1
    )
    claimed.clear()  # Missing labels must not discard another worker's reservation.
    assert invoke(monkeypatch, capsys, tmp_path / "third", "tick")["admitted"] == []
    assert ready == [3]


@pytest.fixture
def services(repository: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(GitHub, "collection", COLLECTION)
    monkeypatch.setattr(GitHub, "login", LOGIN)
    monkeypatch.setattr(GitHub, "writable", WRITABLE)
    path = tmp_path / "services"
    path.mkdir()
    (path / "forge.json").write_text(
        json.dumps({"ready": [1], "claimed": [], "comments": [], "pr": None})
    )
    sources = path / "python"
    sources.mkdir()
    for name in ("gh", "codex", "claude"):
        script = sources / name
        script.write_text(Path(__file__).with_name("service_stub.py").read_text())
        executable = path / name
        executable.write_text(
            "#!/bin/sh\nunset COVERAGE_PROCESS_CONFIG COVERAGE_PROCESS_START\nexec "
            + shlex.quote(sys.executable)
            + " "
            + shlex.quote(str(script))
            + ' "$@"\n'
        )
        executable.chmod(0o700)
    original = setup.executable
    monkeypatch.setattr(
        setup,
        "executable",
        lambda name: (
            str(path / name) if name in {"gh", "codex", "claude"} else original(name)
        ),
    )
    monkeypatch.setenv("ARTIFICER_TEST_STATE", str(path))
    return path


def wait_stopped(site: Installation) -> Claim:
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        claims = site.claims()
        if (
            claims
            and claims[0].status not in {"reserved", "running"}
            and not processes.alive(claims[0].process)
        ):
            return claims[0]
        time.sleep(0.02)
    raise AssertionError("Worker did not report a terminal outcome")


def test_claude_delivery_uses_native_profile(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "initial",
        ],
        check=True,
    )
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.detail == "Specification needed; profile inherited"
    assert claim.native is not None
    assert claim.native.thread == (services / "session.txt").read_text()
    assert not (Installation(state).delivery_dir(claim.id) / "native").exists()


def test_codex_delivery_uses_native_profile(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "initial",
        ],
        check=True,
    )
    state = tmp_path / "worker"
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
        "codex",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.detail == "Specification needed; profile inherited"
    assert claim.native is not None
    assert claim.native.thread == (services / "session.txt").read_text()
    assert not (Installation(state).delivery_dir(claim.id) / "native").exists()


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_delivery_requires_core_but_not_optional_plugins(
    repository: Path,
    services: Path,
    tmp_path: Path,
    host: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_MISSING_CORE", "1")
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "initial",
        ],
        check=True,
    )
    state = tmp_path / "worker"
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
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert "Missing required session capabilities: code-review" in claim.detail


@pytest.mark.parametrize("base", ["main", "master"])
def test_new_delivery_starts_from_latest_main(
    repository: Path,
    services: Path,
    tmp_path: Path,
    base: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def git(*args: str) -> str:
        return subprocess.check_output(
            [
                "git",
                "-C",
                str(repository),
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                *args,
            ],
            text=True,
        ).strip()

    git("commit", "--allow-empty", "-qm", "old")
    old = git("rev-parse", "HEAD")
    git("branch", "-M", base)
    git("commit", "--allow-empty", "-qm", "latest")
    latest = git("rev-parse", "HEAD")
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", "-q", "-b", base, str(remote)], check=True)
    git("push", "-q", str(remote), f"HEAD:refs/heads/{base}")
    git("checkout", "-qb", "unrelated-work", old)
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    git("config", "--remove-section", f"url.{tmp_path / 'origin.git'}")
    git("config", f"url.{remote}.insteadOf", "https://github.com/o/r.git")
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.native is not None
    assert (services / "base.txt").read_text() == latest
    assert git("branch", "--show-current") == "unrelated-work"


def test_stopped_delivery_reports_blocker_on_source_issue(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    forge = json.loads((services / "forge.json").read_text())
    assert any(
        "Specification needed" in comment and "Next action:" in comment
        for comment in forge["comments"]
    )
    assert claim.detail == "Specification needed; profile inherited"


def test_stopped_delivery_without_pr_releases_capacity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    site = Installation(state)
    claim = wait_stopped(site)
    invoke(monkeypatch, capsys, state, "tick")
    observed = site.claim(claim.id)
    assert observed.status == "released"
    assert observed.detail == "Specification needed; profile inherited"
    assert json.loads((services / "forge.json").read_text())["claimed"] == []


def test_ambiguous_launch_keeps_reservation(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )

    def ambiguous(site: Installation, claim: Claim) -> None:
        raise OSError("Launch acknowledgement lost")

    monkeypatch.setattr(processes, "launch", ambiguous)
    first = invoke(monkeypatch, capsys, state, "tick")["admitted"]
    invoke(monkeypatch, capsys, state, "tick")
    site = Installation(state)
    assert first
    assert site.claims()[0].status == "needs-attention"
    assert json.loads((services / "forge.json").read_text())["claimed"] == [1]


def test_delivery_rejects_unrelated_pr_result(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_WRONG_PR", "1")
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.status == "needs-attention"
    assert "PR does not match" in claim.detail


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("failures", [2, 3])
def test_native_recovery_is_bounded_and_preserves_identity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    host: str,
    failures: int,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (services / "interruptions.json").write_text(
        json.dumps({"failures": failures, "starts": []})
    )
    state = tmp_path / "worker"
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
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    starts = json.loads((services / "interruptions.json").read_text())["starts"]
    assert len(starts) == 3
    assert len({item["identity"] for item in starts}) == 1
    assert [item["resuming"] for item in starts] == [False, True, True]
    assert claim.total_recovery_attempts == 2
    assert ("Specification needed" in claim.detail) == (failures == 2)


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_successful_native_progress_resets_interruption_budget(
    host: str,
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (services / "interruptions.json").write_text(
        json.dumps({"failures": 3, "starts": [], "progress_on": 2})
    )
    state = tmp_path / "worker"
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
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.total_recovery_attempts == 3
    assert "Specification needed" in claim.detail


def test_explicit_recovery_resumes_original_native_session(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    site = Installation(state)
    claim = wait_stopped(site)
    assert claim.native is not None
    original = claim.native.thread
    invoke(monkeypatch, capsys, state, "recover", claim.id, "--thread", original)
    observed = wait_stopped(site)
    assert observed.native is not None and observed.native.thread == original
    assert (services / "session.txt").read_text() == original


@pytest.mark.parametrize("value", ["2", True, -1])
def test_status_refuses_invalid_shared_capacity(
    repository: Path,
    tmp_path: Path,
    value: object,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    shared = repository / ".git/artificer/repository.json"
    values = json.loads(shared.read_text())
    values["WORK_IN_PROGRESS_LIMIT"] = value
    shared.write_text(json.dumps(values))
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, "status")


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_native_process_interruption_recovers_original_session(
    repository: Path,
    services: Path,
    tmp_path: Path,
    host: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_EOF", "1")
    (services / "interruptions.json").write_text(
        json.dumps({"failures": 1, "starts": []})
    )
    state = tmp_path / "worker"
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
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.total_recovery_attempts == 1
    assert "Specification needed" in claim.detail


def test_recovery_observes_existing_active_turn_without_resubmission(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_ACTIVE_RESUME", "1")
    (services / "interruptions.json").write_text(
        json.dumps({"failures": 1, "starts": []})
    )
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    requests = [
        json.loads(line)
        for line in (services / "requests.jsonl").read_text().splitlines()
    ]
    assert sum(request["method"] == "turn/start" for request in requests) == 1
    assert "Specification needed" in claim.detail


def test_management_pause_revocation_and_scheduler(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    calls: list[list[str]] = []

    def launchctl(
        command: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr(subprocess, "run", launchctl)
    invoke(monkeypatch, capsys, state, "schedule")
    destination = (
        tmp_path
        / "Library/LaunchAgents"
        / f"com.darrow.artificer.{Installation(state).grant.id}.plist"
    )
    assert destination.is_file()
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, "schedule")
    invoke(monkeypatch, capsys, state, "unschedule")
    assert not destination.exists()
    assert [command[1] for command in calls] == ["bootstrap", "bootout"]
    invoke(monkeypatch, capsys, state, "configure", "--WORK_IN_PROGRESS_LIMIT", "0")
    invoke(monkeypatch, capsys, state, "revoke")
    assert invoke(monkeypatch, capsys, state, "tick")["admitted"] == []


@pytest.mark.parametrize(
    "mutation", ["legacy", "binding", "host", "missing", "duplicate"]
)
def test_management_refuses_unreconciled_configuration(
    repository: Path,
    tmp_path: Path,
    mutation: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    grant = invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    common = repository / ".git/artificer"
    command: tuple[str, ...] = ("tick",)
    if mutation == "legacy":
        values = json.loads((state / "grant.json").read_text())
        values.pop("schema_version")
        (state / "grant.json").write_text(json.dumps(values))
    elif mutation == "binding":
        (common / "workers" / f"{grant['id']}.json").write_text("{}")
    elif mutation == "host":
        values = json.loads((common / "repository.json").read_text())
        values["host"] = "claude"
        (common / "repository.json").write_text(json.dumps(values))
    elif mutation == "missing":
        (common / "repository.json").unlink()
    else:
        command = (
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--authorize-recurring-delivery",
        )
    with pytest.raises(SystemExit):
        invoke(monkeypatch, capsys, state, *command)


def test_headless_claude_uses_native_goal_entry(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_REQUIRE_GOAL", "1")
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert "Specification needed" in wait_stopped(Installation(state)).detail
    trace = json.loads((services / "goal-handshake.json").read_text())
    assert len(trace) == 2
    assert [item["resuming"] for item in trace] == [False, True]
    assert len({item["identity"] for item in trace}) == 1


def test_codex_inherits_profile_with_default_effort(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_DEFAULT_EFFORT", "1")
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert "Specification needed" in wait_stopped(Installation(state)).detail


def test_init_uses_existing_host_configuration(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    result = invoke(
        monkeypatch,
        capsys,
        tmp_path / "worker",
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "claude",
        "--authorize-recurring-delivery",
    )
    assert result["host"] == "claude"
    assert result["recipe"] == "ticket-to-pr"
    assert result["schema_version"] == 2
    assert not (tmp_path / "worker/archive.key").exists()
    assert not (tmp_path / "worker/native").exists()


def test_question_is_reported_as_blocker_without_reply_loop(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_QUESTION", "1")
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.status == "needs-attention"
    reports = json.loads((services / "forge.json").read_text())["comments"]
    assert any(
        "Which customer role may approve this operation?" in report
        for report in reports
    )


def test_delivery_rejects_wrong_pr_base(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_COMPLETE", "1")
    monkeypatch.setenv("ARTIFICER_WRONG_BASE", "1")
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(Installation(state))
    assert claim.status == "needs-attention"
    assert "base" in claim.detail
    assert claim.pr == 9


def test_status_identifies_worker_and_absolute_state(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
    grant = invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    observed = invoke(monkeypatch, capsys, state, "status")
    assert observed["worker"] == grant["id"]
    assert observed["state"] == str(state.resolve())


def test_worker_is_independent_of_parent_claude_session(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_TEST_NESTING", "1")
    monkeypatch.setenv("CLAUDECODE", "1")
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    assert "Specification needed" in wait_stopped(Installation(state)).detail


def test_ambiguous_native_recovery_launch_holds_capacity(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    state = tmp_path / "worker"
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
        "claude",
        "--authorize-recurring-delivery",
    )
    site = Installation(state)
    invoke(monkeypatch, capsys, state, "tick")
    claim = wait_stopped(site)
    assert claim.native is not None

    def ambiguous(site: Installation, claim: Claim) -> None:
        raise OSError("Resume acknowledgement lost")

    monkeypatch.setattr(processes, "launch", ambiguous)
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
    invoke(monkeypatch, capsys, state, "tick")
    assert site.claim(claim.id).status == "needs-attention"


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_delivery_preserves_existing_permission_profile(
    repository: Path,
    services: Path,
    tmp_path: Path,
    host: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_PROFILE_POLICY", "1")
    state = tmp_path / "worker"
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
    invoke(monkeypatch, capsys, state, "tick")
    assert "Specification needed" in wait_stopped(Installation(state)).detail


def test_operational_trace_does_not_copy_native_conversation(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("ARTIFICER_PRIVATE_HISTORY", "1")
    state = tmp_path / "worker"
    invoke(
        monkeypatch,
        capsys,
        state,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--authorize-recurring-delivery",
    )
    invoke(monkeypatch, capsys, state, "tick")
    site = Installation(state)
    claim = wait_stopped(site)
    traces = list(site.delivery_dir(claim.id).glob("*-events.jsonl"))
    assert traces
    assert all(
        "PRIVATE_NATIVE_HISTORY_CANARY" not in path.read_text() for path in traces
    )
