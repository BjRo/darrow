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
