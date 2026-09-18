"""Exercise the copied plugin using only frozen runtime dependencies on each OS."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(cwd: Path, *args: str, expected: int = 0) -> str:
    result = subprocess.run(
        args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )
    if result.returncode != expected:
        raise RuntimeError(
            f"{args[0]} exited {result.returncode}: {result.stdout}{result.stderr}"
        )
    return result.stdout


def runtime(backend: Path, cwd: Path, *args: str, expected: int = 0) -> str:
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
        expected=expected,
    )


def repository(path: Path) -> None:
    path.mkdir()
    command(path, "git", "init", "-qb", "main")
    command(path, "git", "config", "user.name", "Fresh fixture")
    command(path, "git", "config", "user.email", "fixture@example.invalid")
    command(path, "git", "config", "core.autocrlf", "false")
    (path / "value.txt").write_bytes(b"before\n")
    command(path, "git", "add", ".")
    command(path, "git", "commit", "-qm", "fixture")


def routes(backend: Path, repo: Path) -> None:
    before = command(repo, "git", "status", "--porcelain=v1")
    for host in ("codex", "claude"):
        prepared = runtime(
            backend,
            repo,
            "adaptive-delivery-preflight",
            "prepare",
            "--repo",
            str(repo),
            "--host",
            host,
        )
        assert f"repo\t{repo.resolve()}\n" in prepared
        assert "working_tree\tclean\n" in prepared
        for profile in ("routine", "routine-plus", "scaled", "repo-wide", "judgment"):
            route = runtime(
                backend,
                repo,
                "adaptive-delivery-preflight",
                "route",
                "--repo",
                str(repo),
                "--host",
                host,
                "--profile",
                profile,
            )
            assert f"selected_route\t{host}\t" in route
            assert "policy_route_source\tbundled\n" in route
    for model, effort in (
        ("claude-sonnet-5", "low"),
        ("claude-sonnet-5", "medium"),
        ("claude-opus-5", "high"),
    ):
        assert "subagent_type\tdarrow-adaptive-delivery:" in runtime(
            backend,
            repo,
            "claude-agent-route",
            "--provider",
            "anthropic",
            "--model",
            model,
            "--effort",
            effort,
        )
    runtime(
        backend,
        repo,
        "claude-agent-route",
        "--provider",
        "anthropic",
        "--model",
        "claude-opus-5",
        "--effort",
        "low",
        expected=2,
    )
    assert command(repo, "git", "status", "--porcelain=v1") == before


def fixtures(plugin: Path, repo: Path) -> None:
    backend = plugin / "backend"
    fixture_dir = plugin / "skills/adaptive-delivery/evals/fixtures"
    (repo / ".readiness-verdict").write_text(
        "needs-decision-then-ready\n", encoding="utf-8"
    )
    runtime(
        backend,
        repo,
        "adaptive-delivery-fixture",
        "install",
        "readiness",
        str(repo),
        str(fixture_dir),
        "both",
    )
    installed = repo / ".agents/backend"
    for expected in ("needs-decision", "ready"):
        assert f"**Verdict:** `{expected}`" in runtime(
            installed, repo, "adaptive-delivery-fixture", "readiness", str(repo)
        )
    runtime(
        backend,
        repo,
        "adaptive-delivery-fixture",
        "install",
        "verification",
        str(repo),
        str(fixture_dir),
        "both",
    )
    candidate = repo / "src/config.js"
    candidate.parent.mkdir()
    candidate.write_bytes(
        b"export const TIMEOUT_MS = 2500;\nexport const RETRY_COUNT = 3;\nexport const CACHE_SIZE = 5;\n"
    )
    checksum = runtime(
        installed,
        repo,
        "python",
        "-c",
        "from pathlib import Path; from darrow_adaptive_delivery.fixtures.state import checksum; print(checksum(Path('src/config.js').read_bytes()))",
    )
    (repo / ".git/fixture-state/check-target").write_text(
        checksum, encoding="utf-8", newline="\n"
    )
    assert "Conclusion: clear\n" in runtime(
        installed,
        repo,
        "adaptive-delivery-fixture",
        "verification",
        str(repo),
        "initial",
    )
    assert "Conclusion: no-progress\n" in runtime(
        repo / ".claude/backend",
        repo,
        "adaptive-delivery-fixture",
        "verification",
        str(repo),
        "follow-up",
    )
    assert "WORKTREE@" in runtime(
        installed, repo, "adaptive-delivery-fixture", "review", str(repo), "fingerprint"
    )
    runtime(
        installed, repo, "adaptive-delivery-fixture", "proof", "current", expected=1
    )


def validate(plugin: Path, temporary: Path) -> None:
    backend = plugin / "backend"
    assert not (plugin / "bin").exists()
    command(temporary, "uv", "sync", "--frozen", "--no-dev", "--project", str(backend))
    tree = command(
        temporary, "uv", "tree", "--frozen", "--no-dev", "--project", str(backend)
    )
    assert not any(
        name in tree for name in ("pytest", "ruff", "mypy", "coverage", "hypothesis")
    )
    repo = temporary / "repository ' with spaces-é"
    repository(repo)
    routes(backend, repo)
    linked = temporary / "linked worktree-é"
    command(repo, "git", "worktree", "add", "-qb", "linked", str(linked))
    nested = linked / "nested"
    nested.mkdir()
    output = runtime(
        backend,
        temporary,
        "adaptive-delivery-preflight",
        "prepare",
        "--repo",
        str(nested),
        "--host",
        "codex",
    )
    assert f"repo\t{linked.resolve()}\n" in output
    fixtures(plugin, repo)


def main() -> None:
    for key in tuple(os.environ):
        if key.startswith(("GIT_", "CLAUDE_CODE_")) or key == "ANTHROPIC_BASE_URL":
            del os.environ[key]
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
    with tempfile.TemporaryDirectory(prefix="darrow adaptive fresh ") as directory:
        temporary = Path(directory).resolve()
        copied = temporary / "plugin ' copy-é"
        shutil.copytree(plugin, copied, ignore=ignored)
        validate(copied, temporary)
    print(
        "fresh copied adaptive-delivery: both host routes, linked worktree, readiness, review, verification, and proof refusal passed; native owner launch remains host-owned"
    )


if __name__ == "__main__":
    main()
