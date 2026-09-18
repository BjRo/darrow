from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from darrow_adaptive_delivery import claude, cli, common, preflight
from darrow_adaptive_delivery.common import PLUGIN, RefusalError, git, git_text
from darrow_adaptive_delivery.routes import FIELDS, parse_document


def invoke(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], *args: str
) -> tuple[int, str, str]:
    monkeypatch.setattr(sys, "argv", ["adaptive-delivery-preflight", *args])
    status = cli.preflight()
    output = capsys.readouterr()
    return status, output.out, output.err


def policy(repo: Path, **changes: object) -> Path:
    row: dict[str, object] = dict(
        zip(
            FIELDS,
            (
                "codex",
                "routine",
                "codex",
                "openai",
                "gpt-5.6-sol",
                "high",
                "none",
                "none",
            ),
            strict=True,
        )
    )
    row.update(changes)
    path = repo / ".darrow/config.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({"routes": [row]}))
    return path


def test_console_records_are_utf8_under_legacy_code_page(repo: Path) -> None:
    unicode_repo = repo.with_name("repository-é")
    repo.rename(unicode_repo)
    environment = {**os.environ, "PYTHONIOENCODING": "cp1252"}
    command = [
        sys.executable,
        "-c",
        "from darrow_adaptive_delivery.cli import preflight; raise SystemExit(preflight())",
    ]
    for target, status in ((unicode_repo, 0), (unicode_repo / "missing-é", 2)):
        result = subprocess.run(
            [*command, "prepare", "--repo", str(target), "--host", "codex"],
            capture_output=True,
            env=environment,
            check=False,
        )
        assert result.returncode == status
        output = result.stdout if status == 0 else result.stderr
        assert str(target) in output.decode("utf-8")
        assert b"\r\n" not in output


def test_prepared_records_and_unchanged_repository(repo: Path) -> None:
    before = git(repo, "status", "--porcelain=v1")
    output = preflight.run(["prepare", "--repo", str(repo), "--host", "codex"])
    assert output.startswith(
        f"format\tdarrow-native-goal-prepared-v2\nrepo\t{repo}\nbase_revision\t{git_text(repo, 'rev-parse', 'HEAD')}\nworking_tree\tclean\n"
    )
    assert (
        "route\troutine\tcodex\topenai\tgpt-5.6-terra\tmedium\nroute_policy_source\troutine\tbundled\n"
        in output
    )
    assert output.endswith(
        f"workflow\tmechanical\t{PLUGIN / 'skills/adaptive-delivery/references/workflows/mechanical.md'}\n"
    )
    assert git(repo, "status", "--porcelain=v1") == before
    (repo / "AGENTS.md").write_text("Instructions\n")
    (repo / "CLAUDE.md").write_text("Claude\n")
    output = preflight.run(["prepare", "--repo", str(repo), "--host", "claude"])
    assert (
        f"working_tree\tdirty\ninstruction\t{repo / 'AGENTS.md'}\ninstruction\t{repo / 'CLAUDE.md'}\n"
        in output
    )
    assert "route\troutine\tclaude\tanthropic\tclaude-sonnet-5\tlow\n" in output


def test_policy_provenance_and_explicit_precedence(repo: Path) -> None:
    args = ["route", "--repo", str(repo), "--host", "codex", "--profile", "routine"]
    output = preflight.run(args)
    assert (
        output
        == "format\tdarrow-native-goal-route-v2\nprofile\troutine\nselected_route\tcodex\topenai\tgpt-5.6-terra\tmedium\nroute_source\tpolicy\npolicy_route_source\tbundled\n"
    )
    path = policy(repo)
    assert "policy_route_source\trepository\n" in preflight.run(args)
    assert "selected_route\tcodex\topenai\tgpt-5.6-sol\thigh\n" in preflight.run(args)
    path.write_text("not json")
    assert (
        preflight.run([*args, "--route", "codex|openai|future-model.1|ultra"])
        == "format\tdarrow-native-goal-route-v2\nprofile\troutine\nselected_route\tcodex\topenai\tfuture-model.1\tultra\nroute_source\tuser\n"
    )


@pytest.mark.parametrize(
    "args,error",
    [
        ([], "usage:"),
        (["step"], "unknown command"),
        (["prepare"], "requires"),
        (["route"], "requires"),
        (["prepare", "--repo"], "missing value"),
        (["prepare", "--repo", ""], "missing value"),
        (["prepare", "--bad"], "unknown prepare option"),
        (["prepare", "--repo", ".", "--host", "other"], "unsupported host"),
    ],
)
def test_cli_refusals(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    args: list[str],
    error: str,
) -> None:
    status, out, err = invoke(monkeypatch, capsys, *args)
    assert (status, out) == (2, "")
    assert error in err


@pytest.mark.parametrize("option", ["-h", "--help", "help"])
def test_help(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], option: str
) -> None:
    assert invoke(monkeypatch, capsys, option) == (0, preflight.USAGE, "")


@pytest.mark.parametrize(
    "route,error",
    [
        ("a|b", "must be harness"),
        ("codex|openai||low", "must be harness"),
        ("codex|openai|safe|low|extra", "must be harness"),
        ("claude|anthropic|model|low", "current host"),
        ("codex|anthropic|safe|low", "provider"),
        ("codex|openai|none|low", "concrete safe model"),
        ("codex|openai|.unsafe|low", "concrete safe model"),
        ("codex|openai|model|impossible", "unsupported effort"),
        ("codex|openai|gpt-5.6-luna|medium", "not eligible"),
    ],
)
def test_explicit_route_refusals(repo: Path, route: str, error: str) -> None:
    with pytest.raises(RefusalError, match=error):
        preflight.run(
            [
                "route",
                "--repo",
                str(repo),
                "--host",
                "codex",
                "--profile",
                "routine",
                "--route",
                route,
            ]
        )


@pytest.mark.parametrize(
    "profile,error", [("invalid/name", "unsupported profile"), ("unknown", "no route")]
)
def test_profile_refusal(repo: Path, profile: str, error: str) -> None:
    with pytest.raises(RefusalError, match=error):
        preflight.run(
            ["route", "--repo", str(repo), "--host", "codex", "--profile", profile]
        )


@pytest.mark.parametrize(
    "changes,error",
    [
        ({"profile": "unknown"}, "not in bundled"),
        ({"model": "gpt-5.6-luna"}, "not eligible"),
        ({"provider": "anthropic"}, "provider does not match"),
    ],
)
def test_policy_refusal_before_evidence(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    changes: dict[str, object],
    error: str,
) -> None:
    policy(repo, **changes)
    status, out, err = invoke(
        monkeypatch, capsys, "prepare", "--repo", str(repo), "--host", "codex"
    )
    assert (status, out) == (2, "")
    assert error in err


def test_configuration_file_boundaries(repo: Path, tmp_path: Path) -> None:
    path = policy(repo)
    path.write_text("{bad")
    with pytest.raises(RefusalError, match="repository route configuration is invalid"):
        preflight.prepare(repo, "codex", PLUGIN)
    path.unlink()
    path.mkdir()
    with pytest.raises(RefusalError, match="unsafe"):
        preflight.prepare(repo, "codex", PLUGIN)
    path.rmdir()
    # Native Windows CI may not grant symlink creation; the symlink predicate is
    # also covered with a deterministic boundary test below.
    if os.name != "nt":
        path.symlink_to(tmp_path / "missing")
        with pytest.raises(RefusalError, match="unsafe"):
            preflight.prepare(repo, "codex", PLUGIN)


def test_symlink_policy_refusal(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    policy(repo)
    monkeypatch.setattr(Path, "is_symlink", lambda _path: True)
    with pytest.raises(RefusalError, match="unsafe"):
        preflight.prepare(repo, "codex", PLUGIN)


def test_git_binding_with_linked_worktree(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    linked = tmp_path / "linked repository"
    git(repo, "worktree", "add", "-qb", "linked", str(linked))
    nested = linked / "nested"
    nested.mkdir()
    policy(linked)
    for key in common.GIT_SELECTORS:
        monkeypatch.setenv(key, str(tmp_path / "foreign"))
    monkeypatch.setenv("GIT_CONFIG_KEY_0", "core.bare")
    monkeypatch.setenv("GIT_CONFIG_VALUE_0", "true")
    assert common.repository(str(nested)) == linked.resolve()
    assert f"repo\t{linked.resolve()}\n" in preflight.run(
        ["prepare", "--repo", str(nested), "--host", "codex"]
    )


def test_repository_refusals(repo: Path, tmp_path: Path) -> None:
    with pytest.raises(RefusalError, match="directory does not exist"):
        common.repository(str(tmp_path / "missing"))
    for path in (tmp_path, repo / ".git"):
        with pytest.raises(RefusalError, match="not a git working tree"):
            common.repository(str(path))


def test_failed_observations(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*args: object, **kwargs: object) -> bytes:
        raise OSError("Git unavailable")

    monkeypatch.setattr(common, "git", fail)
    with pytest.raises(RefusalError, match="not a git working tree"):
        common.repository(str(repo))
    with pytest.raises(RefusalError, match="cannot read repository revision"):
        preflight.prepare(repo, "codex", PLUGIN)


def test_missing_resources(repo: Path, tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    shutil.copytree(PLUGIN / "config", plugin / "config")
    with pytest.raises(RefusalError, match="workflow directory is missing"):
        preflight.prepare(repo, "codex", plugin)
    workflows = plugin / "skills/adaptive-delivery/references/workflows"
    workflows.mkdir(parents=True)
    with pytest.raises(RefusalError, match="workflow document is unreadable"):
        preflight.prepare(repo, "codex", plugin)
    (plugin / "config/routes.json").write_text(
        '{"routes":'
        + json.dumps(
            [
                dict(
                    zip(
                        FIELDS,
                        (
                            "claude",
                            "routine",
                            "claude",
                            "anthropic",
                            "claude-sonnet-5",
                            "low",
                            "none",
                            "none",
                        ),
                        strict=True,
                    )
                )
            ]
        )
        + "}"
    )
    with pytest.raises(RefusalError, match="no routes for host"):
        preflight.prepare(repo, "codex", plugin)


@pytest.mark.parametrize(
    "model,effort",
    [
        ("claude-sonnet-5", "low"),
        ("claude-sonnet-5", "medium"),
        ("claude-opus-5", "high"),
    ],
)
def test_claude_route(
    model: str,
    effort: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("CLAUDE_CODE_SUBAGENT_MODEL", model)
    monkeypatch.setenv("CLAUDE_CODE_EFFORT_LEVEL", effort)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "claude-agent-route",
            "--provider",
            "anthropic",
            "--model",
            model,
            "--effort",
            effort,
        ],
    )
    assert cli.claude_route() == 0
    output = capsys.readouterr().out
    name = f"adaptive-delivery-{model.removeprefix('claude-')}-{effort}"
    assert (
        output
        == f"format\tdarrow-claude-agent-route-v1\nselected_route\tclaude\tanthropic\t{model}\t{effort}\nsubagent_type\tdarrow-adaptive-delivery:{name}\nagent_file\t{PLUGIN / 'agents' / (name + '.md')}\n"
    )


@pytest.mark.parametrize(
    "key",
    [
        *claude.SELECTORS,
        "ANTHROPIC_BASE_URL",
        "CLAUDE_CODE_SUBAGENT_MODEL",
        "CLAUDE_CODE_EFFORT_LEVEL",
    ],
)
def test_claude_overrides(key: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(key, "other")
    with pytest.raises(RefusalError):
        claude.run(
            ["--provider", "anthropic", "--model", "claude-sonnet-5", "--effort", "low"]
        )


@pytest.mark.parametrize(
    "args,error",
    [
        ([], "required"),
        (["--other"], "unknown option"),
        (["--model"], "missing value"),
        (
            ["--provider", "other", "--model", "claude-sonnet-5", "--effort", "low"],
            "unsupported provider",
        ),
    ],
)
def test_claude_arguments(args: list[str], error: str) -> None:
    with pytest.raises(RefusalError, match=error):
        claude.run(args)
    assert claude.run(["--help"]) == claude.USAGE


@pytest.mark.parametrize(
    "model,effort,error",
    [
        ("sonnet", "low", "concrete Claude"),
        ("claude-", "low", "unsafe model"),
        ("claude-../bad", "low", "unsafe model"),
        ("claude-sonnet-5", "ultra", "unsupported effort"),
        ("claude-opus-5", "low", "no bundled runner"),
    ],
)
def test_claude_unsupported_routes(model: str, effort: str, error: str) -> None:
    with pytest.raises(RefusalError, match=error):
        claude.resolve(model, effort, PLUGIN, {})


@pytest.mark.parametrize("field", ["name", "model", "effort"])
def test_claude_runner_mismatch(tmp_path: Path, field: str) -> None:
    path = tmp_path / "agents/adaptive-delivery-sonnet-5-low.md"
    path.parent.mkdir()
    original = (PLUGIN / "agents" / path.name).read_text()
    path.write_text(
        "\n".join(
            line for line in original.splitlines() if not line.startswith(field + ":")
        )
    )
    with pytest.raises(RefusalError, match=f"runner {field} does not match"):
        claude.resolve("claude-sonnet-5", "low", tmp_path, {})


def test_console_executable(repo: Path) -> None:
    result = subprocess.run(
        [
            str(
                Path(sys.executable).parent
                / (
                    "adaptive-delivery-preflight.exe"
                    if os.name == "nt"
                    else "adaptive-delivery-preflight"
                )
            ),
            "prepare",
            "--repo",
            str(repo),
            "--host",
            "codex",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "darrow-native-goal-prepared-v2" in result.stdout


@pytest.mark.parametrize(
    "document",
    [
        "",
        "{",
        "[]",
        '{"extra":1}',
        '{"routes":[],"routes":[]}',
        '{"routes":{}}',
        '{"routes":[{}]}',
        '{"routes":[{"extra":"x"}]}',
        '{"routes":[{"host":"codex","host":"codex"}]}',
        '{"reviewers":NaN}',
        '{"reviewers":Infinity}',
        '{"reviewers":01}',
        '{"reviewers":true} trailing',
    ],
)
def test_invalid_documents(document: str) -> None:
    with pytest.raises(RefusalError):
        parse_document(document)


def test_route_document_shapes(repo: Path) -> None:
    assert (
        parse_document(
            '{"reviewers":{"ignored":[true,false,null,1.2e3,"\\u263a"],"ignored":2}}',
            True,
        )
        == []
    )
    assert parse_document('{"routes":[]}', True) == []
    for document in ("{}", '{"routes":[]}'):
        with pytest.raises(RefusalError):
            parse_document(document)
    path = policy(repo)
    row = json.loads(path.read_text())["routes"][0]
    with pytest.raises(RefusalError, match="duplicate route"):
        parse_document(json.dumps({"routes": [row, row]}))
    for value in (None, 3, "", "unsafe\tvalue"):
        row["model"] = value
        with pytest.raises(RefusalError, match="unsafe or empty model"):
            parse_document(json.dumps({"routes": [row]}))
