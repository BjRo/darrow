"""Static host-control guards; live evals establish actual owner behavior."""

import json

import pytest

from darrow_adaptive_delivery.common import PLUGIN


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_launch_contract(host: str) -> None:
    skill = PLUGIN / "skills/adaptive-delivery"
    text = (skill / "SKILL.md").read_text(encoding="utf-8")
    guide = (skill / f"references/{host}-launch.md").read_text(encoding="utf-8")
    assert "launch exactly one route-selected subagent owner" in text
    assert "- phase: adaptive-delivery-owner" in text
    assert "A direct shell, Git, forge," in text
    required = {
        "codex": [
            "`fork_turns` set to `none`",
            "`model` set to the selected concrete Codex model",
            "`reasoning_effort` set to the selected effort",
            "`followup_task`",
            "`send_message`",
        ],
        "claude": ["Invoke the resolved Agent exactly once", "use Claude"],
    }
    for control in required[host]:
        assert control in guide
    manifest = json.loads((PLUGIN / f".{host}-plugin/plugin.json").read_text())
    assert manifest["name"] == "darrow-adaptive-delivery"


def test_removed_lifecycle_protocol_stays_absent() -> None:
    skill = PLUGIN / "skills/adaptive-delivery"
    paths = [skill / "SKILL.md", *skill.glob("references/*-launch.md")]
    paths.extend(PLUGIN.glob("agents/adaptive-delivery-*.md"))
    removed = (
        "adaptive-delivery-preflight step",
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
