from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_adaptive_goal import cli, preflight


def test_public_input_pins_role_and_preserves_the_bounded_handoff(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    path = tmp_path / "verification handoff-é.txt"
    text = "Coordinate acceptance verification.\r\nScope: src/é.js\nKeep Review on Luna/medium.\n"
    path.write_bytes(text.encode("utf-8"))
    before = path.read_bytes()
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "adaptive-goal-preflight",
            "codex-verification-input",
            "--task-name",
            "verify_initial",
            "--assignment-file",
            str(path),
        ],
    )
    assert cli.preflight() == 0
    output = capsys.readouterr()
    assert output.err == ""
    assert json.loads(output.out) == {
        "task_name": "verify_initial",
        "model": "gpt-6.1-sol",
        "reasoning_effort": "medium",
        "fork_turns": "none",
        "message": text,
    }
    assert path.read_bytes() == before
    assert list(tmp_path.iterdir()) == [path]


@pytest.mark.parametrize(
    "variant",
    [
        "missing-name",
        "missing-file",
        "relative",
        "absent",
        "directory",
        "empty",
        "whitespace",
        "invalid-utf8",
        "invalid-name",
        "duplicate",
        "unknown",
    ],
)
def test_invalid_input_returns_no_launch_object(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    variant: str,
) -> None:
    path = tmp_path / "assignment.txt"
    path.write_text("Coordinate verification.", encoding="utf-8")
    args = ["--task-name", "verify_initial", "--assignment-file", str(path)]
    variants = {
        "missing-name": args[2:],
        "missing-file": args[:2],
        "relative": [*args[:3], "assignment.txt"],
        "absent": [*args[:3], str(tmp_path / "missing")],
        "directory": [*args[:3], str(tmp_path)],
        "invalid-name": ["--task-name", "Verify/initial", *args[2:]],
        "duplicate": [*args, "--task-name", "other"],
        "unknown": [*args, "--model", "gpt-6-luna"],
    }
    bodies = {"empty": b"", "whitespace": b" \r\n\t", "invalid-utf8": b"\xff"}
    if variant in bodies:
        path.write_bytes(bodies[variant])
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "adaptive-goal-preflight",
            "codex-verification-input",
            *variants.get(variant, args),
        ],
    )
    assert cli.preflight() == 2
    output = capsys.readouterr()
    assert output.out == ""
    assert output.err.startswith("adaptive-goal-preflight: ")


@settings(max_examples=50, derandomize=True)
@given(
    st.text(alphabet=st.characters(codec="utf-8"), min_size=1, max_size=200).filter(
        lambda text: bool(text.strip())
    )
)
def test_utf8_handoff_round_trips_without_changing_routes(text: str) -> None:
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as directory:
        path = Path(directory) / "assignment.txt"
        path.write_bytes(text.encode("utf-8"))
        result = json.loads(
            preflight.run(
                [
                    "codex-verification-input",
                    "--task-name",
                    "verify_1",
                    "--assignment-file",
                    str(path),
                ]
            )
        )
        assert result["message"] == text
        assert (result["model"], result["reasoning_effort"], result["fork_turns"]) == (
            "gpt-6.1-sol",
            "medium",
            "none",
        )
