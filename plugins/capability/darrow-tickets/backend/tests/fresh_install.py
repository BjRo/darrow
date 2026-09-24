"""Native copied-artifact validation using only locked runtime dependencies."""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str, expected: int = 0) -> str:
    result = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )
    assert result.returncode == expected, (args, result.stdout, result.stderr)
    return result.stdout + result.stderr


def validate(copy: Path, fixture: Path) -> None:
    backend = copy / "backend"
    uv = [
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
    ]
    command(fixture, "gh", "--version")
    packages = command(
        fixture,
        *uv,
        "python",
        "-c",
        "import importlib.metadata as m; print('\\n'.join(d.metadata['Name'] or '' for d in m.distributions()))",
    )
    assert "darrow-tickets" in packages.splitlines()
    assert not any(
        tool in packages
        for tool in ("pytest", "ruff", "mypy", "hypothesis", "coverage")
    )
    assert not (copy / "bin").exists()
    context = json.loads(command(fixture, *uv, "darrow-tickets-claude-context"))
    assert context["hookSpecificOutput"]["hookEventName"] == "SessionStart"
    assert context["hookSpecificOutput"]["additionalContext"].strip()
    assert "usage: ticket" in command(fixture, *uv, "darrow-ticket", expected=64)
    assert "provider is unavailable: linear" in command(
        fixture,
        *uv,
        "darrow-ticket",
        "get",
        "ENG-12",
        "--provider",
        "linear",
        expected=3,
    )
    assert "not inside a git work tree" in command(
        fixture, *uv, "darrow-ticket", "inspect", expected=3
    )
    repo = fixture / "repository ü with spaces"
    repo.mkdir()
    command(repo, "git", "init", "-q")
    command(repo, "git", "remote", "add", "origin", "https://github.test/o/r.git")
    output = command(repo, *uv, "python", str(backend / "tests" / "fresh_probe.py"))
    assert "all ten commands passed" in output


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    os.environ["GIT_CONFIG_GLOBAL"] = os.devnull
    os.environ["GIT_CONFIG_NOSYSTEM"] = "1"
    os.environ["PYTHONUTF8"] = "1"
    plugin = Path(__file__).resolve().parents[2]
    ignored = shutil.ignore_patterns(
        ".venv",
        "__pycache__",
        ".hypothesis",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".coverage*",
        "coverage.json",
    )
    with tempfile.TemporaryDirectory(prefix="darrow tickets fresh ") as temporary:
        fixture = Path(temporary).resolve()
        copy = fixture / "plugin copy ü"
        shutil.copytree(plugin, copy, ignore=ignored)
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copy)
        validate(copy, fixture)
        assert not list(copy.rglob(".venv"))
        assert not list(copy.rglob("__pycache__"))
        make_writable(copy)
    print("fresh copied ticket plugin passed (gh available; provider calls mocked)")


if __name__ == "__main__":
    main()
