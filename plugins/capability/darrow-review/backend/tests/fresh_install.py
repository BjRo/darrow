"""Exercise all seven entrypoints from a fresh runtime-only copied plugin."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )
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
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
        *args,
    )


def repository(path: Path) -> None:
    path.mkdir()
    command(path, "git", "init", "-qb", "main")
    command(path, "git", "config", "user.name", "Fresh fixture")
    command(path, "git", "config", "user.email", "fixture@example.invalid")
    command(path, "git", "config", "core.autocrlf", "false")
    (path / "tracked.txt").write_text("before\n", encoding="utf-8")
    command(path, "git", "add", ".")
    command(path, "git", "commit", "-qm", "fixture")
    (path / "tracked.txt").write_text("after\n", encoding="utf-8")
    (path / "untracked-é.txt").write_text("fresh\n", encoding="utf-8")


def field(text: str, name: str) -> str:
    return next(
        row.split("\t", 1)[1]
        for row in text.splitlines()
        if row.startswith(name + "\t")
    )


def verify_scope(backend: Path, repo: Path) -> None:
    packet = runtime(
        backend,
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        "HEAD",
        "--target",
        "WORKTREE",
    )
    manifest = field(packet, "manifest")
    shown = runtime(
        backend, repo.parent, "review-scope", "show", "--manifest", manifest
    )
    assert "+after" in shown and "+fresh" in shown
    shell = ["pwsh", "-NoProfile", "-Command"] if os.name == "nt" else ["bash", "-c"]
    assert command(repo.parent, *shell, field(packet, "show_command")) == shown
    artifact = Path(manifest).parent
    literal = (
        "Write-Output 'fresh check'" if os.name == "nt" else "printf 'fresh check\\n'"
    )
    runtime(
        backend,
        repo,
        "review-check",
        "run",
        "--output",
        str(artifact / "check.tsv"),
        "--command",
        literal,
    )
    check = next(
        line
        for line in (artifact / "check.tsv").read_text(encoding="utf-8").splitlines()
        if line.startswith("check\t")
    )
    records = runtime(backend, repo, "review-result", "scope-records", manifest)
    text = (
        "format\tdarrow-review-result-v1\n"
        + records
        + "standards\tpass\nstandards_source\tfixture\nspec\tnot_available\nspec_source\tnot_available\n"
        + check
        + "\nverdict\tpass\nrisk\tnone\nnext_action\treturn\n"
    )
    result = artifact / "result.tsv"
    result.write_text(text, encoding="utf-8", newline="\n")
    runtime(backend, repo, "review-result", "validate-scope", manifest, str(result))
    assert "# Code review — PASS" in runtime(
        backend, repo, "review-report", "render", str(result)
    )


def verify_routes(backend: Path, repo: Path) -> None:
    route = repo / ".git/route.tsv"
    runtime(
        backend,
        repo,
        "review-route",
        "select",
        "--repo",
        str(repo),
        "--host",
        "claude",
        "--record",
        str(route),
    )
    assert "claude-opus-5" in runtime(
        backend, repo, "review-route", "claude-agent", "--route-record", str(route)
    )
    assert "provider\tclaude\tanthropic" in runtime(
        backend, repo, "claude-provider", "observe-direct"
    )
    projects = repo.parent / "mock-provider/projects"
    slug = (
        re.sub(r"[^A-Za-z0-9]", "-", str(repo))
        if os.name == "nt"
        else str(repo).replace("/", "-")
    )
    transcript = projects / slug / "session/subagents/agent-fresh.jsonl"
    transcript.parent.mkdir(parents=True)
    transcript.write_text(
        json.dumps(
            {
                "type": "assistant",
                "agentId": "fresh",
                "effort": "xhigh",
                "message": {"role": "assistant", "model": "claude-opus-5"},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    observed = repo / ".git/observed.tsv"
    runtime(
        backend,
        repo,
        "review-claude-verify",
        "--repo",
        str(repo),
        "--agent-id",
        "fresh",
        "--projects-dir",
        str(projects),
        "--record",
        str(observed),
    )
    application = repo / ".git/application.tsv"
    runtime(
        backend,
        repo,
        "review-route",
        "confirm-claude",
        "--route-record",
        str(route),
        "--observed-record",
        str(observed),
        "--axis",
        "standards",
        "--application-record",
        str(application),
    )
    assert "route_bound\ttrue" in application.read_text(encoding="utf-8")


def validate(copy: Path, fixture: Path) -> None:
    backend = copy / "backend"
    assert not (copy / "bin").exists()
    packages = runtime(
        backend,
        fixture,
        "python",
        "-c",
        "import importlib.metadata as m; print('\\n'.join(d.metadata['Name'] or '' for d in m.distributions()))",
    )
    assert not any(
        tool in packages
        for tool in ("pytest", "ruff", "mypy", "hypothesis", "coverage")
    )
    repo = fixture / "repository ' with spaces"
    repository(repo)
    before = command(repo, "git", "status", "--porcelain=v1")
    verify_scope(backend, repo)
    verify_routes(backend, repo)
    assert command(repo, "git", "status", "--porcelain=v1") == before


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    for key in tuple(os.environ):
        if key.startswith(("GIT_", "CLAUDE_CODE_USE_")) or key == "ANTHROPIC_BASE_URL":
            del os.environ[key]
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
    with tempfile.TemporaryDirectory(prefix="darrow review fresh ") as temporary:
        fixture = Path(temporary).resolve()
        copy = fixture / "plugin ' copy"
        shutil.copytree(plugin, copy, ignore=ignored)
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copy)
        validate(copy, fixture)
        assert not list(copy.rglob(".venv"))
        assert not list(copy.rglob("__pycache__"))
        make_writable(copy)
    print(
        "fresh copied review plugin: all seven entrypoints passed; provider transcript mocked"
    )


if __name__ == "__main__":
    main()
