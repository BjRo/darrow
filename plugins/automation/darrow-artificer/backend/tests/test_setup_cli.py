"""Repository installation contract through the real executable and filesystem."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from test_worker_cli import repository as repository
from test_worker_cli import services as services


def run(
    checkout: Path, *arguments: str, input: str | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(Path(sys.executable).with_name("darrow-artificer")), *arguments],
        cwd=checkout,
        text=True,
        input=input,
        capture_output=True,
        check=False,
    )


@pytest.fixture
def home(tmp_path: Path, services: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("PATH", f"{services}:{os.environ['PATH']}")
    return home


def test_scripted_init_discovers_one_installation_across_clones(
    repository: Path,
    home: Path,
    tmp_path: Path,
) -> None:
    initialized = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert initialized.returncode == 0, initialized.stderr
    state = home / ".darrow/artificer/o/r"
    assert (state / "grant.json").exists()
    assert not (repository / ".git/artificer").exists()
    second = tmp_path / "clone"
    subprocess.run(["git", "clone", "-q", str(repository), str(second)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(second),
            "remote",
            "set-url",
            "origin",
            "git@github.com:o/r.git",
        ],
        check=True,
    )
    status = run(second, "status")
    assert status.returncode == 0, status.stderr
    assert json.loads(status.stdout)["state"] == str(state)
    worktree = tmp_path / "linked"
    subprocess.run(
        [
            "git",
            "-C",
            str(second),
            "worktree",
            "add",
            "-q",
            "-b",
            "linked",
            str(worktree),
        ],
        check=True,
    )
    assert json.loads(run(worktree, "status").stdout)["state"] == str(state)


@pytest.mark.parametrize(
    "operation", ["tick", "status", "schedule", "revoke", "configure"]
)
def test_uninitialized_commands_refuse_without_creating_state(
    repository: Path, home: Path, operation: str
) -> None:
    result = run(repository, operation)
    assert result.returncode == 1
    assert "darrow-artificer init" in result.stderr
    assert not (home / ".darrow").exists()


@pytest.mark.parametrize(
    "arguments",
    [
        ("status",),
        ("tick",),
        ("schedule",),
        ("unschedule",),
        ("revoke",),
        ("configure",),
        ("cancel", "old"),
        ("recover", "old", "--thread", "old"),
        ("init", "--repository", "o/r", "--host", "codex"),
        ("init",),
    ],
)
def test_legacy_git_state_refuses_every_command(
    repository: Path, home: Path, arguments: tuple[str, ...]
) -> None:
    legacy = repository / ".git/artificer"
    legacy.mkdir()
    (legacy / "retained").write_text("do not migrate")
    if arguments[0] == "init":
        arguments += ("--checkout", str(repository))
    result = run(repository, *arguments)
    assert result.returncode == 1
    assert "Remove" in result.stderr and str(legacy) in result.stderr
    assert "darrow-artificer init" in result.stderr
    assert (legacy / "retained").read_text() == "do not migrate"
    assert not (home / ".darrow").exists()


def test_explicit_state_is_discovered_and_cannot_create_a_second_installation(
    repository: Path, home: Path, tmp_path: Path
) -> None:
    state = tmp_path / "outside"
    result = run(
        repository,
        "--state",
        str(state),
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "claude",
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(run(repository, "status").stdout)["state"] == str(state)
    other = tmp_path / "other"
    result = run(
        repository,
        "--state",
        str(other),
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 1 and "already" in result.stderr
    assert not other.exists()


def test_scripted_init_lists_missing_flags_without_waiting(
    repository: Path, home: Path
) -> None:
    result = run(repository, "init", input="")
    assert result.returncode == 1
    assert all(
        flag in result.stderr for flag in ("--repository", "--checkout", "--host")
    )
    assert not (home / ".darrow").exists()
    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        input="",
    )
    assert result.returncode == 1 and "--host" in result.stderr
    assert not (home / ".darrow").exists()


@pytest.mark.parametrize(
    "host, variable", [("codex", "CODEX_HOME"), ("claude", "CLAUDE_CONFIG_DIR")]
)
@pytest.mark.parametrize("explicit", [False, True])
def test_profile_defaults_ignore_ambient_overrides(
    repository: Path,
    services: Path,
    home: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
    variable: str,
    explicit: bool,
) -> None:
    monkeypatch.setenv(variable, str(tmp_path / "ambient"))
    profile = tmp_path / "chosen-profile" if explicit else home / f".{host}"
    arguments = [
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
    ]
    if explicit:
        profile.mkdir()
        arguments += ["--profile-dir", str(profile)]
    result = run(repository, *arguments)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["profile_dir"] == str(profile)
    assert json.loads(run(repository, "status").stdout)["profile_dir"] == str(profile)
    from darrow_artificer.installation import Installation
    from test_worker_cli import wait_stopped

    assert run(repository, "tick").returncode == 0
    site = Installation(home / ".darrow/artificer/o/r")
    claim = wait_stopped(site)
    assert claim.native is not None
    listing = json.loads(
        (services / "plugin-listings.jsonl").read_text().splitlines()[0]
    )
    assert listing[variable] == str(profile)
    assert listing["cwd"] == str(repository)
    launches = [
        json.loads(line)
        for line in (services / "profiles.jsonl").read_text().splitlines()
    ]
    assert launches and all(launch[variable] == str(profile) for launch in launches)
    result = run(repository, "recover", claim.id, "--thread", claim.native.thread)
    assert result.returncode == 0, result.stderr
    wait_stopped(site)
    launches = [
        json.loads(line)
        for line in (services / "profiles.jsonl").read_text().splitlines()
    ]
    assert len(launches) >= 2 and all(
        launch[variable] == str(profile) for launch in launches
    )


@pytest.mark.parametrize("confirmation", ["y", "n"])
@pytest.mark.parametrize("origin", ["o/r", "O/R"])
def test_guided_init_previews_and_confirms_before_saving(
    repository: Path, home: Path, confirmation: str, origin: str
) -> None:
    import pty

    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "remote",
            "set-url",
            "origin",
            f"https://github.com/{origin}.git",
        ],
        check=True,
    )
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            [str(Path(sys.executable).with_name("darrow-artificer")), "init"],
            cwd=repository,
            stdin=slave,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, f"\n\ncodex\n{confirmation}\n".encode())
            output, errors = child.communicate(timeout=10)
        assert all(
            label in output
            for label in ("Repository", "Host", "Profile", "Workers", "WIP", "State")
        ), output + errors
        assert "unattended" in output
        state = home / ".darrow/artificer/o/r"
        assert (state / "grant.json").exists() == (confirmation == "y")
        assert child.returncode == (0 if confirmation == "y" else 1)
    finally:
        os.close(master)
        os.close(slave)


def test_one_tick_fills_free_pool_slots_up_to_wip(
    repository: Path, home: Path, services: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import time

    from darrow_artificer import processes
    from darrow_artificer.installation import Installation

    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 0, result.stderr
    configured = run(
        repository, "configure", "--workers", "3", "--WORK_IN_PROGRESS_LIMIT", "2"
    )
    assert configured.returncode == 0, configured.stderr
    path = services / "forge.json"
    forge = json.loads(path.read_text())
    forge["ready"] = [1, 2, 3, 4]
    path.write_text(json.dumps(forge))
    monkeypatch.setenv("ARTIFICER_HOLD", "1")
    site = Installation(home / ".darrow/artificer/o/r")
    try:
        tick = run(repository, "tick")
        assert tick.returncode == 0, tick.stderr
        assert len(json.loads(tick.stdout)["admitted"]) == 2
        assert json.loads(run(repository, "tick").stdout)["admitted"] == []
        status = json.loads(run(repository, "status").stdout)
        assert status["workers"] == 3
        assert len(status["deliveries"]) == 2
        assert json.loads(path.read_text())["claimed"] == [1, 2]
        assert run(repository, "configure", "--workers", "1").returncode == 0
        assert len(json.loads(run(repository, "status").stdout)["deliveries"]) == 2
    finally:
        (services / "release-native").touch()
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline and any(
            processes.alive(claim.process) for claim in site.claims()
        ):
            time.sleep(0.05)
        assert not any(processes.alive(claim.process) for claim in site.claims())


@pytest.mark.parametrize("host", ["claude", "codex"])
@pytest.mark.parametrize("problem", ["missing", "disabled", "failure", "marketplace"])
def test_required_plugins_block_before_claim_and_report_host_error(
    repository: Path,
    home: Path,
    services: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
    problem: str,
) -> None:
    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
    )
    assert result.returncode == 0, result.stderr
    monkeypatch.setenv("ARTIFICER_PLUGIN_PROBLEM", problem)
    result = run(repository, "tick")
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["admitted"] == []
    status = json.loads(run(repository, "status").stdout)
    assert "plugin" in status["blocker"].lower()
    if problem in {"failure", "marketplace"}:
        assert "fixture marketplace cannot load" in status["blocker"]
    else:
        assert "darrow-ticket-to-pr" in status["blocker"]
    assert status["deliveries"] == []
    forge = json.loads((services / "forge.json").read_text())
    assert forge["ready"] == [1] and forge["claimed"] == [] and forge["comments"] == []


@pytest.mark.parametrize("host", ["codex", "claude"])
@pytest.mark.parametrize("entrypoint", ["installed", "module"])
def test_installed_wrapper_resolves_updated_plugin_and_refuses_absence(
    repository: Path,
    home: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    host: str,
    entrypoint: str,
) -> None:
    profile = tmp_path / "delivery-profile"
    profile.mkdir()
    monkeypatch.setenv(
        "CODEX_HOME" if host == "codex" else "CLAUDE_CONFIG_DIR",
        str(tmp_path / "ambient"),
    )
    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        host,
        "--profile-dir",
        str(profile),
    )
    assert result.returncode == 0, result.stderr
    wrapper = home / ".local/bin/darrow-artificer"
    assert wrapper.is_file()
    assert str(wrapper.parent) in result.stderr and "PATH" in result.stderr
    command = (
        [str(wrapper)]
        if entrypoint == "installed"
        else [sys.executable, "-m", "darrow_artificer.launcher"]
    )
    monkeypatch.setenv("UV_PYTHON", sys.executable)
    for version in ("first", "updated"):
        plugin = tmp_path / version
        launcher = plugin / "backend/scripts/run_locked.py"
        launcher.parent.mkdir(parents=True)
        launcher.write_text(f"print({version!r})\n")
        monkeypatch.setenv("ARTIFICER_PLUGIN_PATH", str(plugin))
        observed = subprocess.run(
            [*command, "status"],
            cwd=repository,
            capture_output=True,
            text=True,
            check=False,
        )
        assert observed.returncode == 0, observed.stderr
        assert observed.stdout.strip() == version
        listing = json.loads(
            (services / "plugin-listings.jsonl").read_text().splitlines()[-1]
        )
        assert listing["CODEX_HOME" if host == "codex" else "CLAUDE_CONFIG_DIR"] == str(
            home / f".{host}"
        )
        assert listing["cwd"] == str(repository)
    monkeypatch.setenv("ARTIFICER_PLUGIN_PATH", str(tmp_path / "removed"))
    observed = subprocess.run(
        [*command, "status"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    assert observed.returncode == 1 and "Artificer" in observed.stderr


def test_scheduled_tick_resolves_current_plugin(
    repository: Path,
    home: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    import plistlib

    from test_worker_cli import invoke

    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 0, result.stderr
    original_run = subprocess.run

    def external(
        command: list[str], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        if command[0] == "/bin/launchctl":
            return subprocess.CompletedProcess(command, 0, "", "")
        return original_run(command, **kwargs)  # type: ignore[call-overload,no-any-return]

    monkeypatch.setattr(subprocess, "run", external)
    state = home / ".darrow/artificer/o/r"
    monkeypatch.chdir(repository)
    invoke(monkeypatch, capsys, state, "schedule")
    files = list((home / "Library/LaunchAgents").glob("*.plist"))
    assert len(files) == 1
    definition = plistlib.loads(files[0].read_bytes())
    assert definition["ProgramArguments"][0] == str(
        home / ".local/bin/darrow-artificer"
    )
    monkeypatch.setenv("UV_PYTHON", sys.executable)
    for version in ("first", "updated"):
        plugin = tmp_path / version
        entry = plugin / "backend/scripts/run_locked.py"
        entry.parent.mkdir(parents=True)
        entry.write_text(f"print({version!r})\n")
        monkeypatch.setenv("ARTIFICER_PLUGIN_PATH", str(plugin))
        observed = original_run(
            definition["ProgramArguments"],
            cwd=definition["WorkingDirectory"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert observed.returncode == 0, observed.stderr
        assert observed.stdout.strip() == version


def test_init_rejects_state_inside_checkout(repository: Path, home: Path) -> None:
    state = repository / "private-state"
    result = run(
        repository,
        "--state",
        str(state),
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 1 and "outside" in result.stderr
    assert not state.exists()


def test_wrapper_refuses_legacy_before_resolving_plugin(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert (
        run(
            repository,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "codex",
        ).returncode
        == 0
    )
    legacy = repository / ".git/artificer"
    legacy.mkdir()
    monkeypatch.setenv("UV_PYTHON", sys.executable)
    result = subprocess.run(
        [str(home / ".local/bin/darrow-artificer"), "status"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    assert (
        result.returncode == 1
        and "Remove" in result.stderr
        and str(legacy) in result.stderr
    )


def test_init_in_linked_worktree_keeps_delivery_checkout(
    repository: Path, home: Path, tmp_path: Path
) -> None:
    linked = tmp_path / "initializing-worktree"
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "worktree",
            "add",
            "-q",
            "-b",
            "delivery-source",
            str(linked),
        ],
        check=True,
    )
    result = run(
        linked,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(linked),
        "--host",
        "codex",
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["checkout"] == str(linked)
    assert json.loads(run(repository, "status").stdout)["state"] == str(
        home / ".darrow/artificer/o/r"
    )
    assert run(linked, "tick").returncode == 0
    from darrow_artificer.installation import Installation
    from test_worker_cli import wait_stopped

    claim = wait_stopped(Installation(home / ".darrow/artificer/o/r"))
    assert Path(claim.worktree).is_relative_to(linked / ".worktrees")
    assert not (repository / ".git/artificer").exists()


@pytest.mark.parametrize(
    "listing, diagnostic",
    [
        ("not-json", "plugins"),
        ("{}", "installed list"),
        ('{"installed":[1]}', "installed list"),
        ('{"errors":["marketplace inaccessible"]}', "marketplace inaccessible"),
        ('{"installed":[{"enabled":true}]}', "identity"),
    ],
)
def test_malformed_plugin_listing_is_visible_without_claim(
    repository: Path,
    home: Path,
    services: Path,
    monkeypatch: pytest.MonkeyPatch,
    listing: str,
    diagnostic: str,
) -> None:
    assert (
        run(
            repository,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "codex",
        ).returncode
        == 0
    )
    monkeypatch.setenv("ARTIFICER_PLUGIN_LISTING", listing)
    result = run(repository, "tick")
    assert json.loads(result.stdout)["admitted"] == []
    assert diagnostic in json.loads(run(repository, "status").stdout)["blocker"]
    assert json.loads((services / "forge.json").read_text())["claimed"] == []


@pytest.mark.parametrize(
    "entry, diagnostic",
    [
        ([], "installed and enabled"),
        (
            [{"pluginId": "darrow-artificer@darrow", "enabled": False}],
            "installed and enabled",
        ),
        (
            [{"pluginId": "darrow-artificer@darrow", "enabled": True}],
            "absolute installation path",
        ),
        (
            [
                {
                    "pluginId": "darrow-artificer@darrow",
                    "enabled": True,
                    "source": {"path": "relative"},
                }
            ],
            "absolute installation path",
        ),
    ],
)
def test_wrapper_refuses_unavailable_default_profile_artificer(
    repository: Path,
    home: Path,
    monkeypatch: pytest.MonkeyPatch,
    entry: list[dict[str, object]],
    diagnostic: str,
) -> None:
    assert (
        run(
            repository,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "codex",
        ).returncode
        == 0
    )
    monkeypatch.setenv("ARTIFICER_PLUGIN_LISTING", json.dumps({"installed": entry}))
    result = subprocess.run(
        [sys.executable, "-m", "darrow_artificer.launcher", "status"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and diagnostic in result.stderr


def test_saved_host_is_used_when_init_omits_host(repository: Path, home: Path) -> None:
    assert (
        run(
            repository,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "claude",
        ).returncode
        == 0
    )
    result = run(
        repository, "init", "--repository", "o/r", "--checkout", str(repository)
    )
    assert result.returncode == 1 and "already exists" in result.stderr


@pytest.mark.parametrize(
    "arguments, diagnostic",
    [(("status",), "darrow-artificer init"), (("init",), "--host")],
)
def test_uninitialized_wrapper_refuses_without_writes(
    repository: Path, home: Path, arguments: tuple[str, ...], diagnostic: str
) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "darrow_artificer.launcher", *arguments],
        cwd=repository,
        input="",
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and diagnostic in result.stderr
    assert not (home / ".darrow").exists()


@pytest.mark.parametrize("repository_name", ["bad", "../repo", "owner/.."])
def test_invalid_repository_cannot_escape_state_root(
    repository: Path, home: Path, repository_name: str
) -> None:
    result = run(
        repository,
        "init",
        "--repository",
        repository_name,
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 1 and "Repository" in result.stderr
    assert not (home / ".darrow").exists()


@pytest.mark.parametrize("location", ["[]", '{"state":"relative"}', '{"state":3}'])
def test_unreadable_installation_binding_refuses_without_fallback(
    repository: Path, home: Path, location: str
) -> None:
    state = home / ".darrow/artificer/o/r"
    state.mkdir(parents=True)
    (state / "location.json").write_text(location)
    result = run(repository, "status")
    assert result.returncode == 1 and (
        "location" in result.stderr or "JSON object" in result.stderr
    )
    assert not (state / "grant.json").exists()


def test_unrecognized_origin_refuses_discovery(repository: Path, home: Path) -> None:
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "remote",
            "set-url",
            "origin",
            "https://example.invalid/o/r",
        ],
        check=True,
    )
    result = run(repository, "status")
    assert result.returncode == 1 and "GitHub" in result.stderr
    assert not (home / ".darrow").exists()


def test_explicit_state_operates_outside_git_and_missing_launcher_tools_refuse(
    repository: Path, home: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert (
        run(
            repository,
            "init",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
            "--host",
            "codex",
        ).returncode
        == 0
    )
    state = home / ".darrow/artificer/o/r"
    result = run(tmp_path, "--state", str(state), "status")
    assert result.returncode == 0, result.stderr
    monkeypatch.setenv("PATH", "/usr/bin:/bin")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "darrow_artificer.launcher",
            "--state",
            str(state),
            "status",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and "on PATH" in result.stderr


def test_wrapper_refuses_invalid_saved_host(repository: Path, home: Path) -> None:
    state = home / ".darrow/artificer/o/r"
    state.mkdir(parents=True)
    (state / "grant.json").write_text('{"host":"unknown"}')
    result = subprocess.run(
        [sys.executable, "-m", "darrow_artificer.launcher", "status"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and "Invalid saved Artificer host" in result.stderr


@pytest.mark.parametrize("explicit", [True, False])
def test_guided_setup_with_supplied_flags_validates_host(
    repository: Path, home: Path, explicit: bool
) -> None:
    import pty

    command = [
        str(Path(sys.executable).with_name("darrow-artificer")),
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
    ]
    if explicit:
        command += ["--host", "codex"]
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            command,
            cwd=repository,
            stdin=slave,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, b"y\n" if explicit else b"invalid\ny\n")
            output, errors = child.communicate(timeout=10)
        assert "Repository: o/r" in output
        assert child.returncode == (0 if explicit else 1), errors
        if not explicit:
            assert "Host must" in errors
            assert not (home / ".darrow").exists()
    finally:
        os.close(master)
        os.close(slave)


@pytest.mark.parametrize("interactive", [True, False])
def test_wrapper_initialization_selects_host_before_plugin_lookup(
    repository: Path,
    home: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    interactive: bool,
) -> None:
    import pty

    plugin = tmp_path / "installed-plugin"
    entry = plugin / "backend/scripts/run_locked.py"
    entry.parent.mkdir(parents=True)
    entry.write_text("import sys\nprint('resolved ' + ' '.join(sys.argv[1:]))\n")
    monkeypatch.setenv("ARTIFICER_PLUGIN_PATH", str(plugin))
    monkeypatch.setenv("UV_PYTHON", sys.executable)
    command = [sys.executable, "-m", "darrow_artificer.launcher", "init"]
    if not interactive:
        command += [
            "--host",
            "codex",
            "--repository",
            "o/r",
            "--checkout",
            str(repository),
        ]
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            command,
            cwd=repository,
            stdin=slave,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, b"codex\n")
            output, errors = child.communicate(timeout=10)
        assert child.returncode == 0, errors
        assert "resolved darrow-artificer init" in output and "--host codex" in output
        assert not (home / ".darrow").exists()
    finally:
        os.close(master)
        os.close(slave)


def test_init_does_not_warn_when_wrapper_directory_is_on_path(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(
        "PATH", str(home / ".local/bin") + os.pathsep + os.environ["PATH"]
    )
    result = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    )
    assert result.returncode == 0, result.stderr
    assert "PATH" not in result.stderr


@pytest.mark.parametrize("profile_installation", [False, True])
@pytest.mark.parametrize("command_form", ["installed", "module"])
def test_wrapper_uses_only_profile_scoped_claude_artificer(
    repository: Path,
    home: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    profile_installation: bool,
    command_form: str,
) -> None:
    initialized = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "claude",
    )
    assert initialized.returncode == 0, initialized.stderr
    entries = []
    for index, scope in enumerate(
        ["project", "user"] if profile_installation else ["project"]
    ):
        plugin = tmp_path / f"installation-{index}"
        entrypoint = plugin / "backend/scripts/run_locked.py"
        entrypoint.parent.mkdir(parents=True)
        entrypoint.write_text(f"print({scope!r})\n")
        entries.append(
            {
                "id": "darrow-artificer@darrow",
                "version": "1.0.0",
                "enabled": True,
                "installPath": str(plugin),
                "scope": scope,
            }
        )
    monkeypatch.setenv("ARTIFICER_PLUGIN_LISTING", json.dumps(entries))
    monkeypatch.setenv("UV_PYTHON", sys.executable)
    command = (
        [str(home / ".local/bin/darrow-artificer")]
        if command_form == "installed"
        else [sys.executable, "-m", "darrow_artificer.launcher"]
    )
    result = subprocess.run(
        [*command, "status"],
        cwd=repository,
        capture_output=True,
        text=True,
        check=False,
    )
    if profile_installation:
        assert result.returncode == 0, result.stderr
        assert result.stdout.strip() == "user"
    else:
        assert result.returncode == 1
        assert "host default profile" in result.stderr
        assert not result.stdout.strip()


def test_claude_admission_accepts_project_scoped_delivery_plugins(
    repository: Path,
    home: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from darrow_artificer.installation import Installation
    from test_worker_cli import wait_stopped

    profile = tmp_path / "delivery-profile"
    profile.mkdir()
    initialized = run(
        repository,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "claude",
        "--profile-dir",
        str(profile),
    )
    assert initialized.returncode == 0, initialized.stderr
    entries = [
        {
            "id": name + "@darrow",
            "version": "1.0.0",
            "enabled": True,
            "scope": "project",
            "installPath": str(tmp_path / name),
        }
        for name in ("darrow-ticket-to-pr", "darrow-adaptive-goal")
    ]
    monkeypatch.setenv("ARTIFICER_PLUGIN_LISTING", json.dumps(entries))
    result = run(repository, "tick")
    assert result.returncode == 0, result.stderr
    assert len(json.loads(result.stdout)["admitted"]) == 1
    claim = wait_stopped(Installation(home / ".darrow/artificer/o/r"))
    assert claim.native is not None
    assert "Specification needed" in claim.detail
    listing = json.loads(
        (services / "plugin-listings.jsonl").read_text().splitlines()[0]
    )
    assert listing["cwd"] == str(repository)
    assert listing["CLAUDE_CONFIG_DIR"] == str(profile)
