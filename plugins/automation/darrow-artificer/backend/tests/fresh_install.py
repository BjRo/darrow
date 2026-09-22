"""Validate Artificer from a fresh immutable-plugin copy."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def run(cwd: Path, command: list[str]) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        env={**os.environ, "PYTHONUTF8": "1", "UV_NO_PROGRESS": "1"},
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise AssertionError(
            f"{command}: {result.returncode}\n{result.stdout}\n{result.stderr}"
        )
    return result.stdout


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
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
    with tempfile.TemporaryDirectory(prefix="darrow artificer fresh ") as directory:
        fixture = Path(directory).resolve()
        copied = fixture / "plugin copy"
        shutil.copytree(plugin, copied, ignore=ignored)
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copied)
        launcher = [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str((copied / "backend/scripts/run_locked.py").resolve()),
        ]
        packages = run(
            fixture,
            [
                *launcher,
                "python",
                "-c",
                "import importlib.metadata as m; print('\\n'.join(d.metadata['Name'] or '' for d in m.distributions()))",
            ],
        )
        assert not any(
            tool in packages
            for tool in ("coverage", "hypothesis", "mypy", "pytest", "ruff")
        )
        assert "darrow-artificer" in run(
            fixture, [*launcher, "darrow-artificer", "--help"]
        )
        assert not list(copied.rglob(".venv"))
        assert not list(copied.rglob("__pycache__"))
        make_writable(copied)
    print("fresh copied Artificer: locked runtime and immutable plugin passed")


if __name__ == "__main__":
    main()
