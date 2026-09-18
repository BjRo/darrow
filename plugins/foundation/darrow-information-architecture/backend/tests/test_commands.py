"""Native filesystem regression tests at the command boundary."""

import hashlib
import os
import subprocess
import sys
from pathlib import Path

import pytest

from darrow_ia import cli, updates
from darrow_ia.filesystem import existing, resolve_root


def write(root: Path, files: dict[str, str]) -> None:
    for name, content in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content.encode())


def invoke(
    root: Path, capsys: pytest.CaptureFixture[str], *args: str
) -> tuple[int, str]:
    status = cli.run(cli.doctor, [*args, str(root)])
    return status, capsys.readouterr().out


@pytest.mark.parametrize(
    ("files", "runtime", "status", "finding"),
    [
        ({}, "auto", 1, "missing-entrypoint | runtime=codex"),
        ({"AGENTS.md": "# Root\n"}, "auto", 0, "runtime=codex"),
        ({"CLAUDE.md": "# Root\n"}, "auto", 0, "runtime=claude"),
        (
            {"AGENTS.md": "# Root\n", "CLAUDE.md": "@AGENTS.md\n"},
            "auto",
            0,
            "runtime=both",
        ),
        (
            {
                "AGENTS.md": "Read `docs/a.md`.\n",
                "docs/a.md": "Read `docs/missing.md`.",
            },
            "codex",
            1,
            "broken-reference",
        ),
        (
            {"AGENTS.md": "Read `docs/a.md`.\n", "docs/a.md": "Read `AGENTS.md`."},
            "codex",
            1,
            "instruction-cycle",
        ),
        (
            {
                "AGENTS.md": "Read `docs/AGENTS.md`.",
                "docs/AGENTS.md": "Read `local.md`.",
                "docs/local.md": "# Local",
            },
            "codex",
            1,
            "nonroot-path",
        ),
        (
            {
                "AGENTS.md": "See `.agent-shared/rules/a.md`.",
                ".agent-shared/rules/a.md": "# Rule",
            },
            "codex",
            1,
            "unrouted-guidance",
        ),
        (
            {"AGENTS.md": "# Root", "src/AGENTS.md": "# Nested"},
            "codex",
            1,
            "unrouted-guidance",
        ),
        (
            {
                ".claude/CLAUDE.md": "# Root",
                "src/CLAUDE.md": "@local.md",
                "src/local.md": "# Local",
            },
            "claude",
            0,
            "routes=1",
        ),
        (
            {
                "CLAUDE.md": "# Root",
                "AGENTS.md": "Read `missing.md`.",
                "src/AGENTS.md": "Read `missing.md`.",
            },
            "claude",
            0,
            "broken=0",
        ),
        (
            {"AGENTS.md": "Read `missing.md`.", "AGENTS.override.md": "# Override"},
            "codex",
            0,
            "broken=0",
        ),
        (
            {
                "AGENTS.md": "Read `missing.md`.",
                "AGENTS.override.md": "Read `AGENTS.md`.",
            },
            "codex",
            1,
            "broken=1",
        ),
        (
            {"AGENTS.md": "# Root", ".claude/rules/all.md": "# Rule"},
            "codex",
            0,
            "always-loaded-rule",
        ),
        (
            {
                "CLAUDE.md": "# Root",
                ".claude/rules/all.md": 'paths: ["**"]\nRead `missing.md`.',
            },
            "claude",
            1,
            "always-loaded-rule",
        ),
        (
            {
                "CLAUDE.md": "# Root",
                ".claude/rules/api.md": 'paths: ["api/**"]\n# Rules',
            },
            "claude",
            0,
            "findings:\n  - none",
        ),
        (
            {"AGENTS.md": "# Shared", "CLAUDE.md": "# Shared"},
            "both",
            0,
            "duplicate-content",
        ),
        ({"AGENTS.md": "x" * 34000}, "codex", 1, "bytes=34000 limit=32768"),
        (
            {
                "AGENTS.md": "x" * 20,
                ".codex/config.toml": "project_doc_max_bytes = 10 # comment",
            },
            "codex",
            1,
            "bytes=20 limit=10",
        ),
        (
            {
                "AGENTS.md": "# Root",
                ".codex/config.toml": "project_doc_max_bytes = 'invalid'",
            },
            "codex",
            0,
            "unreadable=0",
        ),
        (
            {"AGENTS.md": "\ufeff```md\r\nRead `missing.md`.\r\n```\r\n"},
            "codex",
            0,
            "broken=0",
        ),
        (
            {
                "AGENTS.md": "Read `.agents/skills/check/SKILL.md`.",
                ".agents/skills/check/SKILL.md": "Read `references/a.md`.",
                ".agents/skills/check/references/a.md": "Read `references/b.md`.",
                ".agents/skills/check/references/b.md": "# Details",
            },
            "codex",
            0,
            "routes=3",
        ),
        (
            {
                "AGENTS.md": "Read `.agents/skills/check/SKILL.md`.",
                ".agents/skills/check/SKILL.md": "Read `references/a.md`.",
                "references/a.md": "# Root lookalike",
            },
            "codex",
            1,
            "broken=1",
        ),
        (
            {"CLAUDE.md": "@src/local.md", "local.md": "# Root lookalike"},
            "claude",
            1,
            "src/local.md",
        ),
    ],
)
def test_graph_cases(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    files: dict[str, str],
    runtime: str,
    status: int,
    finding: str,
) -> None:
    write(tmp_path, files)
    before = {path: path.read_bytes() for path in tmp_path.rglob("*") if path.is_file()}
    actual, output = invoke(tmp_path, capsys, "verify", "--runtime", runtime)
    assert (actual, finding in output) == (status, True), output
    assert before == {
        path: path.read_bytes() for path in tmp_path.rglob("*") if path.is_file()
    }
    assert invoke(tmp_path, capsys, "inspect", "--runtime", runtime)[0] == 0


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["wrong"],
        ["inspect", "--unknown"],
        ["verify", "--runtime", "other"],
        ["inspect", "a", "b"],
        ["inspect", "--mirror"],
        ["inspect", "--mirror", "invalid"],
        ["inspect", "--mirror", "../a=b"],
        ["inspect", "--mirror", "a=C:\\out"],
        ["inspect", "--mirror", "a=/out"],
    ],
)
def test_doctor_usage(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], args: list[str]
) -> None:
    assert cli.run(cli.doctor, [*args, str(tmp_path)]) == 64
    assert capsys.readouterr().err


def test_setup_inventory_and_limits(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    files = {f"src/{i}/AGENTS.md": "# Nested" for i in range(45)}
    files.update(
        {
            "AGENTS.md": "# Root",
            "package.json": "{}",
            ".github/workflows/ci.yml": "name: ci",
            ".agents/skills/a/SKILL.md": "# Skill",
            "docs/a.md": "# Docs",
            "rules/a.md": "# Rule",
            "agent-guidance/a.md": "# Agent",
            "lefthook.yml": "{}",
            "deep/a/b/c/package.json": "{}",
            "src/code.py": "pass",
            ".worktrees/a/AGENTS.md": "ignore",
            ".claude/worktrees/a/CLAUDE.md": "ignore",
            "node_modules/a/AGENTS.md": "ignore",
        }
    )
    write(tmp_path, files)
    assert cli.run(cli.setup_command, ["inspect", str(tmp_path)]) == 0
    output = capsys.readouterr().out
    for expected in (
        "runtime_adapters:",
        "skills:",
        "guidance_candidates:",
        "package.json",
        "lefthook.yml",
        "  - ...",
    ):
        assert expected in output
    assert "deep/a/b/c/package.json" not in output
    assert ".worktrees/a/AGENTS" not in output
    assert cli.run(cli.setup_command, ["verify", str(tmp_path)]) == 64


def link_or_skip(link: Path, target: Path, directory: bool = False) -> None:
    try:
        link.symlink_to(target, target_is_directory=directory)
    except OSError as error:
        if os.name == "nt":
            pytest.skip(f"native symlink privilege unavailable: {error}")
        raise


@pytest.mark.parametrize("reverse", [False, True])
def test_root_adapter(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], reverse: bool
) -> None:
    source, adapter = (
        ("CLAUDE.md", "AGENTS.md") if reverse else ("AGENTS.md", "CLAUDE.md")
    )
    write(tmp_path, {source: "# Shared\n"})
    link_or_skip(tmp_path / adapter, Path(source))
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "both")
    assert status == 0
    assert "status=symlink" in output and "duplicate-content" not in output
    assert "codex_root_bytes=9" in output and "claude_root_bytes=9" in output
    updates.replace(
        tmp_path, adapter, b"# Changed\n", updates.fingerprint(tmp_path / source)
    )
    assert (tmp_path / adapter).is_symlink()
    assert (tmp_path / source).read_bytes() == b"# Changed\n"


@pytest.mark.parametrize("target_kind", ["missing", "directory", "external", "loop"])
def test_bad_selected_adapter(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], target_kind: str
) -> None:
    targets = {
        "missing": tmp_path / "missing",
        "directory": tmp_path,
        "external": tmp_path.parent / (tmp_path.name + ".md"),
        "loop": tmp_path / "AGENTS.md",
    }
    target = targets[target_kind]
    if target_kind == "external":
        target.write_text("# Outside")
    link_or_skip(tmp_path / "AGENTS.md", target, target_kind == "directory")
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "codex")
    assert status == 1, output
    assert "unreadable-guidance" in output
    assert cli.run(cli.setup_command, ["inspect", str(tmp_path)]) == 2


@pytest.mark.parametrize(
    "difference", ["aligned", "content", "files", "missing", "broken-route"]
)
def test_mirrors(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], difference: str
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `left/a.md`.",
            "left/a.md": "# Policy",
            "right/a.md": "# Policy",
        },
    )
    if difference == "content":
        write(tmp_path, {"right/a.md": "# Changed"})
    if difference == "files":
        write(tmp_path, {"right/extra.md": "# Extra"})
    if difference == "missing":
        (tmp_path / "right/a.md").unlink()
        (tmp_path / "right").rmdir()
    if difference == "broken-route":
        write(
            tmp_path,
            {"left/a.md": "Read `missing.md`.", "right/a.md": "Read `missing.md`."},
        )
    status, output = invoke(tmp_path, capsys, "verify", "--mirror", "left=right")
    assert status == int(difference != "aligned"), output
    assert "declared=true" in output
    assert difference != "aligned" or "duplicate-content" not in output


def test_worktree_identity(tmp_path: Path) -> None:
    repo = tmp_path / "main ü with spaces"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "-c",
            "user.name=Test",
            "-c",
            "user.email=test@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "initial",
        ],
        check=True,
    )
    linked = tmp_path / "linked"
    subprocess.run(
        ["git", "-C", str(repo), "worktree", "add", "-qb", "task", str(linked)],
        check=True,
        capture_output=True,
    )
    assert resolve_root(str(linked)) == repo.resolve()
    nested = repo / "sub"
    nested.mkdir()
    assert resolve_root(str(nested)) == repo.resolve()


def test_missing_git_and_repository(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("PATH", "")
    assert resolve_root(str(tmp_path)) == tmp_path.resolve()
    assert cli.run(cli.doctor, ["inspect", str(tmp_path / "absent")]) == 2
    assert "not a readable directory" in capsys.readouterr().err


def test_case_and_absolute_routes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path, {"AGENTS.md": "Read `docs/Policy.md`.", "docs/policy.md": "# Policy"}
    )
    assert invoke(tmp_path, capsys, "verify")[0] == 1
    assert existing(tmp_path / "docs/Policy.md", tmp_path) is None
    write(tmp_path, {"AGENTS.md": f"Read `{tmp_path}/docs/policy.md`."})
    assert "nonroot-path" in invoke(tmp_path, capsys, "verify")[1]


def test_long_graph_and_caps(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    files = {"AGENTS.md": "Read `docs/0.md`."}
    files.update({f"docs/{i}.md": f"Read `docs/{i + 1}.md`." for i in range(150)})
    files.update({f"src/{i}/AGENTS.md": "# Nested" for i in range(45)})
    write(tmp_path, files)
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 1 and "docs/150.md" in output
    assert (
        "additional routes omitted" in output
        and "additional findings omitted" in output
    )


@pytest.mark.parametrize("newline", [b"\n", b"\r\n"])
@pytest.mark.parametrize("bom", [b"", b"\xef\xbb\xbf"])
def test_atomic_replacement(tmp_path: Path, newline: bytes, bom: bytes) -> None:
    path = tmp_path / "AGENTS.md"
    original = bom + b"# Before" + newline
    path.write_bytes(original)
    path.chmod(0o644)
    digest = hashlib.sha256(original).hexdigest()
    assert updates.replace(tmp_path, "AGENTS.md", b"# After\n", digest) == path
    assert path.read_bytes() == bom + b"# After" + newline
    with pytest.raises(ValueError, match="changed since approval"):
        updates.replace(tmp_path, "AGENTS.md", b"stale", digest)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["AGENTS.md"]


def test_atomic_failure_and_creation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    updates.replace(tmp_path, "AGENTS.md", b"original", "missing")

    def fail_replace(source: str, destination: Path) -> None:
        raise PermissionError("locked")

    monkeypatch.setattr(os, "replace", fail_replace)
    with pytest.raises(PermissionError, match="locked"):
        updates.replace(
            tmp_path, "AGENTS.md", b"new", updates.fingerprint(tmp_path / "AGENTS.md")
        )
    assert (tmp_path / "AGENTS.md").read_bytes() == b"original"
    assert len(list(tmp_path.iterdir())) == 1
    with pytest.raises(ValueError, match="stay inside"):
        updates.replace(tmp_path, "../escape.md", b"outside", "missing")


def test_public_entrypoints(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"AGENTS.md": "# Root", "content.txt": "# New"})
    monkeypatch.setattr(sys, "argv", ["ia-doctor", "verify", str(tmp_path)])
    with pytest.raises(SystemExit) as result:
        cli.doctor_entrypoint()
    assert result.value.code == 0
    monkeypatch.setattr(sys, "argv", ["ia-setup", "inspect", str(tmp_path)])
    with pytest.raises(SystemExit) as result:
        cli.setup_entrypoint()
    assert result.value.code == 0
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "ia-write",
            "--expected",
            updates.fingerprint(tmp_path / "AGENTS.md"),
            "--content-file",
            str(tmp_path / "content.txt"),
            "AGENTS.md",
            str(tmp_path),
        ],
    )
    with pytest.raises(SystemExit) as result:
        updates.entrypoint()
    assert result.value.code == 0
    assert f"updated: {tmp_path / 'AGENTS.md'}" in capsys.readouterr().out
