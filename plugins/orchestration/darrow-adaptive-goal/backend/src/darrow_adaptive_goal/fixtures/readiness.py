"""Render the existing readiness reports and optional passive invocation evidence."""

from __future__ import annotations

from pathlib import Path

from ..common import RefusalError, git, read_text
from .state import append, lines, metadata


def assess(repo: Path, mode: str = "record") -> str:
    if mode not in {"record", "render-only"}:
        raise RefusalError(f"unsupported readiness mode: {mode}")
    configured_lines = read_text(
        repo / ".readiness-verdict",
        "implementation-readiness-fixture: missing .readiness-verdict",
    ).splitlines()
    configured = configured_lines[0] if configured_lines else ""
    state = metadata(repo) / "fixture-state"
    count = 1
    if mode == "record":
        (state / "implementation-readiness-pre-status").write_bytes(
            git(repo, "status", "--porcelain", "--untracked-files=all")
        )
        invocations = state / "implementation-readiness-invocations"
        append(invocations, configured + "\n")
        count = len(lines(invocations))
    verdict = configured
    if configured == "needs-decision-then-ready":
        verdict = "ready" if count >= 2 else "needs-decision"
    if verdict not in {"ready", "needs-decision", "needs-discovery", "blocked"}:
        raise RefusalError(
            f"implementation-readiness-fixture: unsupported verdict: {verdict}"
        )
    return read_text(
        Path(__file__).parent / "reports" / f"{verdict}.md",
        "readiness report is unreadable",
    )
