"""Execute every command from a fresh copied plugin using only runtime deps."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def run(args: list[str], cwd: Path, expected: int = 0) -> str:
    result = subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONUTF8": "1", "UV_NO_PROGRESS": "1"},
    )
    if result.returncode != expected:
        raise AssertionError(
            f"{args}: {result.returncode}\n{result.stdout}\n{result.stderr}"
        )
    return result.stdout


def verify(work: Path) -> None:
    source = Path(__file__).resolve().parents[2]
    plugin = work / "copied plugin ü"
    shutil.copytree(
        source,
        plugin,
        ignore=shutil.ignore_patterns(
            ".venv",
            "__pycache__",
            ".pytest_cache",
            ".mypy_cache",
            ".ruff_cache",
            ".hypothesis",
            ".coverage*",
        ),
    )
    assert not (plugin / "bin/decision").exists()
    project = plugin / "backend"
    repo = work / "native repository ü"
    repo.mkdir()
    run(["git", "init", "-q", str(repo)], work)
    command = [
        "uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        str(project),
    ]
    run(
        ["uv", "sync", "--quiet", "--frozen", "--no-dev", "--project", str(project)],
        work,
    )
    dependencies = run(
        [
            *command,
            "python",
            "-c",
            "import importlib.metadata as m; assert not m.requires('darrow-decisions'); "
            "assert not {'pytest','mypy','ruff','coverage','hypothesis'} & {d.metadata['Name'] for d in m.distributions()}; print('runtime-only')",
        ],
        work,
    )
    assert "runtime-only" in dependencies
    entry = [*command, "darrow-decision"]
    assert "Proposed -> Accepted: allowed" in run(
        [*entry, "check-transition", "--from", "Proposed", "--to", "Accepted"], work
    )
    assert "no ADR directory detected" in run(
        [*entry, "validate", "--repo", str(repo)], work
    )
    directory = repo / "docs/decisions"
    directory.mkdir(parents=True)
    record = directory / "ADR-0001-native.md"
    record.write_bytes(
        (
            "# ADR-0001: Native paths ü\n\nStatus: Accepted\nDate: 2026-09-18\n"
            "Summary: Preserve native paths.\n\n## Context\n\nNative hosts.\n"
            "\n## Decision\n\nUse native paths.\n\n## Consequences\n\nPortable.\n"
        ).encode()
    )
    verify_commands(entry, repo, record, work)
    print("fresh copied plugin: all commands passed; runtime dependencies only")


def verify_commands(entry: list[str], repo: Path, record: Path, work: Path) -> None:
    def invoke(*args: str, expected: int = 0) -> str:
        return run([*entry, *args, "--repo", str(repo)], work, expected)

    assert "adr-records: 1" in invoke("inspect")
    assert "total: 1" in invoke("list", "--search", "NATIVE PATHS")
    assert "id: ADR-0002" in invoke("next-id", "--title", "Second native choice")
    assert f"path: {record}" in invoke("canonical-path", "--path", str(record))
    assert "records: 1" in invoke("catalog", "rebuild")
    assert "records: 1" in invoke("catalog", "check")
    assert "valid: 1" in invoke("validate")
    catalog = record.parent / "README.md"
    original = catalog.read_bytes()
    invoke("catalog", "rebuild")
    assert catalog.read_bytes() == original
    record.write_bytes(record.read_bytes().replace(b"Accepted", b"Unknown"))
    invoke("catalog", "rebuild", expected=4)
    assert catalog.read_bytes() == original
    assert not list(record.parent.glob("README.md.tmp.*"))


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="darrow-decisions-fresh-") as temporary:
        verify(Path(temporary).resolve())
