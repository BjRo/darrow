from __future__ import annotations

from pathlib import Path

import pytest

from darrow_adaptive_delivery.fixtures import proof
from evals.clear_repair import select
from test_proof import calls, comprehensive, provider, review_state, verification, write

# Shared public provider fixture and current-target observation.
__all__ = ["calls", "review_state"]


def test_filename_order_cannot_select_an_earlier_blocked_assessment(
    repo: Path, calls: list[tuple[str, ...]]
) -> None:
    provider(repo)
    comprehensive(repo)
    clear = verification(repo)
    write(
        clear.parent.parent / "darrow-review.zzz-earlier/verification.json",
        clear.read_text().replace('"clear"', '"blocked"'),
    )
    assert select(repo) == clear


@pytest.mark.parametrize("defect", ["stale", "missing-original", "ambiguous"])
def test_plausible_but_unbound_clear_evidence_cannot_pass(
    repo: Path, calls: list[tuple[str, ...]], defect: str
) -> None:
    provider(repo)
    original = comprehensive(repo)
    clear = verification(repo)
    if defect == "stale":
        clear.write_text(
            clear.read_text().replace(
                '"current_target": "WORKTREE@current"',
                '"current_target": "WORKTREE@stale"',
            )
        )
    elif defect == "missing-original":
        original.unlink()
    else:
        write(
            clear.parent.parent / "darrow-review.another/verification.json",
            clear.read_text(),
        )
    with pytest.raises(proof.InvalidProofError, match="expected one valid"):
        select(repo)
    assert not (repo / ".git/goal-complete").exists()
