from __future__ import annotations

import sys
from pathlib import Path

import pytest

from darrow_adaptive_delivery.common import (
    PLUGIN,
    CheckRequiredError,
    RefusalError,
    git,
)
from darrow_adaptive_delivery.fixtures import (
    cli,
    install,
    readiness,
    review,
    verification,
)
from darrow_adaptive_delivery.fixtures.state import capture, checksum, metadata

CONTRACT = "independent-review-skill-contract-v1"
FIXTURES = PLUGIN / "skills/adaptive-delivery/evals/fixtures"


def test_readiness_reports_and_iterations(repo: Path) -> None:
    verdict = repo / ".readiness-verdict"
    for name in ("ready", "needs-decision", "needs-discovery", "blocked"):
        verdict.write_text(name + "\n")
        output = readiness.assess(repo)
        assert output.startswith(
            f"## Implementation readiness\n\n**Verdict:** `{name}`\n"
        )
        assert "### Required next action" in output
    state = repo / ".git/fixture-state"
    invocations = state / "implementation-readiness-invocations"
    assert (
        invocations.read_text() == "ready\nneeds-decision\nneeds-discovery\nblocked\n"
    )
    assert (state / "implementation-readiness-pre-status").read_bytes() == git(
        repo, "status", "--porcelain", "--untracked-files=all"
    )
    invocations.unlink()
    verdict.write_text("needs-decision-then-ready\n")
    assert "`needs-decision`" in readiness.assess(repo, "render-only")
    assert not invocations.exists()
    assert "`needs-decision`" in readiness.assess(repo)
    assert "`ready`" in readiness.assess(repo)


def test_readiness_refusals(repo: Path) -> None:
    with pytest.raises(RefusalError, match="mode"):
        readiness.assess(repo, "invalid")
    with pytest.raises(RefusalError, match=r"missing \.readiness-verdict"):
        readiness.assess(repo)
    (repo / ".readiness-verdict").write_text("unknown\n")
    with pytest.raises(RefusalError, match="unsupported verdict"):
        readiness.assess(repo)
    (repo / ".readiness-verdict").write_text("")
    with pytest.raises(RefusalError, match="unsupported verdict"):
        readiness.assess(repo)


@pytest.mark.parametrize("host", ["codex", "claude", "both"])
@pytest.mark.parametrize("kind", ["readiness", "review", "verification"])
def test_install_isolated_providers(repo: Path, host: str, kind: str) -> None:
    (repo / ".readiness-verdict").write_text("blocked\n")
    assert install.install(kind, repo, FIXTURES, host) == ""
    for root in {".agents", ".claude"} - set(install.HOSTS[host]):
        assert not (repo / root).exists()
    for root in install.HOSTS[host]:
        assert (repo / root / "backend/uv.lock").is_file()
        assert (repo / root / ".claude-plugin/plugin.json").is_file()
        assert (repo / root / ".codex-plugin/plugin.json").is_file()
        assert not (repo / root / "backend/.venv").exists()
        assert not (repo / root / "bin").exists()
        name = install.SKILLS[kind][1]
        content = (repo / root / "skills" / name / "SKILL.md").read_text()
        source = FIXTURES / install.SKILLS[kind][0]
        assert content == (source / install.template(kind, root)).read_text()
        assert not (source / "SKILL.md").exists()
        assert not (repo / root / "backend/tests").exists()
        if kind == "review":
            matches = [
                path.relative_to(repo / root).as_posix()
                for path in (repo / root).rglob("*")
                if path.is_file() and CONTRACT.encode() in path.read_bytes()
            ]
            assert matches == ["skills/independent-code-review/SKILL.md"]
    with pytest.raises(RefusalError, match="install requires"):
        install.install(kind, repo, FIXTURES, "invalid")


def test_review_fingerprint_tracks_all_candidate_content(repo: Path) -> None:
    before = review.assess(repo, "fingerprint")
    (repo / "value.txt").write_bytes(b"after\n")
    changed = review.assess(repo, "fingerprint")
    assert changed != before
    unusual = repo / "untracked-é space.txt"
    unusual.write_bytes(b"one\x00two")
    untracked = review.assess(repo, "fingerprint")
    assert untracked != changed
    unusual.write_bytes(b"replacement")
    assert review.assess(repo, "fingerprint") != untracked
    report = review.assess(repo, "comprehensive", CONTRACT)
    assert f"Changed file: {unusual}\n" in report
    assert "no blocking findings" in report
    with pytest.raises(RefusalError, match="already established"):
        review.assess(repo, "comprehensive", CONTRACT)
    assert "Fix verification: no_progress." in review.assess(repo, "verify", CONTRACT)


def test_review_requires_contract_and_original(repo: Path) -> None:
    for mode, contract, error in (
        ("bad", "", "usage"),
        ("comprehensive", "bad", "contract"),
        ("verify", CONTRACT, "original comprehensive"),
    ):
        with pytest.raises(RefusalError, match=error):
            review.assess(repo, mode, contract)


@pytest.mark.parametrize(
    "flag,outcome",
    [
        ("fail", "blocking"),
        ("blocked", "unavailable"),
        ("inconclusive", "inconclusive"),
    ],
)
def test_review_flags(repo: Path, flag: str, outcome: str) -> None:
    git_dir = metadata(repo)
    (git_dir / f"fixture-review-{flag}").touch()
    (git_dir / "fixture-review-repair-guidance").write_text(
        "Advisory repair guidance\n"
    )
    output = review.assess(repo, "comprehensive", CONTRACT)
    assert outcome in output
    if flag == "fail":
        assert "Advisory repair guidance\n" in output


@pytest.mark.parametrize("final", ["clear", "continue", "no_progress", "unavailable"])
def test_review_closed_sequence_and_history(repo: Path, final: str) -> None:
    git_dir = metadata(repo)
    (git_dir / "fixture-review-sequence").write_text(
        "blocking\tOriginal blocker\tAdvisory\tUnrelated\nblocking\tNarrowed cause\n"
        f"{final}\tFinal observation\n"
    )
    result = review.assess(repo, "comprehensive", CONTRACT)
    assert (
        "Advisory finding: Advisory\nUnrelated observation excluded: Unrelated\n"
        in result
    )
    (repo / "value.txt").write_text("repaired once\n")
    assert "Fix verification: continue." in review.assess(repo, "verify", CONTRACT)
    (repo / "value.txt").write_text("repaired twice\n")
    assert f"Fix verification: {final}." in review.assess(repo, "verify", CONTRACT)
    history = (git_dir / "fixture-state/independent-review-invocations").read_text()
    rows = [row.split("\t") for row in history.splitlines()]
    assert [row[2] for row in rows] == ["comprehensive", "verify", "verify"]
    assert len({row[0] for row in rows}) == 3
    with pytest.raises(RefusalError, match="already established"):
        review.assess(repo, "comprehensive", CONTRACT)
    with pytest.raises(RefusalError, match="exhausted"):
        review.assess(repo, "verify", CONTRACT)


@pytest.mark.parametrize(
    "line,error",
    [
        ("invalid\tx", "invalid review"),
        ("blocked", "requires failure"),
        ("continue\tx", "comprehensive fixture"),
        ("", "exhausted"),
    ],
)
def test_invalid_sequences(repo: Path, line: str, error: str) -> None:
    (repo / ".git/fixture-review-sequence").write_text(line + "\n")
    with pytest.raises(RefusalError, match=error):
        review.assess(repo, "comprehensive", CONTRACT)


def test_blocked_followup_and_repeat_protection(repo: Path) -> None:
    path = repo / ".git/fixture-review-sequence"
    path.write_text("clear\nblocked\tUnavailable input\n")
    review.assess(repo, "comprehensive", CONTRACT)
    output = review.assess(repo, "verify", CONTRACT)
    assert "Fix verification: blocked.\n" in output
    assert "Evidence gap: Unavailable input\n" in output


def test_review_subject_and_mutation(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git_dir = metadata(repo)
    (git_dir / "fixture-review-event-path").write_text("value.txt\n")
    (git_dir / "fixture-review-delay-seconds").write_text("1\n")

    def mutate(_seconds: float) -> None:
        (repo / "value.txt").write_text("changed during assessment\n")

    monkeypatch.setattr("darrow_adaptive_delivery.fixtures.review.time.sleep", mutate)
    assert "outcome: inconclusive" in review.assess(repo, "comprehensive", CONTRACT)
    events = (git_dir / "fixture-state/review-events").read_text().splitlines()
    assert events[0].split("\t")[1] != events[1].split("\t")[1]
    assert events[2].startswith("review\tinconclusive\t")


def test_review_stable_subject(repo: Path) -> None:
    (repo / ".git/fixture-review-event-path").write_text("value.txt\n")
    assert "no blocking findings" in review.assess(repo, "comprehensive", CONTRACT)


@pytest.mark.parametrize(
    "subject,delay,error",
    [
        ("missing", None, "subject"),
        ("", None, "subject"),
        ("value.txt", "invalid", "delay"),
        ("value.txt", "", "delay"),
    ],
)
def test_review_observation_refusals(
    repo: Path, subject: str, delay: str | None, error: str
) -> None:
    (repo / ".git/fixture-review-event-path").write_text(subject + "\n")
    if delay is not None:
        (repo / ".git/fixture-review-delay-seconds").write_text(delay + "\n")
    with pytest.raises(RefusalError, match=error):
        review.assess(repo, "comprehensive", CONTRACT)


def write_candidate(repo: Path, retries: int = 0, cache: int = 0) -> Path:
    subject = repo / "src/config.js"
    subject.parent.mkdir(exist_ok=True)
    subject.write_bytes(
        f"export const TIMEOUT_MS = 2500;\nexport const RETRY_COUNT = {retries};\nexport const CACHE_SIZE = {cache};\n".encode()
    )
    return subject


def test_combined_assessment_requires_current_checks(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "darrow_adaptive_delivery.fixtures.verification.time.sleep",
        lambda _seconds: None,
    )
    subject = write_candidate(repo)
    state = repo / ".git/fixture-state"
    (repo / ".git/fixture-review-reject-pattern").write_text("RETRY_COUNT = 0\n")
    with pytest.raises(CheckRequiredError, match="current checks"):
        verification.assess(repo, "initial")
    (state / "check-target").write_text(checksum(subject.read_bytes()) + "\n")
    with pytest.raises(CheckRequiredError, match="initial verification"):
        verification.assess(repo, "follow-up")
    output = verification.assess(repo, "initial")
    assert "Conclusion: progress\n" in output
    assert "Q1, QA/cache, blocking" in output
    assert "Independent review outcome: blocking findings" in output
    assert "Conclusion: no-progress\n" in verification.assess(repo, "follow-up")
    with pytest.raises(CheckRequiredError, match="already recorded"):
        verification.assess(repo, "initial")
    write_candidate(repo, 3, 5)
    with pytest.raises(CheckRequiredError, match="current checks"):
        verification.assess(repo, "follow-up")
    (state / "check-target").write_text(checksum(subject.read_bytes()) + "\n")
    assert "Conclusion: clear\n" in verification.assess(repo, "follow-up")
    events = (state / "verification-events").read_text().splitlines()
    assert [row.split("\t")[0] for row in events[:4]] == [
        "assessment-start",
        "review-returned",
        "qa-returned",
        "assessment-returned",
    ]
    with pytest.raises(RefusalError, match="initial or follow-up"):
        verification.assess(repo, "bad")


@pytest.mark.parametrize(
    "review_result",
    [
        "Independent review outcome: inconclusive",
        "Independent review outcome: unavailable",
        "Fix verification: blocked.",
        "Fix verification: inconclusive.",
        "Fix verification: unavailable.",
    ],
)
def test_unavailable_assessment_blocks(review_result: str) -> None:
    assert verification.conclusion("same", "same", review_result, "clear") == "blocked"
    assert (
        verification.conclusion("old", "new", "Fix verification: clear.", "clear")
        == "blocked"
    )


def test_fixture_cli(
    repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    assert "usage:" in cli.dispatch([])
    assert cli.dispatch(["--help"]) == cli.USAGE
    assert (
        cli.dispatch(["review", str(repo), "fingerprint"])
        == capture(repo).target + "\n"
    )
    (repo / ".readiness-verdict").write_text("ready\n")
    assert "`ready`" in cli.dispatch(["readiness", str(repo)])
    assert "`ready`" in cli.dispatch(["readiness", str(repo), "render-only"])
    assert cli.dispatch(["install", "review", str(repo), str(FIXTURES), "codex"]) == ""
    assert "no blocking findings" in cli.dispatch(
        ["review", str(repo), "comprehensive", CONTRACT]
    )
    monkeypatch.setattr(sys, "argv", ["fixture", "invalid"])
    assert cli.main() == 2
    assert "usage:" in capsys.readouterr().err
    write_candidate(repo)
    monkeypatch.setattr(sys, "argv", ["fixture", "verification", str(repo), "initial"])
    assert cli.main() == 1
    assert "current checks required" in capsys.readouterr().out
    monkeypatch.chdir(repo)
    monkeypatch.setattr(sys, "argv", ["fixture", "proof", "invalid"])
    assert cli.main() == 1
    assert "review proof:" in capsys.readouterr().err
    monkeypatch.setattr(sys, "argv", ["fixture", "proof", "complete", "missing"])
    assert cli.main() == 1
