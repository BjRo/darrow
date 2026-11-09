"""Validate current complete-spec assessment through frozen public Review commands."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Any


def document(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def unique(paths: list[Path], description: str) -> Path:
    if len(paths) != 1:
        raise ValueError(f"expected one {description}; found {len(paths)}")
    return paths[0]


def provider_launcher(marketplace: Path) -> Path:
    providers = document(marketplace)["plugins"]
    sources = [item["source"] for item in providers if item["name"] == "darrow-review"]
    root = unique(
        [marketplace.parent.parent / source for source in sources], "Review provider"
    )
    return root.resolve() / "backend/scripts/run_locked.py"


def validate(launcher: Path, state: Path, operation: str, *paths: Path) -> None:
    subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(launcher),
            "review-result",
            operation,
            *map(str, paths),
        ],
        env={**os.environ, "DARROW_REVIEW_STATE_DIR": str(state)},
        check=True,
    )


def matching_repair(path: Path, target: str) -> bool:
    try:
        value = document(path)
    except (ValueError, OSError):
        return False
    return bool(
        value.get("current_target") == target and value.get("outcome") == "clear"
    )


def current_assessment(
    state: Path, launcher: Path, original: Path, target: str
) -> Path:
    value = document(original)
    if value["target"] == target and value["verdict"] == "pass":
        return original
    current = unique(
        [
            path
            for path in state.rglob("verification.json")
            if matching_repair(path, target)
        ],
        "clear current repair assessment",
    )
    # Public validation follows the complete persisted checksum-bound repair history.
    validate(launcher, state, "validate-verification", current)
    validate(launcher, state, "validate-original", original, current)
    return current


def verify(state: Path, marketplace: Path, base: str, target: str) -> None:
    original = unique(list(state.rglob("result.json")), "comprehensive assessment")
    launcher = provider_launcher(marketplace)
    validate(launcher, state, "validate", original)
    result = document(original)
    if result["base"] != base or result["spec"] == "not_available":
        raise ValueError(
            "original assessment must cover the requested base and specification"
        )
    current = current_assessment(state, launcher, original, target)
    scope = document(current.parent / "scope.json")
    if scope["base"] != base or scope["target"] != target:
        raise ValueError(
            "current assessment scope does not match the integrated candidate"
        )
    checks = document(current)["checks"]
    if not checks or not all(
        check["applicability"] == "applicable" and check["status"] == "pass"
        for check in checks
    ):
        raise ValueError("current assessment requires successful applicable checks")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-file", type=Path, required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--marketplace", type=Path, required=True)
    args = parser.parse_args()
    grant = os.environ.get("SEVRO_CANDIDATE_ARTIFACT_REVIEWS")
    if not grant:
        raise ValueError("Candidate Review artifact grant is required")
    base = args.base_file.read_text(encoding="utf-8").strip()
    target = subprocess.check_output(
        ["git", "rev-parse", args.target], text=True
    ).strip()
    verify(Path(grant), args.marketplace, base, target)


if __name__ == "__main__":
    main()
