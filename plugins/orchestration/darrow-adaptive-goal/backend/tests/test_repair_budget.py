from __future__ import annotations

import sys

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_adaptive_goal import cli, preflight


@pytest.mark.parametrize(
    "args,decision,remaining,reason",
    [
        (["--repairs-used", "2"], "stop", 0, "repair_limit_exhausted"),
        (["--repairs-used", "1"], "within_limits", 1, "counts_within_limits"),
        (
            ["--repairs-used", "2", "--repair-maximum", "4"],
            "within_limits",
            2,
            "counts_within_limits",
        ),
        (
            ["--repairs-used", "0", "--repair-maximum", "0"],
            "stop",
            0,
            "repair_limit_exhausted",
        ),
        (
            ["--repairs-used", "3", "--repair-maximum", "2"],
            "stop",
            0,
            "repair_limit_exhausted",
        ),
        (
            [
                "--repairs-used",
                "2",
                "--repair-maximum",
                "4",
                "--assessment-used",
                "3",
                "--assessment-maximum",
                "3",
            ],
            "stop",
            2,
            "assessment_limit_exhausted",
        ),
        (
            [
                "--repairs-used",
                "1",
                "--assessment-used",
                "1",
                "--assessment-maximum",
                "3",
            ],
            "within_limits",
            1,
            "counts_within_limits",
        ),
    ],
)
def test_public_budget_decisions(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    args: list[str],
    decision: str,
    remaining: int,
    reason: str,
) -> None:
    monkeypatch.setattr(
        sys, "argv", ["adaptive-goal-preflight", "repair-budget", *args]
    )
    assert cli.preflight() == 0
    result = capsys.readouterr()
    records = dict(line.split("\t") for line in result.out.splitlines())
    assert result.err == ""
    assert records["format"] == "darrow-repair-budget-v1"
    assert records["decision"] == decision
    assert records["repair_remaining"] == str(remaining)
    assert records["reason"] == reason
    assert records["repairs_used"] == args[1]
    if "--assessment-used" in args:
        assert records["assessment_used"] == args[args.index("--assessment-used") + 1]
        assert int(records["assessment_remaining"]) >= 0


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["--repairs-used"],
        ["--repairs-used", "-1"],
        ["--repairs-used", "1.5"],
        ["--repairs-used", "two"],
        ["--repairs-used", "\uff11"],
        ["--repairs-used", "1", "--repair-maximum", "-2"],
        ["--repairs-used", "0", "--assessment-used", "1"],
        ["--repairs-used", "0", "--assessment-maximum", "3"],
        ["--repairs-used", "0", "--repairs-used", "1"],
        ["--repairs-used", "0", "--unknown", "1"],
        ["--repairs-used", "9" * 5000],
    ],
)
def test_invalid_counts_produce_no_decision(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    args: list[str],
) -> None:
    monkeypatch.setattr(
        sys, "argv", ["adaptive-goal-preflight", "repair-budget", *args]
    )
    assert cli.preflight() == 2
    result = capsys.readouterr()
    assert result.out == ""
    assert result.err.startswith("adaptive-goal-preflight: ")


@settings(max_examples=60, derandomize=True)
@given(st.integers(0, 1000), st.integers(0, 1000))
def test_exhausted_limit_never_allows_repair(maximum: int, excess: int) -> None:
    result = preflight.run(
        [
            "repair-budget",
            "--repairs-used",
            str(maximum + excess),
            "--repair-maximum",
            str(maximum),
        ]
    )
    assert "decision\tstop\n" in result
    assert "repair_remaining\t0\n" in result
