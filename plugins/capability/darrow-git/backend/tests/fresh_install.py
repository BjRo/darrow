"""Fresh copied-artifact validation on native Linux, macOS, and Windows."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str) -> str:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(
            f"{args[0]} exited {result.returncode}: {result.stdout}{result.stderr}"
        )
    return result.stdout


def runtime(backend: Path, cwd: Path, *args: str) -> str:
    return command(
        cwd,
        "uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        str(backend),
        *args,
    )


def repository(path: Path, remote: Path) -> None:
    path.mkdir()
    command(path, "git", "init", "-qb", "main")
    command(path, "git", "config", "user.name", "Fresh Fixture")
    command(path, "git", "config", "user.email", "fixture@example.test")
    command(path, "git", "config", "commit.gpgsign", "false")
    command(path, "git", "commit", "--allow-empty", "-qm", "chore: initialize")
    command(path, "git", "init", "--bare", "-q", str(remote))
    command(
        path, "git", "--git-dir", str(remote), "symbolic-ref", "HEAD", "refs/heads/main"
    )
    command(path, "git", "remote", "add", "origin", str(remote))
    command(path, "git", "push", "-qu", "origin", "main")
    command(path, "git", "remote", "set-head", "origin", "main")


def validate(copy: Path, fixture: Path) -> None:
    backend = copy / "backend"
    command(fixture, "uv", "sync", "--frozen", "--no-dev", "--project", str(backend))
    tree = command(
        fixture, "uv", "tree", "--frozen", "--no-dev", "--project", str(backend)
    )
    assert not any(
        tool in tree for tool in ("pytest", "ruff", "mypy", "hypothesis", "coverage")
    )
    repo = fixture / "repository with spaces"
    repository(repo, fixture / "remote.git")
    assert "mode: ready" in runtime(backend, repo, "darrow-create-branch", "inspect")
    assert "from main" in runtime(
        backend,
        repo,
        "darrow-create-branch",
        "create",
        "fix/181-python-git",
        "--ticket-token",
        "181",
    )
    assert "matches: 1" in runtime(
        backend, repo, "darrow-prepare-task-branch", "discover", "--ticket-token", "181"
    )
    assert "mode: current" in runtime(
        backend,
        repo,
        "darrow-prepare-task-branch",
        "prepare",
        "fix/181-python-git",
        "--ticket-token",
        "181",
    )
    (repo / "tracked.txt").write_text("fresh\n", encoding="utf-8")
    assert "fix: fresh candidate" in runtime(
        backend,
        repo,
        "darrow-create-commit",
        "commit",
        "-m",
        "fix: fresh candidate",
        "tracked.txt",
    )
    output = runtime(backend, repo, "python", str(backend / "tests" / "fresh_probe.py"))
    assert (
        "publication: verified" in output
        and "outcome: published" in output
        and "outcome: existing" in output
    )
    assert not command(repo, "git", "status", "--porcelain").strip()


def main() -> None:
    os.environ["GIT_CONFIG_GLOBAL"] = os.devnull
    os.environ["GIT_CONFIG_NOSYSTEM"] = "1"
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
    with tempfile.TemporaryDirectory(prefix="darrow git fresh ") as temporary:
        fixture = Path(temporary).resolve()
        copy = fixture / "plugin copy"
        shutil.copytree(plugin, copy, ignore=ignored)
        validate(copy, fixture)
    print("fresh copied Git plugin: all five workflows passed")


if __name__ == "__main__":
    main()
