"""Persist a terminal scope refusal without coordinator-written protocol fields."""

from __future__ import annotations

from . import report, storage
from .common import ReviewError, new_record, root_directory, serialize
from .records import validate_result


def save(
    repo: str,
    base: str,
    target: str,
    command: str,
    error: ReviewError,
    spec_source: str = "",
) -> str:
    run = storage.allocate_terminal(root_directory(repo))
    data: dict[str, object] = {
        "format": "darrow-review-result-v3",
        "base": base or "not_available",
        "target": target,
        "standards": "blocked",
        "standards_sources": [f"Scope preparation: {command}"],
        "spec": "blocked" if spec_source else "not_available",
        "spec_source": spec_source or "not_available",
        "checks": [
            {
                "command": command,
                "applicability": "applicable",
                "status": "blocked",
                "evidence": f"exited {error.code}: {error}",
            }
        ],
        "verdict": "blocked",
        "risks": [str(error)],
        "next_action": (
            "Provide a valid base and target for a nonempty, unambiguous review "
            f"scope before retrying. {error}"
        ),
    }
    body = serialize(data)
    validate_result(body)
    result = new_record(str(run / "result.json"), body)
    markdown = new_record(str(run / "review.md"), report.render("render", str(result)))
    return serialize(
        {
            "status": "blocked",
            "scope_exit_code": str(error.code),
            "manifest": str(run / "scope.json"),
            "result_record": str(result),
            "report": str(markdown),
        }
    )
