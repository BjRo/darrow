"""Portable command regressions carried over from the original shell suites."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from darrow_ia import cli
from test_commands import invoke, link_or_skip, write


@pytest.mark.parametrize("state", ["missing", "repaired", "cycle"])
def test_deferred_guidance_chain(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], state: str
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `docs/agent-guidance/map.md`.",
            "docs/agent-guidance/map.md": "Read `ordinary/map.md`.",
            "ordinary/map.md": "Read `docs/agent-guidance/end.md`.",
        },
    )
    if state != "missing":
        content = "Read `docs/agent-guidance/map.md`." if state == "cycle" else "# End"
        write(tmp_path, {"docs/agent-guidance/end.md": content})
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "codex")
    assert status == int(state != "repaired"), output
    assert ("instruction-cycle" in output) == (state == "cycle")
    assert ("broken-reference" in output) == (state == "missing")
    assert (
        f"{tmp_path / 'ordinary/map.md'} -> {tmp_path / 'docs/agent-guidance/end.md'}"
        in output
    )


@pytest.mark.parametrize("present", [False, True])
def test_arrow_rule_index(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], present: bool
) -> None:
    target = ".agent-shared/rules/api.md"
    write(tmp_path, {"AGENTS.md": f"- `apps/api/**` -> `{target}`"})
    if present:
        write(tmp_path, {target: "# API"})
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "codex")
    assert status == int(not present), output
    assert f"{tmp_path / 'AGENTS.md'} -> {tmp_path / target}" in output
    assert ("broken-reference" in output) != present
    assert "unrouted-guidance" not in output


@pytest.mark.parametrize(
    "example",
    [
        "```md\nRead `docs/missing.md`.\n```",
        "   ~~~~md\nRead `docs/missing.md`.\n   ~~~~",
        "```md\n```not-a-close\nRead `docs/missing.md`.\n```",
        "\ufeff```md\nRead `docs/missing.md`.\n```",
    ],
    ids=["backticks", "indented-tildes", "false-closing-fence", "bom"],
)
def test_fenced_examples_are_not_routes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], example: str
) -> None:
    write(tmp_path, {"AGENTS.md": example})
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0, output
    assert "missing.md" not in output
    assert "routes=0" in output


@pytest.mark.parametrize("present", [False, True])
def test_nested_native_import_ignores_root_lookalike(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], present: bool
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "# Root",
            "CLAUDE.md": "@AGENTS.md",
            "src/CLAUDE.md": "@local.md",
            "local.md": "Read `wrong-target.md`.",
        },
    )
    if present:
        write(tmp_path, {"src/local.md": "# Local policy"})
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "both")
    assert status == int(not present), output
    assert f"{tmp_path / 'CLAUDE.md'} -> {tmp_path / 'AGENTS.md'}" in output
    assert f"{tmp_path / 'src/CLAUDE.md'} -> {tmp_path / 'src/local.md'}" in output
    assert "wrong-target.md" not in output


@pytest.mark.parametrize("present", [False, True])
def test_skill_resources_ignore_root_lookalike(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], present: bool
) -> None:
    skill = ".agents/skills/check"
    write(
        tmp_path,
        {
            "AGENTS.md": f"Read `{skill}/SKILL.md`.",
            f"{skill}/SKILL.md": "Read `references/guide.md`.",
            f"{skill}/references/detail.md": "# Details",
            "references/guide.md": "Read `wrong-target.md`.",
        },
    )
    if present:
        write(
            tmp_path, {f"{skill}/references/guide.md": "Read `references/detail.md`."}
        )
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == int(not present), output
    assert (
        f"{tmp_path / skill / 'SKILL.md'} -> {tmp_path / skill / 'references/guide.md'}"
        in output
    )
    assert "wrong-target.md" not in output and "nonroot-path" not in output


@pytest.mark.parametrize(
    "runtime, imported, expected",
    [("claude", False, 0), ("both", False, 1), ("claude", True, 1)],
)
def test_imported_codex_defects_are_selected(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    runtime: str,
    imported: bool,
    expected: int,
) -> None:
    write(
        tmp_path,
        {
            "CLAUDE.md": "@AGENTS.md" if imported else "# Claude",
            "AGENTS.md": "Read `docs/codex-missing.md`.",
            "src/AGENTS.md": "Read `docs/nested-codex-missing.md`.",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", runtime)
    assert status == expected, output
    assert f"{tmp_path / 'AGENTS.md'} | scope=root" in output
    assert ("codex-missing.md" in output) == bool(expected)


@pytest.mark.parametrize("runtime, expected", [("codex", 0), ("claude", 1)])
def test_native_claude_defects_follow_selected_runtime(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], runtime: str, expected: int
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "# Root",
            "CLAUDE.md": "Read `docs/root-missing.md`.",
            "src/CLAUDE.md": "Read `docs/nested-missing.md`.",
            ".claude/rules/api.md": "Read `docs/native-missing.md`.",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", runtime)
    assert status == expected, output
    assert ("nested-missing.md" in output) == bool(expected)
    assert ("native-missing.md" in output) == bool(expected)


def test_unselected_broken_adapter_is_only_inventoried(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(tmp_path, {"AGENTS.md": "# Root"})
    link_or_skip(tmp_path / "CLAUDE.md", Path("missing.md"))
    assert invoke(tmp_path, capsys, "verify", "--runtime", "codex")[0] == 0
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "claude")
    assert status == 1
    assert (
        f"critical unreadable-guidance | {tmp_path / 'CLAUDE.md'} (broken symlink)"
        in output
    )


def test_incidental_relative_mention_is_not_a_route_error(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `docs/nested/AGENTS.md`.",
            "docs/nested/AGENTS.md": "See `local.md` for background.",
            "docs/nested/local.md": "# Background",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0 and "nonroot-path" not in output


def test_ordinary_route_cannot_escape_repository(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = tmp_path / "repo"
    write(
        tmp_path, {"outside.md": "# Outside", "repo/AGENTS.md": "Read `../outside.md`."}
    )
    status, output = invoke(root, capsys, "verify")
    assert status == 1
    assert f"critical broken-reference | {root / 'AGENTS.md'}" in output


def test_declared_mirror_dependencies_outside_selected_runtime(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "# Root",
            ".claude/rules/api.md": "Read `docs/policy.md`.",
            "mirror/api.md": "Read `docs/policy.md`.",
        },
    )
    args = ("verify", "--runtime", "codex", "--mirror", ".claude/rules=mirror")
    status, output = invoke(tmp_path, capsys, *args)
    assert status == 1
    assert (
        f"critical broken-reference | {tmp_path / '.claude/rules/api.md'} -> {tmp_path / 'docs/policy.md'}"
        in output
    )
    write(tmp_path, {"docs/policy.md": "# Policy"})
    assert invoke(tmp_path, capsys, *args)[0] == 0


def test_unsearchable_mirror_fails_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {"AGENTS.md": "# Root", "source/a.md": "# Rule", "target/a.md": "# Rule"},
    )
    access = os.access
    monkeypatch.setattr(
        os,
        "access",
        lambda path, mode: (
            False if Path(path) == tmp_path / "source" else access(path, mode)
        ),
    )
    status, output = invoke(tmp_path, capsys, "verify", "--mirror", "source=target")
    assert status == 1
    assert "critical adapter-drift" in output and "unsearchable" in output


def test_drifted_native_mirror_preserves_resident_rule_warning(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "# Root",
            ".agent-shared/rules/all.md": '---\npaths: ["**"]\n---\n# Shared',
            ".claude/rules/all.md": '---\npaths: ["**"]\n---\n# Different',
        },
    )
    status, output = invoke(
        tmp_path,
        capsys,
        "verify",
        "--runtime",
        "codex",
        "--mirror",
        ".agent-shared/rules=.claude/rules",
    )
    assert status == 1 and "critical adapter-drift" in output
    assert (
        f"advisory always-loaded-rule | {tmp_path / '.claude/rules/all.md'}" in output
    )


def test_shadowed_budget_and_unselected_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "x" * 34000,
            "AGENTS.override.md": "# Override",
            "CLAUDE.md": "# Claude",
        },
    )
    assert invoke(tmp_path, capsys, "verify", "--runtime", "codex")[0] == 0
    write(
        tmp_path,
        {
            "AGENTS.override.md": "x" * 1500,
            ".codex/config.toml": "project_doc_max_bytes = 1024 # limit",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "codex")
    assert status == 1 and "bytes=1500 limit=1024" in output
    access = os.access
    monkeypatch.setattr(
        os,
        "access",
        lambda path, mode: (
            False if Path(path).name == "config.toml" else access(path, mode)
        ),
    )
    status, output = invoke(tmp_path, capsys, "verify", "--runtime", "claude")
    assert (
        status == 0
        and "unreadable-guidance" not in output
        and "root-budget" not in output
    )


def test_duplicate_shared_guidance_is_reported(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    write(
        tmp_path,
        {
            "AGENTS.md": "Read `.agent-shared/rules/a.md` and `.agent-shared/rules/b.md`.",
            ".agent-shared/rules/a.md": "# Same",
            ".agent-shared/rules/b.md": "# Same",
        },
    )
    status, output = invoke(tmp_path, capsys, "verify")
    assert status == 0
    assert (
        f"advisory duplicate-content | {tmp_path / '.agent-shared/rules/a.md'} = {tmp_path / '.agent-shared/rules/b.md'}"
        in output
    )


@pytest.mark.parametrize("command", ["doctor", "setup"])
@pytest.mark.parametrize("separator", ["nul", "newline"])
def test_large_worktree_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    command: str,
    separator: str,
) -> None:
    write(tmp_path, {"AGENTS.md": "# Root"})
    nested = tmp_path / "nested"
    nested.mkdir()
    run = subprocess.run
    script = (
        "import os, sys; "
        "separator = b'\\0' if sys.argv[2] == 'nul' else b'\\n'; "
        "sys.stdout.buffer.write(os.fsencode(sys.argv[1]) + separator "
        "+ (b'HEAD ' + b'0' * 40 + b'\\n') * 9000)"
    )

    def git_output(
        args: list[str], *, capture_output: bool, check: bool
    ) -> subprocess.CompletedProcess[bytes]:
        assert args[0] == "git" and args[3:] == [
            "worktree",
            "list",
            "--porcelain",
            "-z",
        ]
        return run(
            [sys.executable, "-c", script, f"worktree {tmp_path}", separator],
            capture_output=capture_output,
            check=check,
        )

    monkeypatch.setattr(subprocess, "run", git_output)
    operation = cli.doctor if command == "doctor" else cli.setup_command
    assert cli.run(operation, ["inspect", str(nested)]) == 0
    assert f"root: {tmp_path}" in capsys.readouterr().out
