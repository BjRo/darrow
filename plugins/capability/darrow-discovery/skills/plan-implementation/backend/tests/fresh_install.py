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


def probe(
    backend: Path,
    cwd: Path,
    args: list[str],
    *,
    output: str = "",
    error: str = "",
    status: int = 0,
    encoding: str = "utf-8",
) -> None:
    result = subprocess.run(
        [
            *launcher(backend),
            "darrow-render-plan-frontier",
            *args,
        ],
        cwd=cwd,
        env={**os.environ, "PYTHONIOENCODING": encoding},
        capture_output=True,
        check=False,
    )
    assert (result.returncode, result.stdout, result.stderr) == (
        status,
        output.encode("utf-8"),
        error.encode("utf-8"),
    ), result


def validate(backend: Path, fixture: Path) -> None:
    probe(
        backend,
        fixture,
        [
            "--evidence",
            "The repository stores records in one region today.",
            "--question",
            "Data region: single-region or multi-region?",
            "--option",
            "single-region",
            "--option",
            "multi-region",
            "--choice",
            "single-region",
            "--rationale",
            "it limits operational coupling",
            "--deferred",
            "storage vendor and migration path",
        ],
        output=(
            "Evidence: The repository stores records in one region today.\n\n"
            "Q1 — Data region: single-region or multi-region?\n\n"
            "Recommendation: Choose single-region because it limits operational coupling.\n\n"
            "Deferred: storage vendor and migration path. After your answer, "
            "I will recompute the next frontier.\n"
        ),
    )
    probe(
        backend,
        fixture,
        [
            "--evidence",
            "Fact",
            "--question",
            "Mode: ä or b?",
            "--option",
            "Ä",
            "--option",
            "b",
            "--choice",
            "ä",
            "--rationale",
            "reason",
            "--deferred",
            "category",
        ],
        encoding="cp1252",
        output=(
            "Evidence: Fact.\n\nQ1 — Mode: ä or b?\n\n"
            "Recommendation: Choose ä because reason.\n\n"
            "Deferred: category. After your answer, I will recompute the next frontier.\n"
        ),
    )
    probe(
        backend, fixture, [], status=2, error="every frontier field must be non-empty\n"
    )
    usage = (
        "usage: darrow-render-plan-frontier --evidence TEXT --question TEXT "
        "--option LABEL --option LABEL [--option LABEL ...] --choice LABEL "
        "--rationale TEXT --deferred TEXT\n"
    )
    for arguments in (["--evidence"], ["--unknown", "value"]):
        probe(backend, fixture, arguments, status=2, error=usage)


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    plugin = Path(__file__).resolve().parents[4]
    with tempfile.TemporaryDirectory(prefix="darrow plan-implementation ") as temporary:
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
        backend = copy / "skills" / "plan-implementation" / "backend"
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copy)
        installed_runtime(backend, fixture)
        validate(backend, fixture)
        assert not list(copy.rglob(".venv"))
        assert not list(copy.rglob("__pycache__"))
        make_writable(copy)
    print("plan-implementation fresh install passed")


if __name__ == "__main__":
    main()
