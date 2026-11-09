"""Check the selected Review readers inside a goal with earlier assignments.

Reuse Review's route, completion, placement and launch-order oracles unchanged.
Earlier encrypted assignments remain unclassified; they are not review readers
merely because their implementation instructions cannot be read.
"""

from __future__ import annotations

import argparse
import os
import runpy
import sys
from pathlib import Path


def verify_codex(
    helpers: Path, view: Path, agents: dict[str, str], expected: list[str]
) -> None:
    native = runpy.run_path(str(helpers / "native_codex_routes.py"))
    root, captured = native["sessions"](view)
    group = native["bound_readers"](root, captured, agents, expected)
    native["verify_placement"](root, captured, [group], "inline")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=("codex", "claude"), required=True)
    host = parser.parse_args().host
    helpers = Path(".git/eval-checks/review/tests/evals").resolve()
    sys.path.insert(0, str(helpers))
    review = runpy.run_path(str(helpers / "eval_routes.py"))
    state = Path(os.environ["SEVRO_CANDIDATE_ARTIFACT_REVIEWS"])
    view = Path(os.environ["SEVRO_CANDIDATE_TRANSCRIPTS"])
    axes = ["standards", "spec"]
    if host == "claude":
        review["verify"](Path(".git"), host, "default", axes, state, placement="inline")
        return
    scopes = list(state.glob("**/darrow-review.*/result.json"))
    assert len(scopes) == 1, "expected one comprehensive assessment"
    directory = scopes[0].parent
    assert (directory / "reviewer-route.json").is_file(), "missing reviewer route"
    expected = review["route"](host, "default")
    agents = review["identities"](directory, axes, expected)
    verify_codex(helpers, view, agents, expected)


if __name__ == "__main__":
    main()
