"""Native copied-artifact validation using only locked runtime dependencies."""

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
    uv = ["uv", "run", "--quiet", "--frozen", "--no-dev", "--project", str(backend)]
    command(fixture, "gh", "--version")
    command(fixture, "uv", "sync", "--frozen", "--no-dev", "--project", str(backend))
    tree = command(
        fixture, "uv", "tree", "--frozen", "--no-dev", "--project", str(backend)
    )
    assert not any(
        tool in tree for tool in ("pytest", "ruff", "mypy", "hypothesis", "coverage")
    )
    assert not (copy / "bin").exists()
    assert "usage: ticket" in command(fixture, *uv, "darrow-ticket", expected=64)
    assert "not inside a git work tree" in command(
        fixture, *uv, "darrow-ticket", "inspect", expected=3
    )
    repo = fixture / "repository ü with spaces"
    repo.mkdir()
    command(repo, "git", "init", "-q")
    command(repo, "git", "remote", "add", "origin", "https://github.test/o/r.git")
    output = command(repo, *uv, "python", str(backend / "tests" / "fresh_probe.py"))
    assert "all ten commands passed" in output


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
        validate(copy, fixture)
    print("fresh copied ticket plugin passed (gh available; provider calls mocked)")


if __name__ == "__main__":
    main()
