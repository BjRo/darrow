"""Validate a fresh copied plugin using only locked runtime dependencies."""

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str) -> bytes:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True).stdout


def installed_runtime(backend: Path, fixture: Path) -> None:
    command(fixture, "uv", "sync", "--frozen", "--no-dev", "--project", str(backend))
    tree = command(
        fixture, "uv", "tree", "--frozen", "--no-dev", "--project", str(backend)
    ).decode()
    assert not re.search(r"\b(coverage|hypothesis|mypy|pytest|ruff)\b", tree), tree


def validate(backend: Path, fixture: Path) -> None:
    skill = backend.parent
    inspection = command(
        fixture,
        "uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        str(backend),
        "inspect-skill",
        "inspect",
        str(skill),
        str(fixture / "plugin copy"),
    ).decode()
    assert re.search(r"(?m)^status\s+valid$", inspection), inspection
    scripts = [
        "inspect-skill.test.sh",
        "verify-shell-tests.test.sh",
        "interpreter-routing.test.sh",
    ]
    paths = [str(backend / "tests" / "shell" / name) for name in scripts]
    if os.name == "nt":
        passing = fixture / "passing test.sh"
        passing.write_bytes(b"#!/usr/bin/env bash\nexit 0\n")
        paths = [str(passing)]
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--frozen",
            "--no-dev",
            "--project",
            str(backend),
            "verify-shell-tests",
            "--",
            *paths,
        ],
        cwd=fixture,
        capture_output=True,
        text=True,
        check=False,
    )
    print(result.stdout, end="")
    assert result.returncode in (0, 3), result
    assert re.search(r"(?m)^format\s+darrow-shell-test-matrix-v1$", result.stdout)
    assert not re.search(r"(?m)^test_result.*failed", result.stdout)
    if os.name != "nt":
        for name in scripts:
            assert re.search(
                r"test_result.*" + re.escape(name) + r"\s+passed$",
                result.stdout,
                re.MULTILINE,
            ), result.stdout


def main() -> None:
    plugin = Path(__file__).resolve().parents[4]
    with tempfile.TemporaryDirectory(prefix="darrow author-agent-skill ") as temporary:
        fixture = Path(temporary).resolve()
        copy = fixture / "plugin copy"
        shutil.copytree(
            plugin,
            copy,
            ignore=shutil.ignore_patterns(
                ".venv",
                "__pycache__",
                ".hypothesis",
                ".mypy_cache",
                ".pytest_cache",
                ".ruff_cache",
                ".coverage*",
                "coverage.json",
            ),
        )
        backend = copy / "skills" / "author-agent-skill" / "backend"
        installed_runtime(backend, fixture)
        validate(backend, fixture)
    print("author-agent-skill fresh install passed")


if __name__ == "__main__":
    main()
