"""Context snapshots through the registered, frozen command boundary."""

import io
import json
import os
import re
import subprocess
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_ia.context import entrypoint

FIXTURES = Path(__file__).parent / "fixtures/context"
BACKEND = Path(__file__).parents[1]


def test_normal_session(tmp_path: Path) -> None:
    home = tmp_path / "codex home"
    rollout = home / "sessions/2026/01/01/rollout-date-fixture-thread.jsonl"
    rollout.parent.mkdir(parents=True)
    rollout.write_bytes((FIXTURES / "normal.jsonl").read_bytes())
    (home / "config.toml").write_text("# no explicit limit\n", encoding="utf-8")
    before = {p: p.read_bytes() for p in home.rglob("*") if p.is_file()}
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(BACKEND / "scripts/run_locked.py"),
            "ia-context",
            "--format",
            "json",
        ],
        env={
            **os.environ,
            "CODEX_HOME": str(home),
            "CODEX_THREAD_ID": "fixture-thread",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["schema_version"] == 1
    assert data["rollout_path"] == str(rollout.resolve())
    assert data["cli_version"] == "0.166.0"
    assert data["exact_total_tokens"] == 200
    assert data["model_context_window"] == 1000
    assert data["free_tokens"] == 800
    assert data["categories"]["system_prompt"] == 2
    assert data["categories"]["other_developer_instructions"] == 1
    assert data["categories"]["tool_output"] == 2
    assert data["categories"]["skills"] == 13
    assert data["categories"]["plugins"] == 13
    assert "autocompact_buffer_tokens" not in data
    assert sum(data["categories"].values()) + data["remainder_tokens"] == 200
    assert before == {p: p.read_bytes() for p in home.rglob("*") if p.is_file()}


def prepare(tmp_path: Path, content: str) -> tuple[Path, Path]:
    home = tmp_path / "codex"
    rollout = home / "sessions/rollout-date-fixture-thread.jsonl"
    rollout.parent.mkdir(parents=True)
    rollout.write_text(content, encoding="utf-8")
    (home / "config.toml").write_text("", encoding="utf-8")
    return home, rollout


def invoke(
    home: Path, format_name: str = "json", *, tty: bool = False
) -> subprocess.CompletedProcess[str]:
    args = ["ia-context", "--format", format_name]
    stdout, stderr = io.StringIO(), io.StringIO()
    with (
        patch.dict(
            os.environ, {"CODEX_HOME": str(home), "CODEX_THREAD_ID": "fixture-thread"}
        ),
        patch("sys.argv", args),
        redirect_stdout(stdout),
        redirect_stderr(stderr),
        patch.object(stdout, "isatty", return_value=tty),
    ):
        try:
            entrypoint()
        except SystemExit as result:
            status = result.code
    assert isinstance(status, int)
    return subprocess.CompletedProcess(
        args, status, stdout.getvalue(), stderr.getvalue()
    )


def test_compacted_history(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "compacted.jsonl").read_text())
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["categories"] == {
        "system_prompt": 2,
        "other_developer_instructions": 0,
        "skills": 0,
        "plugins": 0,
        "agents_md": 0,
        "environment": 0,
        "messages": 2,
        "tool_output": 0,
    }
    assert data["remainder_tokens"] == 196


def test_before_first_token_count(tmp_path: Path) -> None:
    original = (FIXTURES / "normal.jsonl").read_text()
    home, _ = prepare(tmp_path, "\n".join(original.splitlines()[:-1]) + "\n")
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["categories"]["system_prompt"] == 2
    for key in (
        "exact_total_tokens",
        "model_context_window",
        "free_tokens",
        "remainder_tokens",
    ):
        assert data[key] is None
    assert data["warnings"]


def test_negative_remainder_warning(tmp_path: Path) -> None:
    content = (
        (FIXTURES / "normal.jsonl")
        .read_text()
        .replace('"total_tokens":200', '"total_tokens":1')
    )
    home, _ = prepare(tmp_path, content)
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["remainder_tokens"] < 0
    assert any("negative remainder" in warning.lower() for warning in data["warnings"])
    assert sum(data["categories"].values()) + data["remainder_tokens"] == 1


def test_configured_buffer(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    (home / "config.toml").write_text(
        "model_auto_compact_token_limit = 8_00 # explicit\n[profiles.other]\nmodel_auto_compact_token_limit = 1\n",
        encoding="utf-8",
    )
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["model_auto_compact_token_limit"] == 800
    assert data["autocompact_buffer_tokens"] == 200


def test_missing_thread_refuses(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    env = {**os.environ, "CODEX_HOME": str(home)}
    env.pop("CODEX_THREAD_ID", None)
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(BACKEND / "scripts/run_locked.py"),
            "ia-context",
        ],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 2
    assert "CODEX_THREAD_ID" in result.stderr
    assert "Traceback" not in result.stderr


def test_missing_and_duplicate_rollout(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    content = rollout.read_bytes()
    rollout.unlink()
    result = invoke(home)
    assert result.returncode == 2
    assert "missing rollout" in result.stderr.lower()
    rollout.write_bytes(content)
    duplicate = rollout.parent / "other/rollout-other-fixture-thread.jsonl"
    duplicate.parent.mkdir()
    duplicate.write_bytes(content)
    result = invoke(home)
    assert result.returncode == 2
    assert "duplicate rollout" in result.stderr.lower()
    assert "cli_version=0.166.0" in result.stderr


def test_malformed_and_unknown_shapes(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    original = rollout.read_text()
    for extra, diagnostic in [
        ("{broken\n", "malformed line"),
        ('{"type":"future_record","payload":{}}\n', "unknown log shape"),
        (
            '{"type":"response_item","payload":{"type":"future_item"}}\n',
            "unknown log shape",
        ),
        (
            '{"type":"response_item","payload":{"type":"message","role":"user","content":42}}\n',
            "unknown log shape",
        ),
    ]:
        rollout.write_text(original + extra, encoding="utf-8")
        result = invoke(home)
        assert result.returncode == 2, result.stderr
        assert diagnostic in result.stderr.lower()
        assert str(rollout) in result.stderr
        assert "cli_version=0.166.0" in result.stderr
        assert "Traceback" not in result.stderr


def test_live_response_shapes(tmp_path: Path) -> None:
    records = [
        json.loads(line)
        for line in (FIXTURES / "normal.jsonl").read_text().splitlines()
    ]
    records[0]["payload"]["base_instructions"] = {
        "text": "abcdefgh",
        "provenance": None,
    }
    extras = [
        {
            "type": "additional_tools",
            "role": "developer",
            "tools": [{"type": "function", "name": "shell"}],
        },
        {"type": "custom_tool_call", "name": "shell", "input": "pwd"},
        {
            "type": "custom_tool_call_output",
            "output": [{"type": "input_text", "text": "abcd"}],
        },
        {
            "type": "reasoning",
            "summary": [{"type": "summary_text", "text": "abcd"}],
            "encrypted_content": "DO NOT COUNT" * 100,
        },
    ]
    records.extend({"type": "response_item", "payload": item} for item in extras)
    records.append(
        {"type": "event_msg", "payload": {"type": "token_count", "info": None}}
    )
    home, _ = prepare(
        tmp_path, "".join(json.dumps(record) + "\n" for record in records)
    )
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["categories"]["system_prompt"] == 2
    assert data["categories"]["tool_output"] == 3
    assert data["categories"]["logged_tool_definitions"] == 9
    assert data["categories"]["messages"] == 10
    assert data["exact_total_tokens"] == 200


def test_grid(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    result = invoke(home, "grid")
    assert result.returncode == 0, result.stderr
    assert str(rollout.resolve()) in result.stdout.replace("\n", "")
    assert "■" in result.stdout and "·" in result.stdout
    assert "Category" in result.stdout
    assert "System prompt" in result.stdout and "Remainder" not in result.stdout
    assert "200 / 1,000 tokens · 20.0% used" in result.stdout
    assert "Last recorded token count" in result.stdout
    assert result.stdout.rstrip().endswith("Rest: 800 tokens · 80.0% of window")
    assert "estimated" in result.stdout.lower()
    assert not result.stdout.startswith("{")


@pytest.mark.parametrize("width", [40, 60, 80, 120])
@pytest.mark.parametrize("tty", [False, True])
def test_terminal_layout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, width: int, tty: bool
) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    monkeypatch.setenv("COLUMNS", str(width))
    monkeypatch.setenv("TERM", "xterm-256color")
    monkeypatch.delenv("NO_COLOR", raising=False)
    result = invoke(home, "grid", tty=tty)
    assert result.returncode == 0, result.stderr
    assert ("\033[" in result.stdout) is tty
    plain = re.sub(r"\x1b\[[0-9;]*m", "", result.stdout)
    assert max(map(len, plain.splitlines())) <= width
    assert plain.count("■") == 21  # 20 capacity cells plus the legend.
    assert "20.0% used" in plain
    assert plain.rstrip().endswith("Rest: 800 tokens · 80.0% of window")
    assert str(rollout.resolve()) in plain.replace("\n", "")
    assert "system_prompt" not in plain
    grid_lines = [line for line in plain.splitlines() if line.startswith("■ ")]
    assert ("Category" in grid_lines[0]) is (width >= 80)
    if tty:
        with patch.dict(os.environ, {"NO_COLOR": "1"}):
            assert invoke(home, "grid", tty=True).stdout == plain
        with patch.dict(os.environ, {"TERM": "dumb"}):
            assert invoke(home, "grid", tty=True).stdout == plain
    assert "\033" not in invoke(home, "json", tty=tty).stdout


def test_grid_uses_exact_total_when_estimates_exceed_it(tmp_path: Path) -> None:
    content = (
        (FIXTURES / "normal.jsonl")
        .read_text()
        .replace('"total_tokens":200', '"total_tokens":10')
    )
    home, _ = prepare(tmp_path, content)
    data = json.loads(invoke(home).stdout)
    output = invoke(home, "grid").stdout
    assert output.count("■") == 2  # One occupied cell, despite larger estimates.
    assert data["remainder_tokens"] < 0
    assert any("Negative remainder" in warning for warning in data["warnings"])
    assert "remainder" not in output.lower()
    assert output.rstrip().endswith("Rest: 990 tokens · 99.0% of window")


def test_grid_capacity_extremes(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    original = rollout.read_text()
    for total, cells in [(0, 0), (1000, 100), (1200, 100)]:
        rollout.write_text(
            original.replace('"total_tokens":200', f'"total_tokens":{total}')
        )
        output = invoke(home, "grid").stdout
        assert output.count("■") == cells + 1
        assert f"{total / 1000:.1%} used" in output
        assert output.rstrip().endswith(
            f"Rest: {1000 - total:,} tokens · {(1000 - total) / 1000:.1%} of window"
        )


def test_large_counts_on_narrow_terminal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    content = (
        (FIXTURES / "normal.jsonl")
        .read_text()
        .replace('"total_tokens":200', '"total_tokens":1000000')
        .replace('"model_context_window":1000', '"model_context_window":2000000')
    )
    home, _ = prepare(tmp_path, content)
    monkeypatch.setenv("COLUMNS", "40")
    output = invoke(home, "grid").stdout
    assert max(map(len, output.splitlines())) <= 40
    assert "50.0% used" in " ".join(output.split())
    assert "Developer" in output and "instructions" in output


def config_warning(home: Path, needle: str) -> None:
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert "autocompact_buffer_tokens" not in data
    assert any(needle in warning for warning in data["warnings"])


def test_config_problems_warn_and_quoted_content(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    config = home / "config.toml"
    config.unlink()
    config_warning(home, "config.toml")
    for value in ["-1", "0", '"800"', "true", "8__00"]:
        config.write_text(
            f"model_auto_compact_token_limit = {value}\n", encoding="utf-8"
        )
        config_warning(home, "model_auto_compact_token_limit")
    config.write_text(
        "model_auto_compact_token_limit=800\nmodel_auto_compact_token_limit=900\n",
        encoding="utf-8",
    )
    config_warning(home, "duplicate")
    config.write_text(
        'instructions = """\nmodel_auto_compact_token_limit=1\n"""\n[profile]\nmodel_auto_compact_token_limit=2\n',
        encoding="utf-8",
    )
    assert "autocompact_buffer_tokens" not in json.loads(invoke(home).stdout)
    config.write_text("model_auto_compact_token_limit=1200\n", encoding="utf-8")
    data = json.loads(invoke(home).stdout)
    assert data["autocompact_buffer_tokens"] == -200
    assert any("exceeds" in warning for warning in data["warnings"])


@settings(max_examples=40, derandomize=True)
@given(
    st.text(alphabet=st.characters(exclude_categories=["Cs"]), max_size=2000),
    st.integers(min_value=0, max_value=100000),
)
def test_accounting_property(message: str, total: int) -> None:
    import tempfile

    with tempfile.TemporaryDirectory() as directory:
        content = (
            (FIXTURES / "normal.jsonl")
            .read_text()
            .replace('"total_tokens":200', f'"total_tokens":{total}')
        )
        content += (
            json.dumps(
                {
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_text", "text": message}],
                    },
                }
            )
            + "\n"
        )
        home, _ = prepare(Path(directory), content)
        result = invoke(home)
        assert result.returncode == 0, result.stderr
        data = json.loads(result.stdout)
        assert sum(data["categories"].values()) + data["remainder_tokens"] == total


def test_additional_public_refusals(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    original = rollout.read_text()
    variants = [
        [],
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": 1}],
            },
        },
        {
            "type": "response_item",
            "payload": {"type": "message", "role": "future", "content": []},
        },
        {
            "type": "response_item",
            "payload": {
                "type": "message",
                "role": "user",
                "content": [{"type": "image"}],
            },
        },
        {
            "type": "response_item",
            "payload": {"type": "additional_tools", "role": "user", "tools": []},
        },
        {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "last_token_usage": {"total_tokens": -1},
                    "model_context_window": 1,
                },
            },
        },
        {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "last_token_usage": {"total_tokens": 1},
                    "model_context_window": 0,
                },
            },
        },
    ]
    for variant in variants:
        rollout.write_text(original + json.dumps(variant) + "\n", encoding="utf-8")
        result = invoke(home)
        assert result.returncode == 2
        assert "unknown log shape" in result.stderr
    rollout.write_text("", encoding="utf-8")
    assert "session_meta" in invoke(home).stderr


def test_first_turn_grid_and_configured_grid(tmp_path: Path) -> None:
    original = (FIXTURES / "normal.jsonl").read_text()
    home, rollout = prepare(tmp_path, "\n".join(original.splitlines()[:-1]) + "\n")
    (home / "config.toml").write_text(
        "model_auto_compact_token_limit=800\n", encoding="utf-8"
    )
    result = invoke(home, "grid")
    assert result.returncode == 0 and "grid unavailable" in result.stdout
    assert "not recorded yet" in result.stdout and "None" not in result.stdout
    assert "Free tokens" not in result.stdout
    assert "Autocompact buffer" in result.stdout
    assert " ".join(result.stdout.split()).endswith(
        "Rest: unavailable until the first recorded token count"
    )
    rollout.write_text(original, encoding="utf-8")
    result = invoke(home, "grid")
    assert "░ ░ ░ ░ ░ ░ ░ ░ ░ ░" in result.stdout
    assert "200" in result.stdout
    assert result.stdout.rstrip().endswith("Rest: 800 tokens · 80.0% of window")


def test_unset_buffer_not_displayed(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    output = invoke(home, "grid").stdout.lower()
    assert "configured buffer" not in output
    assert "autocompact buffer" not in output


def test_inline_quoted_markers_do_not_hide_limit(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    config = home / "config.toml"
    config.write_text(
        'instructions = \'"""\'\nmodel_auto_compact_token_limit=800\n', encoding="utf-8"
    )
    data = json.loads(invoke(home).stdout)
    assert data["model_auto_compact_token_limit"] == 800


def test_assistant_tags_are_messages(tmp_path: Path) -> None:
    original = (FIXTURES / "normal.jsonl").read_text()
    item = {
        "type": "response_item",
        "payload": {
            "type": "message",
            "role": "assistant",
            "content": [
                {
                    "type": "output_text",
                    "text": "<skills_instructions>example</skills_instructions>",
                }
            ],
        },
    }
    home, _ = prepare(tmp_path, original + json.dumps(item) + "\n")
    data = json.loads(invoke(home).stdout)
    assert data["categories"]["skills"] == 13
    assert data["categories"]["messages"] == 20


def test_duplicate_with_malformed_metadata_refuses(tmp_path: Path) -> None:
    home, rollout = prepare(tmp_path, '{"type":"session_meta","payload":[]}\n')
    duplicate = rollout.parent / "z/rollout-other-fixture-thread.jsonl"
    duplicate.parent.mkdir()
    duplicate.write_bytes((FIXTURES / "normal.jsonl").read_bytes())
    result = invoke(home)
    assert result.returncode == 2
    assert "duplicate rollout" in result.stderr
    assert "cli_version=unknown" in result.stderr
    assert "Traceback" not in result.stderr


def test_escaped_multiline_quote_cannot_supply_limit(tmp_path: Path) -> None:
    home, _ = prepare(tmp_path, (FIXTURES / "normal.jsonl").read_text())
    text = (
        'instructions = """\nexample \\"""\nmodel_auto_compact_token_limit = 123\n"""\n'
    )
    config = home / "config.toml"
    config.write_text(text + "model_auto_compact_token_limit = 800\n", encoding="utf-8")
    data = json.loads(invoke(home).stdout)
    assert data["model_auto_compact_token_limit"] == 800
    assert data["autocompact_buffer_tokens"] == 200
    assert "200" in invoke(home, "grid").stdout
    config.write_text(text, encoding="utf-8")
    data = json.loads(invoke(home).stdout)
    assert "autocompact_buffer_tokens" not in data
    assert "configured buffer" not in invoke(home, "grid").stdout


def test_encrypted_compaction_item(tmp_path: Path) -> None:
    records = [
        json.loads(line)
        for line in (FIXTURES / "compacted.jsonl").read_text().splitlines()
    ]
    last_compaction = next(
        record for record in reversed(records) if record["type"] == "compacted"
    )
    last_compaction["payload"]["replacement_history"].append(
        {"type": "compaction", "encrypted_content": "opaque-summary"}
    )
    home, _ = prepare(
        tmp_path, "".join(json.dumps(record) + "\n" for record in records)
    )
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["categories"]["messages"] == 2
    assert data["remainder_tokens"] == 196


def test_base_prompt_echo_counted_once(tmp_path: Path) -> None:
    records = [
        json.loads(line)
        for line in (FIXTURES / "compacted.jsonl").read_text().splitlines()
    ]
    latest = next(
        record for record in reversed(records) if record["type"] == "compacted"
    )
    latest["payload"]["replacement_history"].insert(
        0,
        {
            "type": "message",
            "role": "developer",
            "content": [{"type": "input_text", "text": "abcdefgh"}],
        },
    )
    home, _ = prepare(
        tmp_path, "".join(json.dumps(record) + "\n" for record in records)
    )
    data = json.loads(invoke(home).stdout)
    assert data["categories"]["system_prompt"] == 2
    assert data["categories"]["other_developer_instructions"] == 0
    assert data["remainder_tokens"] == 196


def test_inter_agent_metadata_is_not_context_content(tmp_path: Path) -> None:
    metadata = {
        "type": "inter_agent_communication_metadata",
        "payload": {"trigger_turn": {"id": "fixture-turn"}},
    }
    original = (FIXTURES / "normal.jsonl").read_text()
    home, _ = prepare(tmp_path, original + json.dumps(metadata) + "\n")
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["exact_total_tokens"] == 200
    assert data["categories"]["messages"] == 7
    assert data["categories"]["other_developer_instructions"] == 1


@pytest.mark.parametrize(
    "extra",
    [{}, {"summary": None}, {"summary": [{"type": "image", "text": "abcdefgh"}]}],
)
def test_agent_message_content(tmp_path: Path, extra: dict[str, object]) -> None:
    item = {
        "type": "response_item",
        "payload": {
            "type": "agent_message",
            "author": "/root/reviewer",
            "recipient": "/root",
            "content": [{"type": "input_text", "text": "abcdefgh"}],
            **extra,
        },
    }
    original = (FIXTURES / "normal.jsonl").read_text()
    home, _ = prepare(tmp_path, original + json.dumps(item) + "\n")
    result = invoke(home)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["categories"]["messages"] == 9
    assert data["exact_total_tokens"] == 200
