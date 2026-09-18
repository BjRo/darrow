"""Exercise every entrypoint from an independently copied runtime-only plugin."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def run(arguments: list[str], cwd: Path, expected: int = 0) -> str:
    result = subprocess.run(
        arguments,
        cwd=cwd,
        capture_output=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONUTF8": "1", "UV_NO_PROGRESS": "1"},
        check=False,
    )
    if result.returncode != expected:
        raise AssertionError(
            f"{arguments}: {result.returncode}\n{result.stdout}\n{result.stderr}"
        )
    return result.stdout


def verify(work: Path) -> None:
    source = Path(__file__).resolve().parents[2]
    plugin = work / "copied plugin ü 漢字"
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
            "coverage.json",
        ),
    )
    assert not (plugin / "bin/ia-doctor").exists()
    assert not list(plugin.glob("skills/*/scripts/*.sh"))
    project = plugin / "backend"
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
    run(
        [
            *command,
            "python",
            "-c",
            "import importlib.metadata as m; assert not m.requires('darrow-information-architecture'); assert not {'pytest','mypy','ruff','coverage','hypothesis'} & {d.metadata['Name'] for d in m.distributions()}",
        ],
        work,
    )
    repo = work / "native repository ü 漢字"
    repo.mkdir()
    run(["git", "init", "-q", str(repo)], work)
    exercise(command, repo, work)
    print(
        "fresh copied plugin: setup, inspect, verify, refusals, atomic updates passed; runtime dependencies only"
    )


def exercise(command: list[str], repo: Path, work: Path) -> None:
    guidance = repo / "AGENTS.md"
    guidance.write_bytes(b"# Root\r\nRead `docs/policy.md`.\r\n")
    (repo / "CLAUDE.md").write_bytes(b"@AGENTS.md\r\n")
    (repo / "docs").mkdir()
    assert "root:" in run([*command, "ia-setup", "inspect", str(repo)], work)
    assert "broken-reference" in run(
        [*command, "ia-doctor", "inspect", "--runtime", "both", str(repo)], work
    )
    run([*command, "ia-doctor", "verify", "--runtime", "both", str(repo)], work, 1)
    content = work / "content.txt"
    content.write_bytes(b"# Policy\n")
    assert "updated:" in run(
        [
            *command,
            "ia-write",
            "--expected",
            "missing",
            "--content-file",
            str(content),
            "docs/policy.md",
            str(repo),
        ],
        work,
    )
    assert "broken=0" in run(
        [*command, "ia-doctor", "verify", "--runtime", "both", str(repo)], work
    )
    run(
        [
            *command,
            "ia-write",
            "--expected",
            "missing",
            "--content-file",
            str(content),
            "docs/policy.md",
            str(repo),
        ],
        work,
        2,
    )
    run(
        [*command, "ia-doctor", "verify", "--mirror", "../escape=docs", str(repo)],
        work,
        64,
    )
    run([*command, "ia-setup", "inspect", str(repo / "missing")], work, 2)
    assert guidance.read_bytes().endswith(b"\r\n")
    assert not list(repo.rglob(".ia-*"))


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="darrow-ia-fresh-") as temporary:
        verify(Path(temporary).resolve())
