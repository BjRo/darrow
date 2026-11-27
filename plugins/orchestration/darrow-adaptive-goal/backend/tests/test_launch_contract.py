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


def test_claude_launch_matches_claude_code_goal_controls() -> None:
    """Claude Code exposes SetGoal only interactively and caps its condition."""
    path = PLUGIN / "skills/adaptive-goal/references/claude-launch.md"
    text = " ".join(path.read_text(encoding="utf-8").split())
    required = (
        "`SetGoal`",
        "`ProposeGoal`",
        "`select:SetGoal`",
        "500 display columns",
        "only available in interactive local sessions",
        "A session-scoped Stop hook is now active with condition:",
        "/goal <objective>",
    )
    missing = [token for token in required if token not in text]
    assert not missing, missing


def test_codex_objective_limit_is_unchanged() -> None:
    skill = (PLUGIN / "skills/adaptive-goal/SKILL.md").read_text(encoding="utf-8")
    codex = (PLUGIN / "skills/adaptive-goal/references/codex-launch.md").read_text(
        encoding="utf-8"
    )
    assert "At most 4,000 Unicode characters" in skill
    assert "500" not in codex
