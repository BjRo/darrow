from __future__ import annotations

import json
import sys
from collections.abc import Sequence
from io import StringIO
from pathlib import Path

import pytest

from darrow_verification import placement

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
        "CLAUDECODE": "1",
        "CLAUDE_CODE_SESSION_ID": SESSION,
        "CLAUDE_CONFIG_DIR": str(tmp_path / "claude"),
        "CLAUDE_EFFORT": effort,
    }


def run(arguments: Sequence[str], env: dict[str, str]) -> tuple[int, str, str]:
    stdout, stderr = StringIO(), StringIO()
    status = placement.main(arguments, env, stdout=stdout, stderr=stderr)
    return status, stdout.getvalue(), stderr.getvalue()


def decision(host: str, env: dict[str, str], *flags: str) -> dict[str, object]:
    status, output, error = run(["--host", host, *flags], env)
    assert (status, error) == (0, "")
    return dict(json.loads(output))


@pytest.mark.parametrize(
    ("model", "effort", "expected", "reason"),
    [
        ("gpt-6.1-sol", "medium", "inline", "observed-supported-route"),
        ("gpt-6.1-sol", "max", "inline", "observed-supported-route"),
        ("gpt-6.1-sol", "low", "fallback", "observed-below-floor"),
        ("gpt-6-luna", "medium", "fallback", "observed-below-floor"),
    ],
)
def test_codex_placement_follows_the_observed_session_route(
    tmp_path: Path, model: str, effort: str, expected: str, reason: str
) -> None:
    env = codex_home(tmp_path, turn("gpt-6-luna", "low"), turn(model, effort))
    result = decision("codex", env)
    assert (result["placement"], result["basis"]) == (expected, reason)
    assert result["observed_route"] == {"model": model, "effort": effort}


@pytest.mark.parametrize(
    "lines",
    [(turn("gpt-6.1-sol", "medium"), "{broken"), ("[]", '{"type": "turn_context"}')],
)
def test_malformed_codex_evidence_is_unobserved(
    tmp_path: Path, lines: tuple[str, ...]
) -> None:
    result = decision("codex", codex_home(tmp_path, *lines))
    assert (result["placement"], result["basis"]) == ("fallback", "unobserved")
    assert result["observed_route"] is None


def test_missing_ambiguous_or_unreadable_codex_session_is_unobserved(
    tmp_path: Path,
) -> None:
    assert decision("codex", {})["basis"] == "unobserved"
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"))
    rollout = next((tmp_path / "codex/sessions").rglob("*.jsonl"))
    rollout.write_bytes(b"\xff\xfe")
    assert decision("codex", env)["basis"] == "unobserved"
    rollout.unlink()
    rollout.mkdir()
    assert decision("codex", env)["basis"] == "unobserved"
    rollout.rmdir()
    for name in ("a", "b"):
        duplicate = (
            tmp_path / "codex/sessions" / name / f"rollout-{name}-{THREAD}.jsonl"
        )
        duplicate.parent.mkdir(parents=True)
        duplicate.write_text(turn("gpt-6.1-sol", "medium") + "\n", encoding="utf-8")
    assert decision("codex", env)["basis"] == "unobserved"


@pytest.mark.parametrize(
    ("model", "effort", "expected"),
    [
        ("claude-sonnet-5-5", "medium", "inline"),
        ("claude-sonnet-5-5", "low", "fallback"),
        ("claude-haiku-5-5", "medium", "fallback"),
        ("claude-sonnet-5-5", "", "fallback"),
    ],
)
def test_claude_placement_follows_the_observed_session_route(
    tmp_path: Path, model: str, effort: str, expected: str
) -> None:
    assert decision("claude", claude_home(tmp_path, model, effort))["placement"] == (
        expected
    )


def test_pinned_claude_fallback_agent_runs_inline() -> None:
    result = decision("claude", {}, "--pinned-fallback-agent")
    assert (result["placement"], result["basis"]) == ("inline", "pinned-fallback-agent")


@pytest.mark.parametrize(
    ("arguments", "env", "message"),
    [
        ([], {}, "usage:"),
        (["--host"], {}, "usage:"),
        (["--host", "codex", "--other"], {}, "usage:"),
        (["--host", "other"], {}, "unsupported host: other"),
        (["--host", "codex", "--pinned-fallback-agent"], {}, "Claude-only"),
        (["--host", "claude"], {"CODEX_THREAD_ID": THREAD}, "use --host codex"),
        (["--host", "codex"], {"CLAUDECODE": "1"}, "use --host claude"),
    ],
)
def test_refusals(arguments: list[str], env: dict[str, str], message: str) -> None:
    status, output, error = run(arguments, env)
    assert (status, output) == (2, "")
    assert error.startswith("error: ") and message in error


def test_nested_host_environment_accepts_the_requested_host() -> None:
    env = {"CODEX_THREAD_ID": THREAD, "CLAUDECODE": "1"}
    assert decision("claude", env)["host"] == "claude"


def test_entrypoint_exits_with_the_main_status(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["darrow-verify-placement"])
    with pytest.raises(SystemExit) as exit_info:
        placement.entrypoint()
    assert exit_info.value.code == 2
    assert "usage:" in capsys.readouterr().err


def test_other_rows_do_not_change_the_observed_route(tmp_path: Path) -> None:
    other = json.dumps({"type": "event_msg", "payload": {}})
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"), other)
    assert decision("codex", env)["placement"] == "inline"
    env = claude_home(tmp_path, "claude-sonnet-5-5", "medium")
    transcript = next((tmp_path / "claude/projects").rglob("*.jsonl"))
    with transcript.open("a", encoding="utf-8") as lines:
        lines.write(json.dumps({"type": "user"}) + "\n")
    assert decision("claude", env)["placement"] == "inline"
    with transcript.open("a", encoding="utf-8") as lines:
        lines.write("{broken\n")
    assert decision("claude", env)["basis"] == "unobserved"


def test_unlistable_session_directory_is_unobserved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = codex_home(tmp_path, turn("gpt-6.1-sol", "medium"))

    def refuse(self: Path, pattern: str) -> list[Path]:
        raise PermissionError(pattern)

    monkeypatch.setattr(Path, "glob", refuse)
    assert decision("codex", env)["basis"] == "unobserved"
