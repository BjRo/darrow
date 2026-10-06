"""Validate a fresh copied plugin using only locked runtime dependencies."""

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str) -> bytes:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True).stdout


def launcher(backend: Path) -> list[str]:
    return [
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
    ]


def installed_runtime(backend: Path, fixture: Path) -> None:
    packages = command(
        fixture,
        *launcher(backend),
        "python",
        "-c",
        "import importlib.metadata as m; print('\\n'.join(d.metadata['Name'] or '' for d in m.distributions()))",
    ).decode()
    assert not re.search(r"\b(coverage|hypothesis|mypy|pytest|ruff)\b", packages)


def validate(backend: Path, fixture: Path) -> None:
    plugin = fixture / "plugin copy"
    for name in ("create-agent-skill", "audit-agent-skill"):
        inspection = command(
            fixture,
            *launcher(backend),
            "inspect-skill",
            "inspect",
            str(plugin / "skills" / name),
            str(plugin),
        ).decode()
        assert "status\tvalid" in inspection.splitlines(), inspection
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
            *launcher(backend),
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


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    plugin = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory(prefix="darrow skill-authoring ") as temporary:
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
        backend = copy / "backend"
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copy)
        installed_runtime(backend, fixture)
        validate(backend, fixture)
        assert not list(copy.rglob(".venv"))
        assert not list(copy.rglob("__pycache__"))
        make_writable(copy)
    print("darrow-skill-authoring fresh install passed")


if __name__ == "__main__":
    main()
