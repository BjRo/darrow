"""Public exit codes and evidence, through the installed frozen entrypoints."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from darrow_review.common import entrypoint
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
    destination = repo / ".git/check.tsv"
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    assert process.stdout == f"check_record\t{destination}\n"
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.get("check") == [
        ["check", command, "applicable", status, f"exited {code}: observed"]
    ]
    assert evidence.value("exit_code") == str(code)


def test_unavailable_command_retains_real_diagnostic(repo: Path) -> None:
    destination = repo / ".git/check.tsv"
    command = "darrow-command-that-does-not-exist"
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.value("exit_code") == "127"
    check = evidence.get("check")[0]
    assert check[1:4] == [command, "applicable", "blocked"]
    assert command in check[4]
