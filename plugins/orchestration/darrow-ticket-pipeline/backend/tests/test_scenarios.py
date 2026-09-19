"""Semantic Python port of the shell suite's delivery and refusal scenarios."""

from pathlib import Path

import pytest

from scenario import Scenario


def test_refinement_to_verified_preserves_ticket_and_user_work(tmp_path: Path) -> None:
    original = "## Outcome\n\nKeep this operator note exactly: café.\n"
    run = Scenario(tmp_path, original)
    assert run.body.read_bytes().startswith(original.encode())
    assert " M user-owned.txt\n" in run.body.read_text(encoding="utf-8")
    run.launch("challenge", 1, expected=4)
    run.complete("refine", "complete", "Initial plan")
    run.complete("challenge", "needs_revision", "Missing zero-value criterion")
    run.launch("implement", 1, expected=4)
    run.complete("refine", "complete", "Plan includes zero")
    # Historical selection precedence is part of the frozen comparison baseline.
    assert "next_phase\trefine\n" in run.invoke("summary")
    run.complete("challenge", "approved", "Revised plan approved")
    assert "next_phase\timplement\n" in run.invoke("summary")
    run.complete("implement", "complete")
    assert "next_phase\treview\n" in run.invoke("summary")
    run.complete("review", "approved")
    run.complete("qa", "passed")
    run.invoke("finish", expected=4, status="verified")
    run.complete("codify", "no_change")
    assert "next_phase\tcomplete\n" in run.invoke("summary")
    assert "status\tverified\n" in run.invoke("finish", status="verified")
    assert "next_phase\tnone\n" in run.invoke("summary")
    final = run.body.read_text(encoding="utf-8")
    assert final.startswith(original)
    assert "Initial plan" in final and "Plan includes zero" in final
    assert "Missing zero-value criterion" in final
    assert run.baseline.read_bytes() == b" M user-owned.txt\n"


def test_review_and_qa_repairs_have_separate_bounded_attempts(tmp_path: Path) -> None:
    run = Scenario(tmp_path)
    run.implement()
    run.complete("review", "changes_requested")
    assert "next_phase\trework\n" in run.invoke("summary")
    run.launch("rework", 2, expected=4)
    run.launch("review", 2, expected=4)
    run.complete("rework", "complete")
    assert "next_phase\treview\n" in run.invoke("summary")
    run.complete("review", "approved")
    run.complete("qa", "failed")
    assert "next_phase\tfinish\n" in run.invoke("summary")
    run.launch("qa", 2, expected=4)
    run.complete("rework", "complete")
    run.complete("qa", "passed")
    run.complete("codify", "complete")
    run.invoke("finish", status="verified")
    assert "next_phase\tnone\n" in run.invoke("summary")


@pytest.mark.parametrize(
    "phase,status", [("review", "changes_requested"), ("qa", "failed")]
)
def test_exhausted_repairs_stop_with_retained_escalation(
    tmp_path: Path, phase: str, status: str
) -> None:
    run = Scenario(tmp_path)
    run.implement()
    if phase == "qa":
        run.complete("review", "approved")
    run.complete(phase, status, "First failure")
    run.complete("rework", "complete")
    run.complete(phase, status, "Second failure")
    assert "next_phase\tfinish\n" in run.invoke("summary")
    run.launch("rework", 2, expected=4)
    reason = tmp_path / "reason.md"
    reason.write_bytes(b"Decide whether to change the ticket contract.\n")
    run.invoke(
        "finish", expected=0, status="needs_human", **{"reason-file": str(reason)}
    )
    final = run.body.read_text(encoding="utf-8")
    assert "## Ticket Pipeline Escalation\n\nDecide whether" in final
    assert "First failure" in final and "Second failure" in final


def test_third_challenge_stops_without_another_writer(tmp_path: Path) -> None:
    run = Scenario(tmp_path)
    for _ in range(3):
        run.complete("refine", "complete")
        run.complete("challenge", "needs_revision")
    assert "next_phase\tfinish\n" in run.invoke("summary")
    run.launch("refine", 4, expected=4)
    run.launch("implement", 1, expected=4)


def test_uncertain_child_is_not_replayed(tmp_path: Path) -> None:
    run = Scenario(tmp_path)
    run.launch("refine", 1)
    assert "phase\trefine\tin_progress\t1\n" in run.invoke("summary")
    assert "next_phase\tfinish\n" in run.invoke("summary")
    run.launch("refine", 1, expected=4)
    run.launch("refine", 2, expected=4)


@pytest.mark.parametrize(
    "mutation", ["missing", "renamed", "empty", "run", "agent", "phase"]
)
def test_corrupted_artifacts_cannot_be_resumed(tmp_path: Path, mutation: str) -> None:
    run = Scenario(tmp_path)
    run.complete("refine", "complete")
    text = run.body.read_text(encoding="utf-8")
    start = text.index("## Ticket Pipeline Artifact")
    retained = text[start:]
    changes = {
        "missing": "",
        "renamed": retained.replace("format\t", "kind\t"),
        "empty": retained.split("### Evidence")[0],
        "run": retained.replace("run_id\ttest-run", "run_id\twrong"),
        "agent": retained.replace("agent\trefine-1", "agent\tother"),
        "phase": retained.replace("phase\trefine", "phase\timplement"),
    }
    run.body.write_bytes((text[:start] + changes[mutation]).encode())
    run.invoke("summary", expected=4)


@pytest.mark.parametrize(
    "phase", ["refine", "challenge", "implement", "review", "qa", "codify"]
)
def test_terminal_phase_blocks_downstream_work(tmp_path: Path, phase: str) -> None:
    run = Scenario(tmp_path)
    for current, status in (
        ("refine", "complete"),
        ("challenge", "approved"),
        ("implement", "complete"),
        ("review", "approved"),
        ("qa", "passed"),
        ("codify", "complete"),
    ):
        if current == phase:
            run.complete(current, "blocked")
            break
        run.complete(current, status)
    assert "next_phase\tfinish\n" in run.invoke("summary")
    run.launch("implement", 1, expected=4)


def test_inline_heading_and_concurrent_user_section_are_preserved(
    tmp_path: Path,
) -> None:
    note = "The schema contains ## Ticket Pipeline Execution Ledger.\n"
    run = Scenario(tmp_path, note)
    user_section = "## Notes\nstate\tpersonal\nrun_id\tuser-note\n\n"
    original = run.body.read_text(encoding="utf-8")
    run.body.write_bytes(
        original.replace(
            "## Ticket Pipeline User Work Baseline",
            user_section + "## Ticket Pipeline User Work Baseline",
        ).encode()
    )
    run.complete("refine", "complete")
    assert "next_phase\tchallenge\n" in run.invoke("summary")
    assert run.body.read_bytes().startswith(note.encode())
    assert user_section in run.body.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    "row", ["| refine |", "| refine | pending | " + "9" * 5000 + " |"]
)
def test_truncated_and_unbounded_iteration_rows_refuse(
    tmp_path: Path, row: str
) -> None:
    run = Scenario(tmp_path)
    text = run.body.read_text(encoding="utf-8")
    run.body.write_bytes(text.replace("| refine | pending | 0 |", row).encode())
    run.invoke("summary", expected=4)


def test_ledger_can_be_first_and_phase_row_can_omit_trailing_pipe(
    tmp_path: Path,
) -> None:
    run = Scenario(tmp_path)
    text = run.body.read_text(encoding="utf-8")
    start = text.index("## Ticket Pipeline Execution Ledger")
    text = text[start:] + "\n" + text[:start]
    text = text.replace("| refine | pending | 0 |", "| refine | pending | 0")
    run.body.write_bytes(text.encode())
    assert "next_phase\trefine\n" in run.invoke("summary")
    run.complete("refine", "complete")
    assert "next_phase\tchallenge\n" in run.invoke("summary")
