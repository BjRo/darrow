"""Policy/explicit parity and repository isolation from the retired shell suite."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from darrow_adaptive_delivery import cli, common, preflight
from darrow_adaptive_delivery.common import git, git_text
from darrow_adaptive_delivery.routes import FIELDS


def write_policy(repo: Path, host: str, route: str, profile: str = "routine") -> None:
    path = repo / ".darrow/config.json"
    path.parent.mkdir(exist_ok=True)
    values = [host, profile, *route.split("|"), "none", "none"]
    path.write_text(json.dumps({"routes": [dict(zip(FIELDS, values, strict=True))]}))


def commands(repo: Path, host: str, route: str) -> list[list[str]]:
    shared = ["--repo", str(repo), "--host", host]
    selected = ["route", *shared, "--profile", "routine"]
    return [["prepare", *shared], selected, [*selected, "--route", route]]


@pytest.mark.parametrize(
    "host,route",
    [
        ("codex", "codex|anthropic|gpt-5.6-terra|medium"),
        ("claude", "claude|openai|claude-sonnet-5|low"),
        ("codex", "claude|anthropic|claude-sonnet-5|low"),
        ("claude", "codex|openai|gpt-5.6-terra|medium"),
        ("codex", "codex|openai|none|medium"),
        ("claude", "claude|anthropic|none|low"),
        ("codex", "codex|openai|gpt-5.6-terra|impossible"),
        ("claude", "claude|anthropic|claude-sonnet-5|none"),
        ("codex", "codex|openai|unsafe model|medium"),
        ("codex", "codex|openai|.unsafe|medium"),
        ("codex", "codex|openai||medium"),
        ("codex", "codex|openai|gpt-5.6-luna|medium"),
    ],
)
def test_policy_and_explicit_refuse_without_evidence(
    repo: Path,
    host: str,
    route: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    write_policy(repo, host, route)
    for args in commands(repo, host, route):
        monkeypatch.setattr(sys, "argv", ["adaptive-delivery-preflight", *args])
        assert cli.preflight() == 2
        captured = capsys.readouterr()
        assert captured.out == ""
        assert captured.err.startswith("adaptive-delivery-preflight:")


@pytest.mark.parametrize(
    "host,provider", [("codex", "openai"), ("claude", "anthropic")]
)
@pytest.mark.parametrize("effort", ["low", "medium", "high", "xhigh", "max", "ultra"])
def test_off_catalog_policy_and_explicit_routes(
    repo: Path, host: str, provider: str, effort: str
) -> None:
    route = f"{host}|{provider}|future-model.1|{effort}"
    write_policy(repo, host, route)
    prepared, policy, explicit = [
        preflight.run(args) for args in commands(repo, host, route)
    ]
    selected = route.replace("|", "\t") + "\n"
    assert "route\troutine\t" + selected in prepared
    assert "selected_route\t" + selected in policy
    assert "policy_route_source\trepository\n" in policy
    assert "selected_route\t" + selected in explicit
    assert "route_source\tuser\n" in explicit
    assert "policy_route_source" not in explicit


def test_override_preserves_other_bundled_profiles(repo: Path) -> None:
    write_policy(repo, "codex", "codex|openai|gpt-5.6-sol|high", "scaled")
    out = preflight.run(["prepare", "--repo", str(repo), "--host", "codex"])
    for profile, model, effort in (
        ("routine", "gpt-6-luna", "medium"),
        ("routine-plus", "gpt-6-luna", "high"),
        ("scaled", "gpt-5.6-sol", "high"),
        ("repo-wide", "gpt-5.6-sol", "high"),
        ("judgment", "gpt-6-astra", "high"),
    ):
        assert f"route\t{profile}\tcodex\topenai\t{model}\t{effort}\n" in out
    assert "route_policy_source\tscaled\trepository\n" in out
    assert "route_policy_source\troutine\tbundled\n" in out
    assert "preexisting_change" not in out


def selectors(foreign: Path, requested: Path) -> list[dict[str, str]]:
    metadata = foreign / ".git"
    config = foreign / "invalid-config"
    config.write_text("[invalid\n")
    return [
        {"GIT_DIR": str(metadata), "GIT_WORK_TREE": str(foreign)},
        {"GIT_DIR": str(metadata)},
        {"GIT_WORK_TREE": str(foreign)},
        {"GIT_COMMON_DIR": str(metadata)},
        {"GIT_INDEX_FILE": str(metadata / "index")},
        {
            "GIT_OBJECT_DIRECTORY": str(metadata / "objects"),
            "GIT_ALTERNATE_OBJECT_DIRECTORIES": str(foreign / "missing"),
        },
        {"GIT_CEILING_DIRECTORIES": str(requested)},
        {
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "core.worktree",
            "GIT_CONFIG_VALUE_0": str(foreign),
        },
        {"GIT_CONFIG_PARAMETERS": "'core.bare=true'"},
        {"GIT_CONFIG_GLOBAL": str(config)},
        {"GIT_CONFIG_SYSTEM": str(config)},
    ]


@pytest.mark.parametrize("linked", [False, True])
def test_ambient_selectors_cannot_supply_foreign_evidence(
    repo: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    linked: bool,
) -> None:
    foreign = tmp_path / "foreign repo"
    git(repo, "clone", "--quiet", str(repo), str(foreign))
    git(
        foreign,
        "-c",
        "user.name=Other",
        "-c",
        "user.email=other@example.invalid",
        "commit",
        "--allow-empty",
        "-qm",
        "Other",
    )
    requested = repo
    if linked:
        requested = tmp_path / "linked repo"
        git(repo, "worktree", "add", "-qb", "linked", str(requested))
    requested = requested.resolve()
    (requested / "nested").mkdir()
    (requested / "AGENTS.md").write_text("Requested repository instructions\n")
    write_policy(requested, "codex", "codex|openai|requested-model|medium")
    write_policy(foreign, "codex", "codex|openai|foreign-model|high")
    revision = git_text(requested, "rev-parse", "HEAD")
    for environment in selectors(foreign, requested):
        with monkeypatch.context() as context:
            for key, value in environment.items():
                context.setenv(key, value)
            prepared, selected, _ = [
                preflight.run(args)
                for args in commands(
                    requested / "nested", "codex", "codex|openai|requested-model|medium"
                )
            ]
        assert (
            f"repo\t{requested}\nbase_revision\t{revision}\nworking_tree\tdirty\n"
            in prepared
        )
        assert f"instruction\t{requested / 'AGENTS.md'}\n" in prepared
        assert "route\troutine\tcodex\topenai\trequested-model\tmedium\n" in prepared
        assert "selected_route\tcodex\topenai\trequested-model\tmedium\n" in selected


@pytest.mark.parametrize("failure", ["outside", "status"])
def test_failed_git_observation_emits_no_evidence(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    failure: str,
) -> None:
    original = common.git

    def observe(path: Path, *args: str) -> bytes:
        if failure == "outside" and "--is-inside-work-tree" in args:
            return b"false\n"
        if failure == "status" and "status" in args:
            raise OSError("status failed")
        return original(path, *args)

    monkeypatch.setattr(common, "git", observe)
    monkeypatch.setattr(
        sys, "argv", ["preflight", "prepare", "--repo", str(repo), "--host", "codex"]
    )
    assert cli.preflight() == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert (
        "not a git working tree"
        if failure == "outside"
        else "cannot read working tree state"
    ) in captured.err


def test_bare_repository_refusal(repo: Path, tmp_path: Path) -> None:
    bare = tmp_path / "bare.git"
    git(repo, "init", "--bare", "--quiet", str(bare))
    for args in commands(bare, "codex", "codex|openai|safe|medium")[:2]:
        with pytest.raises(common.RefusalError, match="not a git working tree"):
            preflight.run(args)


@pytest.mark.parametrize("command", ["step", "materialize-objective", "launch"])
def test_retired_commands_refused(command: str) -> None:
    with pytest.raises(common.RefusalError, match="unknown command"):
        preflight.run([command])
    assert command not in preflight.USAGE
