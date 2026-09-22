"""Replay reference commands from a copied runtime-only plugin on the native OS."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import TypedDict, cast


class Case(TypedDict):
    args: list[str]
    inputs: dict[str, str]
    code: int
    stdout: str
    output: str | None


class Reference(TypedDict):
    files: dict[str, str]
    cases: list[Case]


def run(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )


def replay(backend: Path, root: Path, reference: Reference, case: Case) -> None:
    root.mkdir()
    for name, digest in case["inputs"].items():
        path = Path(name.replace("<ROOT>", str(root)))
        path.write_bytes(
            reference["files"][digest].replace("<ROOT>", str(root)).encode("utf-8")
        )
    args = [a.replace("<ROOT>", str(root)) for a in case["args"]]
    result = run(
        root,
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
        "darrow-ticket-pipeline",
        *args,
    )
    assert result.returncode == case["code"], (args, result)
    assert (
        result.stdout.replace(str(root), "<ROOT>").replace("<ROOT>\\", "<ROOT>/")
        == case["stdout"]
    )
    assert bool(result.stderr) == (case["code"] != 0), result
    check_output(root, args, case)


def check_output(root: Path, args: list[str], case: Case) -> None:
    if "--output" not in args:
        return
    output = Path(args[args.index("--output") + 1])
    assert output.exists() == (case["output"] is not None)
    if output.exists():
        normalized = output.read_bytes().decode("utf-8").replace(str(root), "<ROOT>")
        assert hashlib.sha256(normalized.encode("utf-8")).hexdigest() == case["output"]


def validate(plugin: Path, temporary: Path) -> None:
    backend = plugin / "backend"
    assert not (plugin / "bin").exists()
    prefix = (
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
    )
    absent = run(
        temporary,
        *prefix,
        "python",
        "-c",
        "import importlib.util; assert all(importlib.util.find_spec(n) is None for n in ('pytest', 'ruff', 'mypy', 'coverage', 'hypothesis'))",
    )
    assert absent.returncode == 0, absent.stderr
    reference = cast(
        Reference,
        json.loads((backend / "tests/reference.json").read_text(encoding="utf-8")),
    )
    for index, case in enumerate(reference["cases"]):
        replay(backend, temporary / f"case {index} ' café", reference, case)
    usage = run(temporary, *prefix, "darrow-ticket-pipeline")
    assert usage.returncode == 64


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    # Prevent an invoking development environment from substituting its packages.
    for key in ("PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "UV_PROJECT_ENVIRONMENT"):
        os.environ.pop(key, None)
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
    with tempfile.TemporaryDirectory(prefix="darrow pipeline fresh ") as directory:
        temporary = Path(directory).resolve()
        copied = temporary / "plugin copy"
        shutil.copytree(plugin, copied, ignore=ignored)
        os.environ["DARROW_CACHE_DIR"] = str(temporary / "darrow-cache")
        make_read_only(copied)
        validate(copied, temporary)
        assert not list(copied.rglob(".venv"))
        assert not list(copied.rglob("__pycache__"))
        make_writable(copied)
    print(
        "fresh copied ticket-pipeline: matched reference commands and usage refusal passed with runtime dependencies only"
    )


if __name__ == "__main__":
    main()
