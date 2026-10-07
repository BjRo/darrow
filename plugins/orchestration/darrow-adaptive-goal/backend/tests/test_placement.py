"""Placement compares routes; observation reads only the active session route."""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import pytest

from darrow_adaptive_goal import cli, placement, preflight
from darrow_adaptive_goal.common import PLUGIN
from darrow_adaptive_goal.routes import FIELDS, catalog

LUNA_MEDIUM = "codex|openai|gpt-6-luna|medium"
THREAD = "01aa-thread"
SESSION = "5b0e-session"


def place(repo: Path, host: str, selected: str, main: str | None = None) -> str:
    args = ["placement", "--repo", str(repo), "--host", host]
    args += ["--selected-route", selected]
    if main is not None:
        args += ["--main-route", main]
    return preflight.run(args)


def fields(output: str) -> dict[str, str]:
    return dict(line.split("\t", 1) for line in output.splitlines())


def relation(repo: Path, selected: str, main: str, host: str = "codex") -> str:
    return fields(place(repo, host, selected, main))["route_relation"]


@pytest.mark.parametrize(
    "selected,main,expected",
    [
        (LUNA_MEDIUM, LUNA_MEDIUM, "same"),
        ("codex|openai|gpt-6-luna|low", LUNA_MEDIUM, "lower"),
        ("codex|openai|gpt-6-luna|high", LUNA_MEDIUM, "higher"),
        ("codex|openai|gpt-6.1-sol|medium", LUNA_MEDIUM, "higher"),
        ("codex|openai|gpt-6-astra|high", "codex|openai|gpt-6.1-sol|medium", "higher"),
        (LUNA_MEDIUM, "codex|openai|gpt-6.1-sol|medium", "lower"),
        (LUNA_MEDIUM, "codex|openai|gpt-6.1-sol|low", "unknown"),
        ("codex|openai|gpt-6.1-sol|low", LUNA_MEDIUM, "unknown"),
        ("codex|openai|future-model|medium", LUNA_MEDIUM, "unknown"),
        (LUNA_MEDIUM, "codex|openai|future-model|high", "unknown"),
    ],
)
def test_codex_relation(repo: Path, selected: str, main: str, expected: str) -> None:
    assert relation(repo, selected, main) == expected


@pytest.mark.parametrize(
    "selected,main,expected",
    [
        ("claude-sonnet-5-5|low", "claude-opus-5-5|high", "lower"),
        ("claude-opus-5-5|high", "claude-opus-5-5|high", "same"),
        ("claude-opus-5-5|high", "claude-sonnet-5-5|medium", "higher"),
        ("claude-opus-5-5|high", "claude-opus-5-5|medium", "higher"),
        ("claude-sonnet-5-5|medium", "claude-fable-5-1|high", "unknown"),
    ],
)
def test_claude_relation(repo: Path, selected: str, main: str, expected: str) -> None:
    prefix = "claude|anthropic|"
    assert relation(repo, prefix + selected, prefix + main, "claude") == expected


def test_explicit_main_route_report(repo: Path) -> None:
    output = place(repo, "codex", LUNA_MEDIUM, "codex|openai|gpt-6.1-sol|medium")
    assert output == (
        "format\tdarrow-native-goal-placement-v1\n"
        "selected_route\tcodex\topenai\tgpt-6-luna\tmedium\n"
        "main_route\tcodex\topenai\tgpt-6.1-sol\tmedium\n"
        "main_route_source\tuser\n"
        "route_relation\tlower\n"
    )


def test_repository_policy_ranks_models(repo: Path) -> None:
    rows = [
        dict(zip(FIELDS, values, strict=True))
        for values in (
            ("codex", "routine", "codex", "openai", "tiny", "medium", "none", "none"),
            (
                "codex",
                "judgment",
                "codex",
                "openai",
                "gpt-6-luna",
                "high",
                *["none"] * 2,
            ),
        )
    ]
    (repo / ".darrow").mkdir()
    (repo / ".darrow/config.json").write_text(json.dumps({"routes": rows}))
    assert relation(repo, "codex|openai|tiny|medium", LUNA_MEDIUM) == "lower"


def test_model_rank_uses_first_profile_and_ignores_other_profiles(repo: Path) -> None:
    routes = catalog(repo, PLUGIN)
    assert placement.model_rank("gpt-6.1-sol", routes) == 2
    assert placement.model_rank("absent", routes) is None
    foreign = replace(routes[0], profile="experimental")
    assert placement.model_rank(routes[0].model, [foreign]) is None


def test_missing_session_reports_unknown(repo: Path) -> None:
    assert fields(place(repo, "codex", LUNA_MEDIUM)) == {
        "format": "darrow-native-goal-placement-v1",
        "selected_route": "codex\topenai\tgpt-6-luna\tmedium",
        "main_route": "unknown",
        "main_route_source": "unknown",
        "route_relation": "unknown",
    }


def codex_session(
    root: Path, monkeypatch: pytest.MonkeyPatch, *lines: object, name: str = THREAD
) -> None:
    directory = root / "sessions/2026/10/07"
    directory.mkdir(parents=True, exist_ok=True)
    text = "".join(
        (line if isinstance(line, str) else json.dumps(line)) + "\n" for line in lines
    )
    (directory / f"rollout-2026-10-07T00-00-00-{name}.jsonl").write_text(text)
    monkeypatch.setenv("CODEX_HOME", str(root))
    monkeypatch.setenv("CODEX_THREAD_ID", THREAD)


def turn(model: str, effort: str) -> dict[str, object]:
    return {"type": "turn_context", "payload": {"model": model, "effort": effort}}


def test_codex_session_uses_latest_turn_context(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    codex_session(
        tmp_path / "codex",
        monkeypatch,
        {"type": "session_meta", "payload": {"model_provider": "openai"}},
        turn("gpt-6-astra", "high"),
        "not json",
        [1, 2],
        {"type": "turn_context", "payload": "malformed"},
        turn("gpt-6.1-sol", "medium"),
    )
    report = fields(place(repo, "codex", LUNA_MEDIUM))
    assert report["main_route"] == "codex\topenai\tgpt-6.1-sol\tmedium"
    assert report["main_route_source"] == "session"
    assert report["route_relation"] == "lower"


@pytest.mark.parametrize(
    "lines",
    [
        (turn("gpt-6.1-sol", "unsupported"),),
        (turn("none", "medium"),),
        (turn("unsafe model", "medium"),),
        (),
    ],
)
def test_codex_partial_route_is_unknown(
    repo: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    lines: tuple[object, ...],
) -> None:
    codex_session(tmp_path / "codex", monkeypatch, *lines)
    assert fields(place(repo, "codex", LUNA_MEDIUM))["main_route"] == "unknown"


def test_ambiguous_or_unreadable_session_is_unknown(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "codex"
    codex_session(root, monkeypatch, turn("gpt-6-luna", "medium"))
    later = root / "sessions/2026/10/08"
    later.mkdir(parents=True)
    (later / f"rollout-2026-10-08T00-00-00-{THREAD}.jsonl").write_text("")
    assert fields(place(repo, "codex", LUNA_MEDIUM))["main_route"] == "unknown"
    for path in root.rglob("*.jsonl"):
        path.unlink()
    (later / f"rollout-2026-10-08T00-00-00-{THREAD}.jsonl").mkdir()
    assert fields(place(repo, "codex", LUNA_MEDIUM))["main_route"] == "unknown"
    assert placement.session_file(tmp_path / "absent", "*.jsonl") is None


def test_session_glob_error_is_unknown(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(self: Path, pattern: str) -> list[Path]:
        raise OSError("denied")

    monkeypatch.setattr(Path, "glob", refuse)
    assert placement.session_file(tmp_path, "*.jsonl") is None


def test_undecodable_session_is_unknown(tmp_path: Path) -> None:
    path = tmp_path / "session.jsonl"
    path.write_bytes(b"\xff\xfe\n")
    assert list(placement.json_records(path)) == []


def test_default_codex_home(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    codex_session(tmp_path / ".codex", monkeypatch, turn("gpt-6-luna", "medium"))
    monkeypatch.delenv("CODEX_HOME")
    assert fields(place(repo, "codex", LUNA_MEDIUM))["route_relation"] == "same"


def claude_session(root: Path, *items: object) -> None:
    directory = root / "projects/-repo"
    directory.mkdir(parents=True)
    text = "".join(json.dumps(item) + "\n" for item in items)
    (directory / f"{SESSION}.jsonl").write_text(text)


def assistant(model: str) -> dict[str, object]:
    return {"type": "assistant", "message": {"model": model, "content": "private"}}


def test_claude_session_model_and_effort(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "claude"
    claude_session(
        root,
        {"type": "user", "message": {"content": "secret"}},
        assistant("claude-sonnet-5-5"),
        {"type": "assistant", "message": "malformed"},
        assistant("claude-opus-5-5"),
    )
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(root))
    monkeypatch.setenv("CLAUDE_CODE_SESSION_ID", SESSION)
    monkeypatch.setenv("CLAUDE_EFFORT", "high")
    output = place(repo, "claude", "claude|anthropic|claude-sonnet-5-5|low")
    assert "secret" not in output
    assert "private" not in output
    report = fields(output)
    assert report["main_route"] == "claude\tanthropic\tclaude-opus-5-5\thigh"
    assert report["route_relation"] == "lower"
    monkeypatch.delenv("CLAUDE_EFFORT")
    assert fields(place(repo, "claude", "claude|anthropic|claude-opus-5-5|high")) == {
        **report,
        "selected_route": "claude\tanthropic\tclaude-opus-5-5\thigh",
        "main_route": "unknown",
        "main_route_source": "unknown",
        "route_relation": "unknown",
    }


@pytest.mark.parametrize(
    "args,message",
    [
        ([], "placement requires --repo, --host, and --selected-route"),
        (["--selected-route", "codex|openai|gpt-6-luna"], "--selected-route must be"),
        (["--selected-route", "claude|anthropic|claude-opus-5-5|high"], "current host"),
        (
            ["--selected-route", LUNA_MEDIUM, "--main-route", "codex|openai|x|huge"],
            "main route has unsupported effort",
        ),
        (
            ["--selected-route", LUNA_MEDIUM, "--profile", "routine"],
            "unknown placement",
        ),
    ],
)
def test_placement_refusals(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    args: list[str],
    message: str,
) -> None:
    command = ["placement", "--repo", str(repo), "--host", "codex", *args]
    monkeypatch.setattr(sys, "argv", ["adaptive-goal-preflight", *command])
    assert cli.preflight() == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert message in captured.err


def test_usage_lists_placement() -> None:
    assert "adaptive-goal-preflight placement --repo" in preflight.run(["--help"])
