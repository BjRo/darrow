"""Filesystem failure boundaries, native path safety, and bounded output."""

import os
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from conftest import Repository, adr
from darrow_decisions import catalog, cli, paths, queries
from darrow_decisions import inventory as sources
from darrow_decisions.errors import DecisionError, Diagnostics
from darrow_decisions.model import CONTROL
from darrow_decisions.parser import parse
from darrow_decisions.relations import validate_relations


def test_repository_failures(repo: Repository) -> None:
    with pytest.raises(DecisionError, match="not a readable directory"):
        paths.resolve_root("")
    with pytest.raises(DecisionError, match="not a readable directory"):
        paths.resolve_root(str(repo.root / "missing"))
    with (
        patch(
            "darrow_decisions.paths.git",
            return_value=subprocess.CompletedProcess([], 1, b"", b""),
        ),
        pytest.raises(DecisionError, match="not a Git repository"),
    ):
        paths.resolve_root(str(repo.root))
    for stdout, message in [
        (b"invalid\n", "cannot resolve"),
        (b"worktree \n", "cannot resolve"),
        (b"worktree /unsafe\tpath\n", "control bytes"),
    ]:
        with (
            patch(
                "darrow_decisions.paths.git",
                return_value=subprocess.CompletedProcess([], 0, stdout, b""),
            ),
            pytest.raises(DecisionError, match=message),
        ):
            paths.resolve_root(str(repo.root))
    with (
        patch("darrow_decisions.paths.subprocess.run", side_effect=OSError("missing")),
        pytest.raises(DecisionError, match="cannot run Git"),
    ):
        paths.git(repo.root, "status")


def test_path_refusals(repo: Repository, tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    with pytest.raises(DecisionError, match="escapes"):
        paths.canonical(repo.root, str(outside), directory=True)
    with pytest.raises(DecisionError, match="does not exist"):
        paths.canonical(repo.root, "missing", directory=True)
    path = repo.write()
    with (
        patch("darrow_decisions.paths.os.access", return_value=False),
        pytest.raises(DecisionError, match="not readable"),
    ):
        paths.canonical(repo.root, str(path))
    (repo.root / "adrs").write_text("not a directory", encoding="utf-8")
    with pytest.raises(DecisionError, match="candidate is not a directory"):
        paths.select_directory(repo.root)


def test_symlink_components(repo: Repository) -> None:
    path = repo.write()
    link = repo.root / "link"
    try:
        link.symlink_to(repo.directory, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"native symlink privilege unavailable: {error}")
    for value in (f"link/{path.name}", "link/../decisions/" + path.name):
        with pytest.raises(DecisionError, match="symlinks are not allowed"):
            paths.canonical(repo.root, value)
    record_link = repo.directory / "ADR-0002-link.md"
    record_link.symlink_to(path)
    with pytest.raises(DecisionError, match="ADR symlinks are not allowed"):
        sources.inventory(repo.directory)


def test_enumeration_and_read_failures(repo: Repository) -> None:
    path = repo.write()
    with patch.object(Path, "iterdir", side_effect=OSError("injected")):
        with pytest.raises(DecisionError, match="cannot enumerate Markdown entries"):
            sources.inventory(repo.directory)
        with pytest.raises(
            DecisionError, match="cannot enumerate canonical specification"
        ):
            queries.surface_count(repo.directory)
    with patch.object(Path, "read_bytes", side_effect=OSError("injected")):
        with pytest.raises(DecisionError, match="cannot parse ADR file"):
            sources.inventory(repo.directory)
        with pytest.raises(DecisionError, match="cannot search ADR file"):
            paths.read_bytes(path, "cannot search ADR file")
    with (
        patch("darrow_decisions.inventory.os.access", return_value=False),
        pytest.raises(DecisionError, match="Markdown file is not readable"),
    ):
        sources.inventory(repo.directory)


def test_directory_occupied_by_record(repo: Repository) -> None:
    repo.directory.mkdir(parents=True)
    (repo.directory / "ADR-0001-test.md").mkdir()
    with pytest.raises(DecisionError, match="unsupported file type"):
        sources.inventory(repo.directory)


@pytest.mark.skipif(
    os.name == "nt", reason="Windows rejects C0 control characters in filenames"
)
def test_control_filename(repo: Repository) -> None:
    path = repo.write()
    path.rename(path.with_name("ADR-0001-\tunsafe.md"))
    with pytest.raises(DecisionError, match="1 ADR filename"):
        sources.inventory(repo.directory)


def test_surfaces(repo: Repository, capsys: pytest.CaptureFixture[str]) -> None:
    (repo.root / "docs/specs").mkdir(parents=True)
    (repo.root / "docs/specs/spec.md").write_text("# spec", encoding="utf-8")
    (repo.root / "specs").write_text("single surface", encoding="utf-8")
    (repo.root / "AGENTS.md").write_text("# policy", encoding="utf-8")
    queries.inspect(repo.root, None)
    out = capsys.readouterr().out
    assert f"{repo.root / 'docs/specs'} (1 Markdown files)" in out
    assert f"  - {repo.root / 'AGENTS.md'}" in out
    with (
        patch("darrow_decisions.queries.os.access", return_value=False),
        pytest.raises(
            DecisionError, match="canonical specification surface is not readable"
        ),
    ):
        queries.surfaces(repo.root, ("docs/specs",), "specification")


def test_exhaustion_and_late_collision(repo: Repository) -> None:
    path = repo.write("ADR-999999999999999999")
    with pytest.raises(DecisionError, match="space is exhausted"):
        queries.next_id(repo.directory, "")
    path.unlink()
    repo.write()
    target = repo.directory / "ADR-0002-title.md"

    def occupy(_: str) -> str:
        target.write_bytes(b"concurrent change")
        return "title"

    with (
        patch("darrow_decisions.queries.slugify", side_effect=occupy),
        pytest.raises(DecisionError, match="path is already occupied"),
    ):
        queries.next_id(repo.directory, "Title")
    assert target.read_bytes() == b"concurrent change"


def test_empty_directory_and_entrypoint(
    repo: Repository, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo.directory.mkdir(parents=True)
    assert cli.main(["validate", "--repo", str(repo.root)]) == 0
    monkeypatch.setattr(
        "sys.argv",
        ["darrow-decision", "check-transition", "--from", "Draft", "--to", "Accepted"],
    )
    with pytest.raises(SystemExit) as caught:
        cli.entrypoint()
    assert caught.value.code == 2


def test_missing_record_identifier_is_not_a_graph_vertex() -> None:
    record = parse(adr().replace("# ADR-0001: Use SQLite", "# Unknown")).record(
        Path("ADR-0001.md")
    )
    errors = Diagnostics()
    validate_relations([record], errors)
    assert errors.count == 0


@given(
    st.lists(
        st.sampled_from(["part", "space name", "é", ".", ".."]), min_size=1, max_size=10
    )
)
@settings(max_examples=50, derandomize=True)
def test_normalized_paths_never_escape_root(parts: list[str]) -> None:
    root = Path.cwd().resolve()
    value = root.joinpath(*parts)
    if value.resolve().is_relative_to(root):
        assert paths.contained(value, root, "record") == value.resolve()
    else:
        with pytest.raises(DecisionError, match="escapes"):
            paths.contained(value, root, "record")


@given(st.integers(min_value=0, max_value=127))
@settings(derandomize=True)
def test_control_classifier_matches_byte_contract(value: int) -> None:
    assert bool(CONTROL.search(chr(value))) == (value < 32 or value == 127)


def test_catalog_membership_safety(repo: Repository) -> None:
    repo.write()
    catalog.rebuild(repo.root, repo.directory)
    repo.commit()
    (repo.directory / "ADR-0002-test.md").mkdir()
    assert catalog.fresh(repo.root, repo.directory)[1] == "stale"


@given(
    st.text(alphabet="abcXYZ0123 -_", max_size=100),
    st.sampled_from([chr(value) for value in (*range(32), 127)]),
)
@settings(max_examples=60, derandomize=True)
def test_generated_unsafe_input_is_refused_without_echo(
    prefix: str, control: str
) -> None:
    import contextlib
    import io

    output = io.StringIO()
    with contextlib.redirect_stderr(output):
        assert cli.main(["list", "--search", prefix + control]) == 2
    assert output.getvalue() == "error: --search contains unsupported control bytes\n"
