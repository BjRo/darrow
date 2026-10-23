"""Regression evidence for synthetic review composition, not product policy."""

import ast
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_adaptive_goal.common import PLUGIN, RefusalError
from darrow_adaptive_goal.fixtures import cli, install, review
from darrow_adaptive_goal.fixtures.state import capture, oid

CONTRACT = "independent-review-skill-contract-v1"


def snapshot(repo: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(repo)): path.read_bytes()
        for path in repo.rglob("*")
        if path.is_file()
    }


@pytest.mark.parametrize(
    "contents",
    [
        b"export const TIMEOUT_MS = 2500;\nexport const RETRY_COUNT = 0;\n",
        b"\x00\xff\nFinding R1: not a finding\n",
        b"",
    ],
)
def test_readers_expose_exact_source_without_writes_or_invented_findings(
    repo: Path, contents: bytes
) -> None:
    (repo / ".git/fixture-review-event-path").write_text("value.txt\n")
    (repo / "value.txt").write_bytes(contents)
    target = capture(repo).target
    before = snapshot(repo)
    observed = review.preview(repo, "comprehensive", CONTRACT)
    assert snapshot(repo) == before
    assert f"Observed source: {repo / 'value.txt'}\n" in observed
    assert f"Observed source blob: {oid(repo, contents)}\n" in observed
    assert f"Observed source bytes: {contents!r}\n" in observed
    output = review.assess(repo, "comprehensive", CONTRACT, target)
    assert output.startswith(observed)
    assert (repo / ".fixture-state/review-result-0.md").read_text() == output
    follow_up = review.assess(repo, "verify", CONTRACT)
    assert "Finding R1: resolved" not in follow_up


@settings(derandomize=True, deadline=None)
@given(st.binary(max_size=100))
def test_source_bytes_round_trip_without_injecting_report_fields(
    contents: bytes,
) -> None:
    observation = review.SourceObservation(Path.cwd() / "source", "blob", contents)
    report_lines = review.source_report(observation).splitlines()
    assert len(report_lines) == 3
    assert (
        ast.literal_eval(report_lines[-1].removeprefix("Observed source bytes: "))
        == contents
    )


@pytest.mark.parametrize("absolute", [False, True])
def test_source_observation_refuses_outside_repository_without_writes(
    repo: Path, absolute: bool
) -> None:
    outside = repo.parent / "outside-source.txt"
    outside.write_text("outside scope\n")
    subject = str(outside) if absolute else "../outside-source.txt"
    (repo / ".git/fixture-review-event-path").write_text(subject + "\n")
    before = snapshot(repo)
    with pytest.raises(RefusalError, match=r"subject.*inside"):
        review.preview(repo, "comprehensive", CONTRACT)
    assert snapshot(repo) == before


@pytest.mark.parametrize("mode", ["comprehensive", "verify"])
def test_two_readers_do_not_consume_assessment_or_change_reports(
    repo: Path, mode: str
) -> None:
    (repo / ".git/fixture-review-sequence").write_text(
        "blocking\tOriginal blocker\nclear\n"
    )
    if mode == "verify":
        review.assess(repo, "comprehensive", CONTRACT)
        (repo / "value.txt").write_text("repaired\n")
    target = capture(repo).target
    before = snapshot(repo)
    first = cli.dispatch(["review-preview", str(repo), mode, CONTRACT])
    second = cli.dispatch(["review-preview", str(repo), mode, CONTRACT])
    assert first == second
    assert f"Reviewed target: {target}\n" in first
    assert snapshot(repo) == before
    output = cli.dispatch(["review", str(repo), mode, CONTRACT, target])
    assert output.startswith(first)
    history = (repo / ".fixture-state/independent-review-invocations").read_text()
    assert len(history.splitlines()) == (1 if mode == "comprehensive" else 2)
    if mode == "verify":
        assert "Finding R1: resolved; original blocking disposition preserved" in first
        assert "Original review result:" in first
        assert "blocking\tcomprehensive\n" in first
    assert "Complete review result:" in output


def test_changed_reader_target_cannot_record_or_overwrite_assessment(
    repo: Path,
) -> None:
    original = review.assess(repo, "comprehensive", CONTRACT)
    target = capture(repo).target
    review.preview(repo, "verify", CONTRACT)
    (repo / "value.txt").write_text("changed after reader result\n")
    before = snapshot(repo)
    with pytest.raises(RefusalError, match="reader target"):
        cli.dispatch(["review", str(repo), "verify", CONTRACT, target])
    assert snapshot(repo) == before
    assert (repo / ".fixture-state/review-result-0.md").read_text() == original


@pytest.mark.parametrize(
    "mode,contract,error",
    [
        ("fingerprint", CONTRACT, "preview requires"),
        ("comprehensive", "wrong", "contract"),
        ("verify", CONTRACT, "original comprehensive"),
    ],
)
def test_reader_refusals_are_read_only(
    repo: Path, mode: str, contract: str, error: str
) -> None:
    before = snapshot(repo)
    with pytest.raises(RefusalError, match=error):
        cli.dispatch(["review-preview", str(repo), mode, contract])
    assert snapshot(repo) == before


def test_reader_cannot_reopen_closed_comprehensive_review(repo: Path) -> None:
    review.assess(repo, "comprehensive", CONTRACT)
    before = snapshot(repo)
    with pytest.raises(RefusalError, match="already established"):
        review.preview(repo, "comprehensive", CONTRACT)
    assert snapshot(repo) == before


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
    saved = repo / ".fixture-state/review-result-0.md"
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
