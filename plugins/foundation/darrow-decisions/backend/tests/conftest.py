"""Real temporary repositories; mutations are confined to each fixture."""

import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest


def adr(
    identifier: str = "ADR-0001",
    title: str = "Use SQLite",
    status: str = "Accepted",
    metadata: str = "",
    body: str = "The choice is explicit.",
) -> str:
    return (
        f"# {identifier}: {title}\n\nStatus: {status}\nDate: 2026-07-19\n"
        f"Summary: {title}.\n{metadata}\n## Context\n\nContext.\n"
        f"\n## Decision\n\n{body}\n\n## Consequences\n\nConsequences.\n"
    )


@dataclass
class Repository:
    root: Path

    @property
    def directory(self) -> Path:
        return self.root / "docs/decisions"

    def git(self, *args: str) -> str:
        return subprocess.run(
            ["git", "-C", str(self.root), *args],
            check=True,
            capture_output=True,
            encoding="utf-8",
        ).stdout

    def write(self, identifier: str = "ADR-0001", **kwargs: str) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{identifier}-test.md"
        path.write_bytes(adr(identifier, **kwargs).encode("utf-8"))
        return path

    def commit(self) -> None:
        self.git("add", ".")
        self.git("commit", "-qm", "test: record fixture")


@pytest.fixture
def repo(tmp_path: Path) -> Repository:
    root = tmp_path.resolve() / "repository with spaces"
    root.mkdir()
    result = Repository(root)
    result.git("init", "-q", "-b", "main")
    result.git("config", "user.name", "Fixture")
    result.git("config", "user.email", "fixture@example.invalid")
    result.git("config", "core.autocrlf", "false")
    return result
