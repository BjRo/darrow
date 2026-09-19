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


def probe(
    backend: Path,
    cwd: Path,
    args: list[str],
    *,
    output: str = "",
    error: str = "",
    status: int = 0,
) -> None:
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--isolated",
            "--frozen",
            "--no-dev",
            "--project",
            str(backend),
            "darrow-render-assessment",
            *args,
        ],
        cwd=cwd,
        capture_output=True,
        check=False,
    )
    assert (result.returncode, result.stdout, result.stderr) == (
        status,
        output.encode("utf-8"),
        error.encode("utf-8"),
    ), result


def validate(backend: Path, fixture: Path) -> None:
    shutil.rmtree(backend / ".venv")
    outside = fixture / "outside"
    outside.mkdir()
    assessment = fixture / "assessment.md"
    report = fixture / (
        "provider report #%.md" if os.name == "nt" else "provider report #%<>.md"
    )
    assessment_text = "Conclusion: progress.\n\nF1 remains blocking; A1 is advisory.\n"
    assessment.write_bytes(assessment_text.encode())
    report_bytes = b"Complete provider report, unchanged.\n"
    report.write_bytes(report_bytes)
    # Independent encoding oracle; preserve ordinary path punctuation.
    from urllib.parse import quote

    destination = quote(str(report.resolve()), safe="/:().-_~")
    probe(
        backend,
        outside,
        ["--assessment", str(assessment), "--provider-report", str(report)],
        output=assessment_text
        + "\n\nComplete provider result: "
        + f"[report](<{destination}>)\n",
    )
    assert report.read_bytes() == report_bytes
    probe(
        backend,
        outside,
        [],
        status=2,
        error=(
            "render-assessment: usage: render-assessment --assessment ABSOLUTE_FILE "
            "--provider-report ABSOLUTE_FILE\n"
        ),
    )
    probe(
        backend,
        outside,
        ["--assessment", str(assessment), "--provider-report", "relative.md"],
        status=2,
        error="render-assessment: provider-report requires an absolute path\n",
    )
    empty = fixture / "empty.md"
    empty.touch()
    probe(
        backend,
        outside,
        ["--assessment", str(empty), "--provider-report", str(report)],
        status=2,
        error="render-assessment: assessment is not a readable "
        + f"nonempty regular file: {empty}\n",
    )
    assert not (backend / ".venv").exists()


def main() -> None:
    plugin = Path(__file__).resolve().parents[4]
    with tempfile.TemporaryDirectory(prefix="darrow verify-change ") as temporary:
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
        backend = copy / "skills" / "verify-change" / "backend"
        installed_runtime(backend, fixture)
        validate(backend, fixture)
    print("verify-change fresh install passed")


if __name__ == "__main__":
    main()
