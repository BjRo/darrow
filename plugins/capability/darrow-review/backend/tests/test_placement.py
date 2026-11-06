from __future__ import annotations

import json
from pathlib import Path

import pytest

from darrow_review import cli, placement
from darrow_review.common import ReviewError
from darrow_review.records import Records

THREAD = "019a-thread"
SESSION = "claude-session"


def codex_home(tmp_path: Path, *lines: str) -> dict[str, str]:
    rollout = tmp_path / "codex/sessions/2026/11/03" / f"rollout-x-{THREAD}.jsonl"
    rollout.parent.mkdir(parents=True)
    rollout.write_text("".join(line + "\n" for line in lines), encoding="utf-8")
    return {"CODEX_THREAD_ID": THREAD, "CODEX_HOME": str(tmp_path / "codex")}


def turn(model: str, effort: str) -> str:
    return json.dumps(
        {"type": "turn_context", "payload": {"model": model, "effort": effort}}
    )


def claude_home(tmp_path: Path, model: str, effort: str) -> dict[str, str]:
    transcript = tmp_path / "claude/projects/repo" / f"{SESSION}.jsonl"
    transcript.parent.mkdir(parents=True)
    row = {"type": "assistant", "message": {"model": model}}
    transcript.write_text(json.dumps(row) + "\n", encoding="utf-8")
    return {
        "CLAUDE_CODE_SESSION_ID": SESSION,
        "CLAUDE_CONFIG_DIR": str(tmp_path / "claude"),
        "CLAUDE_EFFORT": effort,
    }


def decision(host: str, env: dict[str, str], fallback: bool = False) -> Records:
    return Records(placement.place(host, fallback, env))


@pytest.mark.parametrize(
    ("model", "effort", "expected", "reason"),
    [
        ("gpt-6.1-sol", "medium", "inline", "observed-supported-route"),
        ("gpt-6.1-sol", "xhigh", "inline", "observed-supported-route"),
        ("gpt-6.1-sol", "low", "fallback", "observed-below-floor"),
        ("gpt-6-luna", "medium", "fallback", "observed-below-floor"),
    ],
)
def test_codex_placement_follows_the_observed_session_route(
    tmp_path: Path, model: str, effort: str, expected: str, reason: str
) -> None:
    env = codex_home(tmp_path, turn("gpt-6-luna", "low"), turn(model, effort))
    result = decision("codex", env)
    assert result.value("placement") == expected
    assert result.value("basis") == reason
    assert result.object("observed_route") == {"model": model, "effort": effort}


@pytest.mark.parametrize(
    "lines",
    [(turn("gpt-6.1-sol", "medium"), "{broken"), ("[]", '{"type": "turn_context"}')],
)
def test_malformed_codex_evidence_is_unobserved(
    tmp_path: Path, lines: tuple[str, ...]
) -> None:
    result = decision("codex", codex_home(tmp_path, *lines))
    assert result.value("placement") == "fallback"
    assert result.value("basis") == "unobserved"
    assert result.data["observed_route"] is None


def test_missing_or_ambiguous_codex_session_is_unobserved(tmp_path: Path) -> None:
    assert decision("codex", {}).value("basis") == "unobserved"
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"))
    duplicate = tmp_path / "codex/sessions/other" / f"rollout-y-{THREAD}.jsonl"
    duplicate.parent.mkdir(parents=True)
    duplicate.write_text(turn("gpt-6.1-sol", "medium") + "\n", encoding="utf-8")
    assert decision("codex", env).value("basis") == "unobserved"


def test_unreadable_codex_transcript_is_unobserved(tmp_path: Path) -> None:
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"))
    rollout = next((tmp_path / "codex/sessions").rglob("*.jsonl"))
    rollout.write_bytes(b"\xff\xfe")
    assert decision("codex", env).value("basis") == "unobserved"
    rollout.unlink()
    rollout.mkdir()
    assert decision("codex", env).value("basis") == "unobserved"


@pytest.mark.parametrize(
    ("model", "effort", "expected"),
    [
        ("claude-sonnet-5-5", "medium", "inline"),
        ("claude-sonnet-5-5", "low", "fallback"),
        ("claude-haiku-5-5", "medium", "fallback"),
    ],
)
def test_claude_placement_follows_the_observed_session_route(
    tmp_path: Path, model: str, effort: str, expected: str
) -> None:
    result = decision("claude", claude_home(tmp_path, model, effort))
    assert result.value("placement") == expected


def test_claude_without_effort_is_unobserved(tmp_path: Path) -> None:
    result = decision("claude", claude_home(tmp_path, "claude-sonnet-5-5", ""))
    assert result.value("basis") == "unobserved"


def test_pinned_claude_fallback_agent_runs_inline() -> None:
    result = decision("claude", {}, fallback=True)
    assert result.value("placement") == "inline"
    assert result.value("basis") == "pinned-fallback-agent"


def test_codex_refuses_the_pinned_fallback_flag() -> None:
    with pytest.raises(ReviewError, match="Claude-only"):
        placement.place("codex", True, {})


def test_host_must_be_supported_and_match_the_running_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ReviewError, match="unsupported host"):
        placement.place("other", False, {})
    monkeypatch.setenv("CODEX_THREAD_ID", THREAD)
    with pytest.raises(ReviewError, match="use --host codex"):
        placement.place("claude", False, {})


def test_place_command_reports_the_decision(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    for key, value in codex_home(tmp_path, turn("gpt-6-luna", "medium")).items():
        monkeypatch.setenv(key, value)
    output = cli.route_command(["place", "--host", "codex"])
    assert Records(output).value("placement") == "fallback"
    monkeypatch.delenv("CODEX_THREAD_ID")
    output = cli.route_command(["place", "--host", "claude", "--pinned-fallback-agent"])
    assert Records(output).value("placement") == "inline"
    assert "place" in cli.route_command(["help"])


def test_other_rows_do_not_change_the_observed_route(tmp_path: Path) -> None:
    other = json.dumps({"type": "event_msg", "payload": {}})
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"), other)
    assert decision("codex", env).value("placement") == "inline"
    env = claude_home(tmp_path, "claude-sonnet-5-5", "medium")
    transcript = next((tmp_path / "claude/projects").rglob("*.jsonl"))
    with transcript.open("a", encoding="utf-8") as lines:
        lines.write(json.dumps({"type": "user"}) + "\n")
    assert decision("claude", env).value("placement") == "inline"
    with transcript.open("a", encoding="utf-8") as lines:
        lines.write("{broken\n")
    assert decision("claude", env).value("basis") == "unobserved"


def test_unlistable_session_directory_is_unobserved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"))

    def refuse(self: Path, pattern: str) -> list[Path]:
        raise PermissionError(pattern)

    monkeypatch.setattr(Path, "glob", refuse)
    assert decision("codex", env).value("basis") == "unobserved"
