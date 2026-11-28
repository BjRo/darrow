"""Guard removed runtime entrypoints; live evals establish coordination behavior."""

from darrow_adaptive_goal.common import PLUGIN


def test_removed_lifecycle_protocol_stays_absent() -> None:
    skill = PLUGIN / "skills/adaptive-goal"
    paths = [skill / "SKILL.md", *skill.glob("references/*-launch.md")]
    paths.extend(PLUGIN.glob("agents/adaptive-goal-*.md"))
    removed = (
        "adaptive-goal-preflight step",
        "Protocol ledger",
        "materialize-objective",
        "darrow-native-goal-report",
        "claude-owner-route",
        "claude-route-gate",
        "- phase: human-feedback-request",
        "- phase: human-feedback-response",
    )
    for path in paths:
        text = path.read_text(encoding="utf-8")
        assert not any(token in text for token in removed), path


def test_claude_launch_runs_without_native_goal() -> None:
    """Claude Code gives skills no goal control, so one invocation runs to completion."""
    path = PLUGIN / "skills/adaptive-goal/references/claude-launch.md"
    text = " ".join(path.read_text(encoding="utf-8").split())
    assert "without a native goal" in text
    activation_handoff = ("SetGoal", "ProposeGoal", "/goal <", "launch_required")
    present = [token for token in activation_handoff if token in text]
    assert not present, present


def test_codex_native_goal_is_unchanged() -> None:
    skill = (PLUGIN / "skills/adaptive-goal/SKILL.md").read_text(encoding="utf-8")
    codex = (PLUGIN / "skills/adaptive-goal/references/codex-launch.md").read_text(
        encoding="utf-8"
    )
    assert "At most 4,000 Unicode characters" in skill
    assert "`create_goal({objective})`" in codex
    assert "500" not in codex
