"""Exercise copied providers through their frozen console entrypoints."""

from __future__ import annotations

import subprocess
import time
from collections.abc import Callable
from pathlib import Path

import pytest

from darrow_adaptive_delivery.common import PLUGIN, git_text
from darrow_adaptive_delivery.fixtures import install
from darrow_adaptive_delivery.fixtures.state import checksum

CONTRACT = "independent-review-skill-contract-v1"
FIXTURES = PLUGIN / "skills/adaptive-delivery/evals/fixtures"


def command(repo: Path, *args: str) -> list[str]:
    return [
        "uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        str(repo / ".agents/backend"),
        "adaptive-delivery-fixture",
        *args,
    ]


def invoke(repo: Path, *args: str, status: int = 0) -> str:
    result = subprocess.run(
        command(repo, *args),
        capture_output=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == status, (result.stdout, result.stderr)
    return result.stdout.decode("utf-8")


def rows(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    return [row.split("\t") for row in path.read_text().splitlines()]


def wait_for_event(
    process: subprocess.Popen[bytes], path: Path, prefix: str, count: int
) -> None:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if sum(row[0] == prefix and len(row) >= 2 for row in rows(path)) >= count:
            return
        assert process.poll() is None, process.communicate()
        time.sleep(0.01)
    pytest.fail(f"Timed out waiting for {prefix} in {path}")


def mutate_during(
    repo: Path, args: list[str], events: Path, prefix: str, mutate: Callable[[], None]
) -> str:
    count = sum(row[0] == prefix for row in rows(events)) + 1
    with subprocess.Popen(
        command(repo, *args),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ) as process:
        try:
            wait_for_event(process, events, prefix, count)
            mutate()
            out, err = process.communicate(timeout=30)
            assert process.returncode == 0, (out, err)
            return out.decode("utf-8")
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


@pytest.mark.parametrize(
    "verdict,expected",
    [
        ("blocked", ["blocked"]),
        ("needs-decision-then-ready", ["needs-decision", "ready"]),
    ],
)
def test_installed_readiness(repo: Path, verdict: str, expected: list[str]) -> None:
    (repo / ".readiness-verdict").write_text(verdict + "\n")
    install.install("readiness", repo, FIXTURES, "codex")
    for outcome in expected:
        out = invoke(repo, "readiness", str(repo))
        assert f"**Verdict:** `{outcome}`" in out
        if outcome == "blocked":
            assert "**Type:** `dependency`" in out
            assert "**Type:** `unblock`" in out
    assert rows(repo / ".git/fixture-state/implementation-readiness-invocations") == [
        [verdict] for _ in expected
    ]


def test_claude_readiness_prerender_is_passive(repo: Path) -> None:
    (repo / ".readiness-verdict").write_text("needs-discovery\n")
    install.install("readiness", repo, FIXTURES, "claude")
    state = repo / ".git/fixture-state"
    assert not (state / "implementation-readiness-invocations").exists()
    result = (state / "implementation-readiness-result").read_text()
    for field in (
        "**Verdict:** `needs-discovery`",
        "**Type:** `missing-information`",
        "**Type:** `discovery`",
    ):
        assert field in result
    skill = repo / ".claude/skills/assess-implementation-readiness/SKILL.md"
    assert "Use the native Read tool, never Bash" in skill.read_text()


def test_installed_review_detects_mutation_outside_subject(repo: Path) -> None:
    install.install("review", repo, FIXTURES, "codex")
    state = repo / ".git/fixture-state"
    (repo / ".git/fixture-review-event-path").write_text("value.txt\n")
    target = invoke(repo, "review", str(repo), "fingerprint").strip()
    result = invoke(repo, "review", str(repo), "comprehensive", CONTRACT)
    assert f"Reviewed target: {target}\n" in result
    assert rows(state / "independent-review-invocations") == [
        [target, "clear", "comprehensive"]
    ]
    assert rows(state / "independent-review-events") == [["review_start", target]]
    subject = git_text(repo, "hash-object", "--", "value.txt")
    assert rows(state / "review-events") == [
        ["review_start", target, subject],
        ["review_end", target, subject],
        ["review", "clear", subject],
    ]
    (repo / ".git/fixture-review-delay-seconds").write_text("2\n")

    def mutate() -> None:
        (repo / "AGENTS.md").write_text("Changed while review was running\n")

    out = mutate_during(
        repo,
        ["review", str(repo), "verify", CONTRACT],
        state / "review-events",
        "review_start",
        mutate,
    )
    assert "Fix verification: inconclusive." in out
    start, end, observation = rows(state / "review-events")[-3:]
    assert start[1] != end[1]
    assert start[2] == end[2] == subject
    assert observation == ["review", "inconclusive", subject]


def write_candidate(repo: Path, retries: int, cache: int) -> Path:
    path = repo / "src/config.js"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(
        f"export const TIMEOUT_MS = 2500;\nexport const RETRY_COUNT = {retries};\nexport const CACHE_SIZE = {cache};\n".encode()
    )
    return path


def record_check(repo: Path, subject: Path) -> None:
    (repo / ".git/fixture-state/check-target").write_text(
        checksum(subject.read_bytes()) + "\n"
    )


def test_installed_combined_lifecycle_and_mutation(repo: Path) -> None:
    install.install("verification", repo, FIXTURES, "both")
    subject = write_candidate(repo, 0, 0)
    state = repo / ".git/fixture-state"
    history = state / "verification-invocations"
    (repo / ".git/fixture-review-reject-pattern").write_text("RETRY_COUNT = 0\n")
    assert "current checks" in invoke(
        repo, "verification", str(repo), "initial", status=1
    )
    assert not history.exists()
    record_check(repo, subject)
    out = invoke(repo, "verification", str(repo), "initial")
    assert "Conclusion: progress\n" in out
    assert "Q1, QA/cache, blocking" in out
    assert "Independent review outcome: blocking findings" in out
    assert "Conclusion: no-progress\n" in invoke(
        repo, "verification", str(repo), "follow-up"
    )
    for flag in ("blocked", "inconclusive"):
        marker = repo / f".git/fixture-review-{flag}"
        marker.touch()
        assert "Conclusion: blocked\n" in invoke(
            repo, "verification", str(repo), "follow-up"
        )
        marker.unlink()
    before = history.read_bytes()
    write_candidate(repo, 3, 5)
    assert "current checks" in invoke(
        repo, "verification", str(repo), "follow-up", status=1
    )
    assert history.read_bytes() == before
    record_check(repo, subject)
    assert "Conclusion: clear\n" in invoke(repo, "verification", str(repo), "follow-up")
    assert rows(history)[-1][1] == checksum(subject.read_bytes())
    assert "already recorded" in invoke(
        repo, "verification", str(repo), "initial", status=1
    )

    def mutate() -> None:
        write_candidate(repo, 3, 0)

    out = mutate_during(
        repo,
        ["verification", str(repo), "follow-up"],
        state / "verification-events",
        "review-returned",
        mutate,
    )
    assert "Conclusion: blocked\n" in out
    events = rows(state / "verification-events")[-4:]
    assert [row[0] for row in events] == [
        "assessment-start",
        "review-returned",
        "qa-returned",
        "assessment-returned",
    ]
    assert events[0][2] == events[1][2] != events[2][2]
