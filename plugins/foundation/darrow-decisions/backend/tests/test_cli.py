"""Commands, refusal codes, canonical scope, and read-only behavior."""

import itertools
from pathlib import Path

import pytest

from conftest import Repository
from darrow_decisions.arguments import USAGE
from darrow_decisions.cli import main
from darrow_decisions.model import STATUSES


def call(repo: Repository, *args: str) -> int:
    return main([*args, "--repo", str(repo.root)])


def test_empty_commands(repo: Repository, capsys: pytest.CaptureFixture[str]) -> None:
    assert call(repo, "inspect") == 0
    assert "adr-records: 0" in capsys.readouterr().out
    assert call(repo, "list") == 0
    assert (
        capsys.readouterr().out
        == "total: 0 (status=all, search=(none), related-to=(none))\n"
    )
    assert call(repo, "validate") == 0
    assert capsys.readouterr().out == "valid: 0 ADR(s); no ADR directory detected\n"
    for args in (("next-id",), ("catalog", "rebuild"), ("catalog", "check")):
        assert call(repo, *args) == 2
        assert "no ADR directory detected" in capsys.readouterr().err


def test_catalog_lifecycle(
    repo: Repository, capsys: pytest.CaptureFixture[str]
) -> None:
    path = repo.write()
    assert call(repo, "validate") == 4
    assert "catalog is missing" in capsys.readouterr().err
    assert call(repo, "catalog", "check") == 4
    assert call(repo, "catalog", "rebuild") == 0
    catalog = repo.directory / "README.md"
    before = catalog.read_bytes()
    assert call(repo, "catalog", "check") == 0
    assert call(repo, "validate") == 0
    assert call(repo, "catalog", "rebuild") == 0
    assert catalog.read_bytes() == before
    repo.commit()
    capsys.readouterr()
    assert call(repo, "list", "--status", "Accepted") == 0
    output = capsys.readouterr()
    assert output.err == ""
    assert f"ADR-0001 Accepted architecture — Use SQLite — {path}" in output.out
    assert repo.git("status", "--porcelain") == ""
    path.write_bytes(path.read_bytes() + b"\nbody-only QUASAR\n")
    assert call(repo, "list", "--search", "quasar") == 0
    output = capsys.readouterr()
    assert "stale; using full scan" in output.err
    assert "total: 1" in output.out
    assert call(repo, "catalog", "check") == 4
    assert "catalog is stale" in capsys.readouterr().err


@pytest.mark.parametrize(("old", "new"), itertools.product(STATUSES, repeat=2))
def test_all_transitions(
    old: str, new: str, capsys: pytest.CaptureFixture[str]
) -> None:
    valid = (old, new) in {
        ("Proposed", "Accepted"),
        ("Proposed", "Rejected"),
        ("Accepted", "Deprecated"),
        ("Accepted", "Superseded"),
    }
    assert main(["check-transition", "--from", old, "--to", new]) == (0 if valid else 3)
    out = capsys.readouterr()
    assert f"{old} -> {new}" in out.out + out.err


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["unknown"],
        ["catalog"],
        ["catalog", "unknown"],
        ["inspect", "--repo"],
        ["inspect", "--status", "Accepted"],
        ["list", "--title", "name"],
        ["canonical-path"],
        ["canonical-path", "--path", "x", "--dir", "docs"],
        ["check-transition", "--from", "Accepted"],
        ["check-transition", "--from", "", "--to", "Accepted"],
        ["inspect", "--unknown", "x"],
    ],
)
def test_usage(args: list[str], capsys: pytest.CaptureFixture[str]) -> None:
    assert main(args) == 2
    assert capsys.readouterr().err == USAGE + "\n"


@pytest.mark.parametrize(
    ("args", "message"),
    [
        (["list", "--status", "Draft"], "unsupported decision status: Draft"),
        (["list", "--related-to", "12"], "invalid related decision identifier"),
        (["list", "--related-to", "ADR-" + "1" * 19], "18-digit limit"),
        (["list", "--limit", "0"], "--limit must be an integer"),
        (["list", "--limit", "201"], "--limit must be an integer"),
        (["list", "--limit", "1000"], "--limit must be an integer"),
        (["list", "--limit", "x"], "--limit must be an integer"),
        (["list", "--search", "é" * 101], "--search must be at most 200 bytes"),
        (["next-id", "--title", "é" * 101], "--title must be at most 200 bytes"),
        (["next-id", "--title", "日本語"], "must contain an ASCII letter or digit"),
        (["canonical-path", "--path", "x" * 1001], "--path must be at most 1000 bytes"),
    ],
)
def test_invalid_options(
    repo: Repository, args: list[str], message: str, capsys: pytest.CaptureFixture[str]
) -> None:
    repo.directory.mkdir(parents=True)
    assert call(repo, *args) == 2
    assert message in capsys.readouterr().err


@pytest.mark.parametrize("value", ["\n", "\t", "\r", "\x1b", "\x7f"])
def test_control_input(
    repo: Repository, value: str, capsys: pytest.CaptureFixture[str]
) -> None:
    assert call(repo, "list", "--search", "secret" + value) == 2
    assert (
        capsys.readouterr().err
        == "error: --search contains unsupported control bytes\n"
    )


def test_filters_and_numbering(
    repo: Repository, capsys: pytest.CaptureFixture[str]
) -> None:
    repo.write("ADR-0001", status="Superseded", metadata="Superseded by: ADR-0002\n")
    repo.write("ADR-0002", metadata="Supersedes: ADR-0001\n")
    repo.write("ADR-0003", status="Proposed")
    assert call(repo, "list", "--related-to", "ADR-0001") == 0
    assert "supersedes: ADR-0001" in capsys.readouterr().out
    assert call(repo, "list", "--limit", "1") == 0
    assert "showing first 1 of 3" in capsys.readouterr().out
    assert call(repo, "list", "--status", "Rejected") == 0
    assert "total: 0" in capsys.readouterr().out
    assert call(repo, "list", "--search", "absent") == 0
    assert "total: 0" in capsys.readouterr().out
    assert call(repo, "next-id", "--title", "Use SQLITE & files") == 0
    assert (
        f"id: ADR-0004\npath: {repo.directory / 'ADR-0004-use-sqlite-files.md'}\n"
        == capsys.readouterr().out
    )
    assert call(repo, "next-id") == 0
    assert capsys.readouterr().out == "id: ADR-0004\n"


def test_canonical_scope(repo: Repository, capsys: pytest.CaptureFixture[str]) -> None:
    path = repo.write()
    assert (
        call(repo, "canonical-path", "--path", "docs/../docs/decisions/" + path.name)
        == 0
    )
    assert capsys.readouterr().out == f"path: {path}\n"
    assert call(repo, "canonical-path", "--path", str(path)) == 0
    assert call(repo, "canonical-path", "--path", "missing") == 2
    assert call(repo, "canonical-path", "--path", "") == 2
    capsys.readouterr()
    (repo.root / "adrs").mkdir()
    assert call(repo, "inspect") == 3
    assert "multiple ADR directories found" in capsys.readouterr().err
    assert call(repo, "inspect", "--dir", "docs/decisions") == 0


def test_primary_worktree(
    repo: Repository, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    repo.write()
    repo.commit()
    linked = tmp_path / "linked"
    repo.git("worktree", "add", "-qb", "linked", str(linked))
    assert main(["inspect", "--repo", str(linked)]) == 0
    assert f"root: {repo.root}" in capsys.readouterr().out
