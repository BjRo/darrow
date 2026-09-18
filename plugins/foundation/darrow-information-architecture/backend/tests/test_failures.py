"""Fail-closed operating-system boundaries and parsing edge cases."""

import os
from pathlib import Path

import pytest

from darrow_ia import checks, filesystem, report, updates
from darrow_ia.graph import Audit, cycles
from darrow_ia.references import Reference, clean_reference, owning_skill, resolve
from test_commands import invoke, link_or_skip, write


def test_permission_errors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"AGENTS.md": "# Root", ".codex/config.toml": "# config"})
    real_access = os.access
    monkeypatch.setattr(
        os,
        "access",
        lambda path, mode: (
            False if Path(path).name == "config.toml" else real_access(path, mode)
        ),
    )
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 1 and "unreadable-guidance" in output
    monkeypatch.setattr(
        os,
        "access",
        lambda path, mode: (
            False if Path(path).name == "AGENTS.md" else real_access(path, mode)
        ),
    )
    assert invoke(tmp_path, capsys, "verify")[0] == 1
    audit = Audit(tmp_path, "codex")
    assert "unreadable" in report.file_record(tmp_path / "AGENTS.md", audit)


def test_traversal_failures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"left/a.md": "# Policy", "right/a.md": "# Policy"})

    def inaccessible(path: Path) -> dict[str, bytes]:
        raise PermissionError("cannot traverse")

    monkeypatch.setattr(checks, "mirror_files", inaccessible)
    assert (
        "traversal failed"
        in checks.compare_mirror(tmp_path / "left", tmp_path / "right")[0]
    )
    with pytest.raises(PermissionError):
        filesystem.raise_walk_error(PermissionError("denied"))
    monkeypatch.setattr(Path, "read_bytes", lambda self: b"\xff")
    assert filesystem.unreadable_reason(tmp_path / "left/a.md", tmp_path)


def test_external_and_broken_routes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"AGENTS.md": "Read `outside.md`.", "CLAUDE.md": "@outside.md"})
    outside = tmp_path.parent / (tmp_path.name + "-outside")
    outside.mkdir()
    write(outside, {"outside.md": "# External"})
    link_or_skip(tmp_path / "outside.md", outside / "outside.md")
    assert invoke(tmp_path, capsys, "verify", "--runtime", "codex")[0] == 1
    # Preserve native host imports outside repository verification scope.
    assert invoke(tmp_path, capsys, "verify", "--runtime", "claude")[0] == 0
    link_or_skip(tmp_path / "mirror", outside, True)
    with pytest.raises(ValueError, match="stay inside"):
        checks.mirror_paths("mirror=local", tmp_path)
    link_or_skip(tmp_path / "broken", tmp_path / "missing")
    with pytest.raises(ValueError, match="broken"):
        updates.destination(tmp_path, "broken")
    assert filesystem.existing(tmp_path / "outside.md", tmp_path) is None


def test_path_resolution_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    write(tmp_path, {"AGENTS.md": "# Root"})

    def fail(self: Path, strict: bool = False) -> Path:
        raise OSError("unreadable ancestor")

    monkeypatch.setattr(Path, "resolve", fail)
    assert filesystem.existing(tmp_path / "AGENTS.md", tmp_path) is None


def test_non_guidance_references(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `src/check.py`.\nSee `background.md`.\nRead `docs/a.md`.\nRead `docs/b.md`.",
            "src/check.py": "# Read `missing.md`.",
            "background.md": "Read `missing.md`.",
            "docs/a.md": "Read `shared.md`.",
            "docs/b.md": "Read `shared.md`.",
            "shared.md": "# Common",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0 and "broken=0" in output
    assert clean_reference("https://example.test/a.md") is None
    assert clean_reference("<variable/path.md>") == "variable/path.md"
    assert clean_reference("${ROOT}/a.md") is None
    assert clean_reference(" ") is None
    assert clean_reference("command") is None
    assert report.scope(".claude/rules/a.md") == "claude-native-rule"
    assert report.scope(".agents/rules/a.md") == "adapter-rule"
    assert report.scope("docs/a.md") == "referenced"
    assert (
        resolve(Reference("docs/a.md", True), tmp_path / "AGENTS.md", tmp_path).target
        == tmp_path / "docs/a.md"
    )


def test_cycle_depth_and_shared_nodes() -> None:
    edges = {(Path(str(index)), Path(str(index + 1))) for index in range(1500)}
    edges.add((Path("1500"), Path("0")))
    edges.add((Path("2"), Path("4")))
    assert len(cycles(edges)) == 1


def test_detect_change_during_staging(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    write(tmp_path, {"AGENTS.md": "# Original"})
    digest = updates.fingerprint(tmp_path / "AGENTS.md")
    original_fsync = os.fsync

    def concurrent_write(descriptor: int) -> None:
        (tmp_path / "AGENTS.md").write_bytes(b"concurrent edit")
        original_fsync(descriptor)

    monkeypatch.setattr(os, "fsync", concurrent_write)
    with pytest.raises(ValueError, match="changed since approval"):
        updates.replace(tmp_path, "AGENTS.md", b"replacement", digest)
    assert (tmp_path / "AGENTS.md").read_bytes() == b"concurrent edit"
    assert len(list(tmp_path.iterdir())) == 1


def test_parent_relative_native_and_skill_resources(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `.agents/skills/check/SKILL.md`.",
            "CLAUDE.md": "@.claude/../AGENTS.md",
            ".claude/CLAUDE.md": "@../AGENTS.md",
            ".agents/skills/check/SKILL.md": "Read `../../references/file-updates.md`.",
            ".agents/references/file-updates.md": "# Update contract",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "both")
    assert status == 0, output
    assert "routes=4" in output


@pytest.mark.parametrize("runtime, status", [("codex", 0), ("claude", 1), ("both", 1)])
def test_invalid_encoding_respects_runtime_scope(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], runtime: str, status: int
) -> None:
    write(
        tmp_path,
        {"AGENTS.md": "# Root", "CLAUDE.md": "# Claude", ".claude/rules/bad.md": ""},
    )
    (tmp_path / ".claude/rules/bad.md").write_bytes(b"\xff")
    actual, output = invoke(tmp_path, capsys, "verify", "--runtime", runtime)
    assert actual == status, output
    assert ("critical unreadable-guidance" in output) == bool(status)


def test_entrypoint_case_is_explicit(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"claude.md": "# Wrong spelling"})
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "claude")
    assert status == 1 and "missing-entrypoint" in output
    write(tmp_path, {"AGENTS.md": "# Root", "agents.override.md": "Read `missing.md`."})
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0 and "runtime=codex" in output


def test_binary_source_reference_is_not_parsed_as_guidance(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Before visual work, read `assets/logo.png`.",
            "assets/logo.png": "",
        },
    )
    (tmp_path / "assets/logo.png").write_bytes(b"\x89PNG\r\n\xff")
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0 and "unreadable=0" in output


def test_skill_owner_stops_at_filesystem_root(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Path, "is_file", lambda self: False)
    root = Path(Path.cwd().anchor)
    assert owning_skill(root / "AGENTS.md", root) is None
