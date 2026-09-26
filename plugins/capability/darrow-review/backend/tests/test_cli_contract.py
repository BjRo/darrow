"""Public exit codes and evidence, through the installed frozen entrypoints."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from darrow_review.common import entrypoint, serialize
from darrow_review.records import Records


def invoke(repo: Path, command: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        entrypoint(command, *args),
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )


def check_destination(repo: Path) -> Path:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    prepared = invoke(
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
    assert prepared.returncode == 0, prepared.stderr
    return Path(Records(prepared.stdout).value("manifest")).parent / "check.json"


@pytest.mark.parametrize(
    ("base", "extra", "code", "diagnostic"),
    [
        ("missing", [], 2, "invalid base"),
        ("HEAD", [], 3, "declared review scope is empty"),
        ("HEAD", ["--allow-empty"], 2, "valid only with --prior-manifest"),
    ],
)
def test_scope_exit_codes(
    repo: Path, base: str, extra: list[str], code: int, diagnostic: str
) -> None:
    process = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        base,
        "--target",
        "HEAD",
        *extra,
    )
    assert process.returncode == code
    assert diagnostic in process.stderr
    assert not process.stdout


@pytest.mark.parametrize("operation", ["scope-records", "original-findings"])
@pytest.mark.parametrize("kind", ["missing", "directory"])
def test_invalid_input_produces_no_partial_records(
    repo: Path, operation: str, kind: str
) -> None:
    source = repo / "missing" if kind == "missing" else repo
    process = invoke(repo, "review-result", operation, str(source))
    assert process.returncode != 0
    assert process.stderr
    assert not process.stdout


@pytest.mark.parametrize(
    ("code", "status"), [(0, "pass"), (1, "fail"), (127, "blocked")]
)
def test_check_capture_preserves_status_and_exit_code(
    repo: Path, code: int, status: str
) -> None:
    command = (
        f"Write-Output 'observed'; exit {code}"
        if os.name == "nt"
        else f"printf 'observed\\n'; exit {code}"
    )
    destination = check_destination(repo)
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    assert process.stdout == serialize({"check_record": str(destination)})
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.object("check") == {
        "command": command,
        "applicability": "applicable",
        "status": status,
        "evidence": f"exited {code}: observed{os.linesep}",
    }
    assert evidence.value("exit_code") == str(code)


def test_unavailable_command_retains_real_diagnostic(repo: Path) -> None:
    destination = check_destination(repo)
    command = "darrow-command-that-does-not-exist"
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.value("exit_code") == "127"
    check = evidence.object("check")
    assert check["command"] == command
    assert check["applicability"] == "applicable"
    assert check["status"] == "blocked"
    assert command in check["evidence"]


def test_review_state_lifecycle_commands(repo: Path) -> None:
    missing = invoke(
        repo, "review-scope", "locate", "--repo", str(repo), "--target", "unknown"
    )
    assert missing.returncode == 4
    assert "unavailable" in missing.stderr

    (repo / "file.txt").write_text("changed", encoding="utf-8")
    prepared = invoke(
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
    assert prepared.returncode == 0, prepared.stderr
    packet = Records(prepared.stdout)
    manifest = packet.value("manifest")
    located = invoke(
        repo,
        "review-scope",
        "locate",
        "--repo",
        str(repo),
        "--target",
        packet.value("target"),
    )
    assert located.stdout == serialize({"manifest": manifest})

    assert invoke(repo, "review-scope", "pin", "--manifest", manifest).returncode == 0
    pinned_prune = invoke(
        repo, "review-scope", "prune", "--all", "--older-than-days", "0"
    )
    assert pinned_prune.stdout == serialize({"pruned": "0", "removed": []})
    assert Path(manifest).exists()

    assert invoke(repo, "review-scope", "unpin", "--manifest", manifest).returncode == 0
    pruned = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert Records(pruned.stdout).value("pruned") == "1"
    assert not Path(manifest).exists()


def test_terminal_scope_has_private_artifact_directory(repo: Path) -> None:
    terminal = invoke(repo, "review-scope", "allocate-terminal", "--repo", str(repo))
    assert terminal.returncode == 0, terminal.stderr
    run = Path(Records(terminal.stdout).value("artifact_dir"))
    assert run.is_dir()
    assert run.parent.parent == Path(os.environ["DARROW_REVIEW_STATE_DIR"])
    assert not run.is_relative_to(repo)
    manifest = Records(terminal.stdout).value("manifest")
    assert manifest == str(run / "scope.json")
    assert invoke(repo, "review-scope", "pin", "--manifest", manifest).returncode == 0
    preserved = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert preserved.stdout == serialize({"pruned": "0", "removed": []})
    assert run.exists()
    assert invoke(repo, "review-scope", "unpin", "--manifest", manifest).returncode == 0
    pruned = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert Records(pruned.stdout).value("pruned") == "1"
    assert not run.exists()
