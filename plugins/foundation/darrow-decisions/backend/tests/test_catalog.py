"""Derived-catalog round trips, trust boundaries, and atomic failure behavior."""

import os
import subprocess
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from conftest import Repository
from darrow_decisions import catalog, queries
from darrow_decisions.catalog_format import (
    CatalogRow,
    checksum,
    parse_relationships,
    render,
    target,
    untarget,
)
from darrow_decisions.catalog_parse import parse_catalog
from darrow_decisions.cli import main
from darrow_decisions.errors import DecisionError
from darrow_decisions.model import Record


@given(
    st.text(alphabet="abc é|\\[]<>&%?#()", min_size=1, max_size=50).filter(
        lambda text: bool(text.strip())
    )
)
@settings(max_examples=60, derandomize=True)
def test_catalog_metadata_roundtrip(value: str) -> None:
    value = value.strip()
    record = Record(
        "ADR-0001",
        value,
        "Accepted",
        "2026-09-18",
        value,
        "",
        "",
        value,
        Path("ADR-0001-safe.md"),
    )
    row = CatalogRow(record, "a" * 40, 0, 0)
    crc, length = checksum(row.signature())
    row = replace(row, crc=crc, size=length)
    restored = parse_catalog(render([row]), Path("."))
    assert restored == [row]
    assert restored[0].valid_checksum()
    assert untarget(target(value)) == value


@pytest.mark.parametrize(
    ("payload", "expected"), [(b"", 4294967295), (b"hello\n", 3015617425)]
)
def test_posix_checksum_vectors(payload: bytes, expected: int) -> None:
    assert checksum(payload) == (expected, len(payload))


def test_metadata_fast_path_and_body_search(repo: Repository) -> None:
    repo.write(body="A body-only quasar marker.")
    repo.write("ADR-0002", body="Unrelated content.")
    catalog.rebuild(repo.root, repo.directory)
    repo.commit()
    with patch(
        "darrow_decisions.inventory.parse", side_effect=AssertionError("body parsed")
    ):
        records, reason = catalog.fresh(repo.root, repo.directory)
        assert reason == ""
        assert len(records) == 2
        assert len(queries.list_inventory(repo.root, repo.directory, "")) == 2
    with patch(
        "darrow_decisions.inventory.parse",
        wraps=__import__("darrow_decisions.parser", fromlist=["parse"]).parse,
    ) as parser:
        assert main(["list", "--repo", str(repo.root), "--search", "quasar"]) == 0
        assert parser.call_count == 2


@pytest.mark.parametrize("index_flag", ["--assume-unchanged", "--skip-worktree"])
def test_index_flags_cannot_hide_catalog_mutation(
    repo: Repository, index_flag: str
) -> None:
    repo.write()
    catalog.rebuild(repo.root, repo.directory)
    repo.commit()
    repo.git("update-index", index_flag, "docs/decisions/README.md")
    path = repo.directory / "README.md"
    path.write_bytes(path.read_bytes() + b"\n")
    assert catalog.fresh(repo.root, repo.directory)[1] == "stale"


def test_filtered_git_blobs_cannot_hide_source_mutation(repo: Repository) -> None:
    path = repo.write()
    (repo.root / ".gitattributes").write_text(
        "docs/decisions/*.md -text\n", encoding="utf-8"
    )
    catalog.rebuild(repo.root, repo.directory)
    repo.commit()
    path.write_bytes(path.read_bytes().replace(b"Accepted", b"Rejected"))
    repo.git("update-index", "--assume-unchanged", "docs/decisions/" + path.name)
    assert catalog.fresh(repo.root, repo.directory)[1] == "stale"


@pytest.mark.parametrize(
    "mutation", ["prose", "row", "source", "membership", "invalid-source"]
)
def test_fallback_never_hides_bad_inputs(repo: Repository, mutation: str) -> None:
    path = repo.write()
    catalog_path = repo.directory / "README.md"
    catalog.rebuild(repo.root, repo.directory)
    if mutation == "membership":
        repo.write("ADR-0002")
    elif mutation == "invalid-source":
        path.write_bytes(b"# malformed\n")
    else:
        data = catalog_path.read_bytes()
        data = {
            "prose": data + b"injected\n",
            "row": data.replace(b"Use SQLite.", b"Use forged."),
            "source": data.replace(b"<!-- darrow-source:", b"<!-- invalid:"),
        }[mutation]
        catalog_path.write_bytes(data)
    repo.commit()
    assert catalog.fresh(repo.root, repo.directory)[1] in {"stale", "malformed"}
    expected = 4 if mutation == "invalid-source" else 0
    assert main(["list", "--repo", str(repo.root)]) == expected


def test_unreadable_and_unsupported_catalog(repo: Repository) -> None:
    repo.write()
    path = repo.directory / "README.md"
    path.mkdir()
    with pytest.raises(DecisionError, match="not a regular file"):
        catalog.rebuild(repo.root, repo.directory)
    assert catalog.fresh(repo.root, repo.directory)[1] == "malformed"
    path.rmdir()
    path.write_text("# Human guide\n", encoding="utf-8")
    with pytest.raises(DecisionError, match="refusing to replace"):
        catalog.rebuild(repo.root, repo.directory)
    assert path.read_text(encoding="utf-8") == "# Human guide\n"
    with patch("darrow_decisions.catalog.os.access", return_value=False):
        assert catalog.fresh(repo.root, repo.directory)[1] == "unreadable"
        with pytest.raises(DecisionError, match="not readable"):
            catalog.rebuild(repo.root, repo.directory)


def test_atomic_failure_preserves_original_and_cleans_temp(repo: Repository) -> None:
    repo.write()
    catalog.rebuild(repo.root, repo.directory)
    path = repo.directory / "README.md"
    original = path.read_bytes()
    with (
        patch("darrow_decisions.catalog.os.replace", side_effect=OSError("injected")),
        pytest.raises(DecisionError, match="cannot replace ADR catalog"),
    ):
        catalog.atomic_write(path, b"replacement")
    assert path.read_bytes() == original
    assert list(repo.directory.glob("README.md.tmp.*")) == []
    with (
        patch(
            "darrow_decisions.catalog.tempfile.NamedTemporaryFile",
            side_effect=OSError("injected"),
        ),
        pytest.raises(DecisionError, match="cannot create an atomic"),
    ):
        catalog.atomic_write(path, b"replacement")


def test_fingerprint_failure(repo: Repository) -> None:
    path = repo.write()
    with (
        patch(
            "darrow_decisions.catalog.git",
            return_value=subprocess.CompletedProcess([], 1, b"", b""),
        ),
        pytest.raises(DecisionError, match="cannot fingerprint"),
    ):
        catalog.fingerprint(repo.root, path)


@pytest.mark.parametrize(
    "value",
    [
        "Wrong: ADR-0001",
        "Supersedes: ",
        "Revisit when: ",
        "Supersedes: ADR-0001; Bad: x",
    ],
)
def test_invalid_catalog_relationships(value: str) -> None:
    with pytest.raises(ValueError, match="invalid relationships"):
        parse_relationships(value)


@pytest.mark.parametrize(
    "value",
    [
        "Supersedes: ADR-0001",
        "Superseded by: ADR-0002",
        "Supersedes: ADR-0001; Superseded by: ADR-0002; Revisit when: trigger",
    ],
)
def test_catalog_relationships(value: str) -> None:
    assert any(parse_relationships(value))


@pytest.mark.skipif(
    os.name == "nt", reason="Backslash is a native path separator on Windows"
)
def test_posix_filename_backslash(repo: Repository) -> None:
    path = repo.write()
    path.rename(path.with_name("ADR-0001-back\\slash-é.md"))
    catalog.rebuild(repo.root, repo.directory)
    repo.commit()
    assert catalog.fresh(repo.root, repo.directory)[1] == ""
