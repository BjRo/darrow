"""macOS setup through the CLI, isolated homes and real shell startup."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from test_setup_cli import home as home
from test_worker_cli import repository as repository
from test_worker_cli import services as services


def command(*arguments: str) -> list[str]:
    # Select the supported platform at the process boundary, including on Linux CI.
    return [
        sys.executable,
        "-c",
        "from darrow_artificer.cli import entrypoint; import sys; "
        "sys.platform = 'darwin'; entrypoint()",
        *arguments,
    ]


def run(checkout: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command(*arguments), cwd=checkout, text=True, capture_output=True, check=False
    )


def initialize(checkout: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return run(
        checkout,
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(checkout),
        "--host",
        "codex",
        *arguments,
    )


def test_scripted_path_setup_is_explicit_and_preserves_zsh_config(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.delenv("ZDOTDIR", raising=False)
    original = b"# existing configuration\nexport USER_SETTING=retained\n"
    config = home / ".zshrc"
    config.write_bytes(original)
    config.chmod(0o640)
    # A fresh scripted installation never silently opts into shell changes.
    no_opt_in = initialize(repository)
    assert no_opt_in.returncode == 0, no_opt_in.stderr
    assert config.read_bytes() == original
    # Use a second isolated repository identity to exercise fresh opt-in setup.
    subprocess.run(
        ["git", "remote", "set-url", "origin", "https://github.com/o/other.git"],
        cwd=repository,
        check=True,
    )
    result = run(
        repository,
        "init",
        "--repository",
        "o/other",
        "--checkout",
        str(repository),
        "--host",
        "codex",
        "--setup-path",
    )
    assert result.returncode == 0, result.stderr
    assert config.read_bytes().startswith(original)
    assert config.stat().st_mode & 0o777 == 0o640
    shell = subprocess.run(
        ["/bin/zsh", "-ic", "command -v darrow-artificer; print -r -- $USER_SETTING"],
        cwd=repository,
        text=True,
        capture_output=True,
        check=False,
    )
    assert shell.returncode == 0, shell.stderr
    assert str(home / ".local/bin/darrow-artificer") in shell.stdout
    assert "retained" in shell.stdout
    assert "new terminal" in result.stderr.lower()


@pytest.mark.parametrize(
    "login_file", [".bash_profile", ".bash_login", ".profile", None]
)
def test_bash_setup_respects_first_login_file_and_resolves_in_both_shells(
    repository: Path,
    home: Path,
    monkeypatch: pytest.MonkeyPatch,
    login_file: str | None,
) -> None:
    monkeypatch.setenv("SHELL", "/bin/bash")
    if login_file:
        (home / login_file).write_text("# user login settings\n")
    (home / ".bashrc").write_text("# user interactive settings\n")
    result = initialize(repository, "--setup-path")
    assert result.returncode == 0, result.stderr
    chosen = login_file or ".bash_profile"
    assert str(home / chosen) in result.stderr
    for flag in ("-ic", "-lic"):
        shell = subprocess.run(
            ["/bin/bash", flag, "command -v darrow-artificer"],
            cwd=repository,
            text=True,
            capture_output=True,
            check=False,
        )
        assert shell.returncode == 0, shell.stderr
        assert str(home / ".local/bin/darrow-artificer") in shell.stdout
    for name in (".bash_profile", ".bash_login", ".profile"):
        assert (home / name).exists() == (name == chosen)


def test_repeated_init_repairs_command_without_reauthorizing_or_forge_calls(
    repository: Path, home: Path, services: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.delenv("ZDOTDIR", raising=False)
    profile = home / "selected-profile"
    profile.mkdir()
    first = initialize(repository, "--profile-dir", str(profile), "--issue", "7")
    assert first.returncode == 0, first.stderr
    assert (
        run(
            repository, "configure", "--workers", "3", "--WORK_IN_PROGRESS_LIMIT", "2"
        ).returncode
        == 0
    )
    assert run(repository, "revoke").returncode == 0
    state = home / ".darrow/artificer/o/r"
    before = {p.relative_to(state): p.read_bytes() for p in state.rglob("*.json")}
    (services / "gh").write_text(
        "#!/bin/sh\necho 'forge must not be called' >&2\nexit 1\n"
    )
    wrapper = home / ".local/bin/darrow-artificer"
    wrapper.unlink()
    repaired = run(repository, "init", "--setup-path")
    assert repaired.returncode == 0, repaired.stderr
    assert wrapper.is_file()
    assert {
        p.relative_to(state): p.read_bytes() for p in state.rglob("*.json")
    } == before
    config = home / ".zshrc"
    contents = config.read_bytes()
    repeated = run(repository, "init", "--setup-path")
    assert repeated.returncode == 0, repeated.stderr
    assert config.read_bytes() == contents
    assert {
        p.relative_to(state): p.read_bytes() for p in state.rglob("*.json")
    } == before


def seed_unsafe_config(config: Path, problem: str) -> None:
    if problem == "broken-symlink":
        config.symlink_to(config.parent / "missing-target")
    elif problem == "directory":
        config.mkdir()
    else:
        samples = {
            "incomplete": b"# user settings\n# >>> darrow-artificer PATH >>>\n",
            "altered": b"# >>> darrow-artificer PATH >>>\nexport PATH=/wrong\n# <<< darrow-artificer PATH <<<\n",
            "duplicate": b"# >>> darrow-artificer PATH >>>\n# >>> darrow-artificer PATH >>>\n",
            "unreadable": b"# private\n",
        }
        config.write_bytes(samples[problem])
        if problem == "unreadable":
            config.chmod(0)


@pytest.mark.parametrize(
    "problem",
    ["incomplete", "altered", "duplicate", "unreadable", "broken-symlink", "directory"],
)
def test_unsafe_shell_config_refuses_before_any_setup_effects(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch, problem: str
) -> None:
    monkeypatch.setenv("SHELL", "/bin/bash")
    config = home / ".bash_profile"
    seed_unsafe_config(config, problem)
    try:
        result = initialize(repository, "--setup-path")
        assert result.returncode == 1, result.stdout + result.stderr
        assert str(config) in result.stderr
        assert not (home / ".darrow").exists()
        assert not (home / ".local").exists()
        assert not (home / ".bashrc").exists()
        if problem in {"incomplete", "altered", "duplicate"}:
            assert b"darrow-artificer PATH" in config.read_bytes()
            assert b'export PATH="$HOME' not in config.read_bytes()
    finally:
        if problem == "unreadable":
            config.chmod(0o600)


@pytest.mark.parametrize("path_choice,save", [("y", "y"), ("n", "y"), ("y", "n")])
def test_guided_path_preview_and_separate_save_confirmation(
    repository: Path,
    home: Path,
    monkeypatch: pytest.MonkeyPatch,
    path_choice: str,
    save: str,
) -> None:
    import pty

    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.delenv("ZDOTDIR", raising=False)
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            command(
                "init",
                "--repository",
                "o/r",
                "--checkout",
                str(repository),
                "--host",
                "codex",
            ),
            cwd=repository,
            stdin=slave,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, f"{path_choice}\n{save}\n".encode())
            output, errors = child.communicate(timeout=10)
        assert str(home / ".zshrc") in output, output + errors
        assert output.index(str(home / ".zshrc")) < output.index("save?")
        assert (
            "PATH setup: yes" in output
            if path_choice == "y"
            else "PATH setup: no" in output
        )
        assert (home / ".zshrc").exists() == (path_choice == save == "y")
        assert (home / ".darrow").exists() == (save == "y")
        assert (home / ".local").exists() == (save == "y")
        assert child.returncode == (0 if save == "y" else 1)
    finally:
        os.close(master)
        os.close(slave)


@pytest.mark.parametrize(
    "shell,directory_link", [("zsh", False), ("zsh", True), ("bash", False)]
)
def test_symlink_config_and_runtime_path_remain_idempotent(
    repository: Path,
    home: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    shell: str,
    directory_link: bool,
) -> None:
    monkeypatch.setenv("SHELL", f"/bin/{shell}")
    dotdir = home / "shell settings"
    if directory_link:
        actual = home / "actual shell settings"
        actual.mkdir()
        dotdir.symlink_to(actual)
    else:
        dotdir.mkdir()
    monkeypatch.setenv("ZDOTDIR", str(dotdir))
    config = dotdir / ".zshrc" if shell == "zsh" else home / ".bashrc"
    target = tmp_path / "managed-by-user"
    original = b"# existing bytes without trailing newline"
    target.write_bytes(original)
    target.chmod(0o640)
    config.symlink_to(target)
    if shell == "bash":
        (home / ".bash_profile").write_text('. "$HOME/.bashrc"\n')
        (home / ".bash_login").write_text("# must remain untouched\n")
    first = initialize(repository, "--setup-path")
    assert first.returncode == 0, first.stderr
    contents = target.read_bytes()
    assert contents.startswith(original + b"\n")
    assert config.is_symlink()
    assert target.stat().st_mode & 0o777 == 0o640
    assert run(repository, "init", "--setup-path").returncode == 0
    assert target.read_bytes() == contents
    for flag in ("-ic", "-lic"):
        process = subprocess.run(
            [
                f"/bin/{shell}",
                flag,
                'command -v darrow-artificer; printf "PATH_RESULT=%s\\n" "$PATH"',
            ],
            cwd=repository,
            text=True,
            capture_output=True,
            check=False,
        )
        assert process.returncode == 0, process.stderr
        assert str(home / ".local/bin/darrow-artificer") in process.stdout
        value = next(
            line.removeprefix("PATH_RESULT=")
            for line in process.stdout.splitlines()
            if line.startswith("PATH_RESULT=")
        )
        assert value.split(os.pathsep).count(str(home / ".local/bin")) == 1
    if shell == "bash":
        assert (home / ".bash_login").read_text() == "# must remain untouched\n"
    else:
        assert not (home / ".zshrc").exists()


@pytest.mark.parametrize(
    "setting", ["--host", "--profile-dir", "--checkout", "--issue", "--state"]
)
def test_repair_refuses_conflicting_saved_configuration(
    repository: Path, home: Path, tmp_path: Path, setting: str
) -> None:
    first = initialize(repository)
    assert first.returncode == 0, first.stderr
    state = home / ".darrow/artificer/o/r"
    before = {p.relative_to(state): p.read_bytes() for p in state.rglob("*.json")}
    values = {
        "--host": "claude",
        "--profile-dir": str(tmp_path),
        "--checkout": str(tmp_path),
        "--issue": "99",
        "--state": str(tmp_path / "second-state"),
    }
    arguments = ["init", "--repository", "o/r", setting, values[setting]]
    if setting == "--state":
        arguments = [setting, values[setting], "init", "--repository", "o/r"]
    result = run(repository, *arguments)
    assert result.returncode == 1, result.stdout
    assert "already exists" in result.stderr
    assert {
        p.relative_to(state): p.read_bytes() for p in state.rglob("*.json")
    } == before
    assert not (tmp_path / "second-state").exists()


def test_already_present_path_leaves_shell_files_alone(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.setenv(
        "PATH", str(home / ".local/bin") + os.pathsep + os.environ["PATH"]
    )
    config = home / ".zshrc"
    config.write_bytes(b"# >>> darrow-artificer PATH >>>\n")
    original = config.read_bytes()
    result = initialize(repository, "--setup-path")
    assert result.returncode == 0, result.stderr
    assert config.read_bytes() == original
    assert "PATH" not in result.stderr


@pytest.mark.parametrize(
    "platform,shell", [("darwin", "fish"), ("linux", "zsh"), ("darwin", "")]
)
def test_explicit_setup_refuses_unsupported_platform_or_shell(
    repository: Path,
    home: Path,
    monkeypatch: pytest.MonkeyPatch,
    platform: str,
    shell: str,
) -> None:
    monkeypatch.setenv("SHELL", shell)
    arguments = command(
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
        "--setup-path",
    )
    arguments[2] = arguments[2].replace("'darwin'", repr(platform))
    result = subprocess.run(
        arguments, cwd=repository, text=True, capture_output=True, check=False
    )
    assert result.returncode == 1
    assert "macOS zsh and Bash" in result.stderr
    assert not (home / ".darrow").exists()


def test_printed_source_instruction_quotes_shell_config_path(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import shlex

    dotdir = home / "shell settings"
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.setenv("ZDOTDIR", str(dotdir))
    result = initialize(repository, "--setup-path")
    assert result.returncode == 0, result.stderr
    line = next(line for line in result.stderr.splitlines() if "new terminal" in line)
    instruction = "source " + line.split("source ", 1)[1].split(" to use", 1)[0]
    assert shlex.split(instruction) == ["source", str(dotdir / ".zshrc")]


@pytest.mark.parametrize(
    "variant", ["repair", "already-path", "unsupported", "explicit-path"]
)
def test_guided_setup_uses_saved_context_and_handles_path_options(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch, variant: str
) -> None:
    import pty

    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.delenv("ZDOTDIR", raising=False)
    arguments = [
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
    ]
    answers = "y\n"
    if variant == "repair":
        assert initialize(repository).returncode == 0
        assert (
            run(
                repository,
                "configure",
                "--workers",
                "3",
                "--WORK_IN_PROGRESS_LIMIT",
                "2",
            ).returncode
            == 0
        )
        arguments = ["init"]
        answers = "n\ny\n"
    elif variant == "already-path":
        monkeypatch.setenv(
            "PATH", str(home / ".local/bin") + os.pathsep + os.environ["PATH"]
        )
    elif variant == "unsupported":
        monkeypatch.setenv("SHELL", "/bin/fish")
    else:
        arguments += ["--setup-path"]
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            command(*arguments),
            cwd=repository,
            stdin=slave,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, answers.encode())
            output, errors = child.communicate(timeout=10)
        assert child.returncode == 0, output + errors
        if variant == "repair":
            assert "Repair installed command" in output
            assert "Authorize unattended" not in output
            assert "Workers: 3" in output and "WIP: 2" in output
        assert (home / ".zshrc").exists() == (variant == "explicit-path")
    finally:
        os.close(master)
        os.close(slave)


def test_repair_by_explicit_state_outside_git_preserves_optional_profile(
    repository: Path, home: Path, tmp_path: Path
) -> None:
    import json

    assert initialize(repository).returncode == 0
    state = home / ".darrow/artificer/o/r"
    grant = state / "grant.json"
    value = json.loads(grant.read_text())
    value["profile_dir"] = None
    grant.write_text(json.dumps(value))
    before = grant.read_bytes()
    result = run(tmp_path, "--state", str(state), "init")
    assert result.returncode == 0, result.stderr
    assert grant.read_bytes() == before
    uninitialized_home = tmp_path / "fresh-home"
    uninitialized_home.mkdir()
    failed = subprocess.run(
        command("init"),
        cwd=tmp_path,
        env={**os.environ, "HOME": str(uninitialized_home)},
        text=True,
        capture_output=True,
        check=False,
    )
    assert failed.returncode == 1 and "Missing initialization flags" in failed.stderr
    assert list(uninitialized_home.iterdir()) == []


@pytest.mark.parametrize("mutation", ["inline", "duplicate"])
def test_repair_refuses_corrupted_managed_block(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.delenv("ZDOTDIR", raising=False)
    assert initialize(repository, "--setup-path").returncode == 0
    config = home / ".zshrc"
    content = config.read_bytes()
    invalid = (
        b"echo unexpected; " + content if mutation == "inline" else content + content
    )
    config.write_bytes(invalid)
    wrapper = home / ".local/bin/darrow-artificer"
    wrapper.unlink()
    result = run(repository, "init", "--setup-path")
    assert result.returncode == 1 and "Malformed managed PATH entry" in result.stderr
    assert config.read_bytes() == invalid
    assert not wrapper.exists()


@pytest.mark.parametrize("interactive", [False, True])
def test_explicit_unsupported_setup_refuses_even_when_path_present(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch, interactive: bool
) -> None:
    import pty

    monkeypatch.setenv("SHELL", "/bin/fish")
    monkeypatch.setenv(
        "PATH", str(home / ".local/bin") + os.pathsep + os.environ["PATH"]
    )
    arguments = command(
        "init",
        "--repository",
        "o/r",
        "--checkout",
        str(repository),
        "--host",
        "codex",
        "--setup-path",
    )
    master, slave = pty.openpty()
    try:
        with subprocess.Popen(
            arguments,
            cwd=repository,
            stdin=slave if interactive else subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as child:
            os.write(master, b"y\n")
            output, errors = child.communicate(timeout=10)
        assert child.returncode == 1, output + errors
        assert "macOS zsh and Bash" in errors
        assert not (home / ".darrow").exists()
        assert not (home / ".local").exists()
    finally:
        os.close(master)
        os.close(slave)


def invalid_zdotdir(home: Path, problem: str) -> str:
    if problem in {"empty", "relative"}:
        return "" if problem == "empty" else "shell-settings"
    path = home / "shell-settings"
    if problem == "broken-parent":
        path.symlink_to(home / "missing-directory")
    elif problem == "file-parent":
        path.write_text("not a directory\n")
    else:
        path.mkdir()
        path.chmod(0)
    return str(path)


@pytest.mark.parametrize(
    "problem",
    ["empty", "relative", "broken-parent", "file-parent", "unreadable-parent"],
)
def test_invalid_zdotdir_refuses_before_writing_installation_or_checkout(
    repository: Path, home: Path, monkeypatch: pytest.MonkeyPatch, problem: str
) -> None:
    monkeypatch.setenv("SHELL", "/bin/zsh")
    monkeypatch.setenv("ZDOTDIR", invalid_zdotdir(home, problem))
    try:
        result = initialize(repository, "--setup-path")
        assert result.returncode == 1, result.stdout + result.stderr
        assert "ZDOTDIR" in result.stderr or "shell-settings" in result.stderr
        assert not (home / ".darrow").exists()
        assert not (home / ".local").exists()
        assert not (repository / ".zshrc").exists()
        assert not (repository / "shell-settings").exists()
    finally:
        if problem == "unreadable-parent":
            (home / "shell-settings").chmod(0o700)


@pytest.mark.parametrize("form", ["omitted", "alias", "resolved"])
def test_repair_preserves_saved_default_profile_symlink(
    repository: Path, home: Path, form: str
) -> None:
    target = home / "actual-profile"
    target.mkdir()
    alias = home / ".codex"
    alias.symlink_to(target)
    first = initialize(repository)
    assert first.returncode == 0, first.stderr
    grant = home / ".darrow/artificer/o/r/grant.json"
    before = grant.read_bytes()
    arguments = (
        []
        if form == "omitted"
        else ["--profile-dir", str(alias if form == "alias" else target)]
    )
    repaired = run(repository, "init", *arguments)
    assert repaired.returncode == 0, repaired.stderr
    assert grant.read_bytes() == before
