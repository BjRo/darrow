"""Save reported route unavailability without creating independent judgments."""

from __future__ import annotations

from pathlib import Path

from . import finalization, reader_inputs, routing, scope, storage, verification
from .common import require


def block(
    manifest: str,
    route_record: str,
    reason: str,
    spec_source: str,
    checks: list[str],
    no_checks_reason: str,
    *,
    original: str = "",
    present: bool = False,
) -> str:
    run = storage.run_for_manifest(Path(manifest))
    require(
        not any(
            (run / f"{axis}-input.json").exists() for axis in ("standards", "spec")
        ),
        "prepared readers require partial-review finalization; retain their supported evidence",
        4,
    )
    require(
        Path(route_record) == run / "reviewer-route.json",
        "blocked route must belong to the current scope run",
        4,
    )
    routing.load_route(route_record)
    require(reason.strip(), "route unavailability requires a concrete reason", 4)
    require(
        not (original and spec_source),
        "fix verification uses its original Spec evidence",
        4,
    )
    require(
        checks or no_checks_reason.strip(), "declare checks or their inapplicability", 4
    )
    context = reader_inputs.context_argument("", [], "", no_checks_reason)
    data = (
        verification_draft(manifest, original, reason)
        if original
        else comprehensive_draft(route_record, reason, spec_source)
    )
    data["checks"] = context.get("checks", [])
    data["next_action"] = (
        "Make the selected reviewer route available before retrying this review."
    )
    name = "verification.json" if original else "result.json"
    return finalization.finalize(
        manifest,
        "",
        str(run / name),
        checks,
        original,
        draft_data=data,
        present=present,
    )


def comprehensive_draft(
    route_record: str, reason: str, spec_source: str
) -> dict[str, object]:
    require(
        spec_source.strip(), "blocked review requires explicit Spec availability", 4
    )
    return {
        "format": "darrow-review-result-v3",
        "standards": "blocked",
        "standards_sources": [f"Reported unavailable route: {route_record}: {reason}"],
        "spec": "not_available" if spec_source == "not_available" else "blocked",
        "spec_source": spec_source,
        "findings": [],
        "risks": [reason],
    }


def verification_draft(manifest: str, original: str, reason: str) -> dict[str, object]:
    current = scope.manifest(manifest)
    prior_path = current.get("prior_manifest", "")
    require(prior_path, "fix verification requires a pinned prior manifest", 4)
    prior_scope = scope.manifest(prior_path)
    previous = verification.prior_input(
        finalization.original_binding(original), prior_scope["target"]
    )
    regressions = previous.items("regressions") if previous else []
    attempts = previous.items("attempts") if previous else []
    return {
        "format": "darrow-review-verification-v3",
        "attempts": [
            {
                "key": row["key"],
                "status": "blocked",
                "progress": "unavailable",
                "evidence": reason,
            }
            for row in attempts
            if row["status"] != "resolved"
        ],
        "regressions": [
            {**row, "status": "blocked", "progress": "unavailable", "evidence": reason}
            for row in regressions
        ],
        "evidence_gaps": [reason],
    }
