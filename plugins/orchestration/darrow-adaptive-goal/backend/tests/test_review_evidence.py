"""Regression evidence for synthetic review composition, not product policy."""

from pathlib import Path

import pytest

from darrow_adaptive_goal.common import PLUGIN
from darrow_adaptive_goal.fixtures import install, review
from darrow_adaptive_goal.fixtures.state import capture

CONTRACT = "independent-review-skill-contract-v1"


@pytest.mark.parametrize("host", ["codex", "claude", "both"])
def test_installed_review_assets_do_not_change_candidate(repo: Path, host: str) -> None:
    before = capture(repo)
    install.install(
        "review", repo, PLUGIN / "skills/adaptive-goal/evals/fixtures", host
    )
    assert capture(repo) == before
    (repo / "new-product.txt").write_text("new implementation\n")
    assert capture(repo).target != before.target


def test_review_retains_original_finding_and_cleared_history(repo: Path) -> None:
    (repo / ".git/fixture-review-reject-pattern").write_text("defective\n")
    subject = repo / "value.txt"
    subject.write_text("defective\n")
    original_target = capture(repo).target
    original = review.assess(repo, "comprehensive", CONTRACT)
    assert "Finding R1: axis spec; severity high; disposition blocking." in original
    assert (
        "Evidence: Fixture policy rejects changed content containing: defective"
        in original
    )
    assert f"Original target: {original_target}\n" in original
    saved = repo / ".git/fixture-state/review-result-0.md"
    assert saved.read_text(encoding="utf-8") == original

    assert "Fix verification: no_progress." in review.assess(repo, "verify", CONTRACT)
    subject.write_text("repaired\n")
    current_target = capture(repo).target
    clear = review.assess(repo, "verify", CONTRACT)
    assert "Fix verification: clear." in clear
    assert "Finding R1: resolved; original blocking disposition preserved" in clear
    assert f"Original review result: {saved}\n" in clear
    assert f"{original_target}\tblocking\tcomprehensive\n" in clear
    assert f"{current_target}\tclear\tverify\n" in clear
    assert saved.read_text(encoding="utf-8") == original
    assert "Fix verification: clear." in review.assess(repo, "verify", CONTRACT)
    subject.write_text("defective\n")
    assert "Fix verification: no_progress." in review.assess(repo, "verify", CONTRACT)
