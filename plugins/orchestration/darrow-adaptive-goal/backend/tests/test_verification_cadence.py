from __future__ import annotations

from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from evals.verification_cadence import InvalidCadenceError, main, validate


@settings(derandomize=True, deadline=None, max_examples=200)
@given(st.lists(st.tuples(st.sampled_from(["focused", "final"]), st.booleans())))
def test_cadence_matches_latest_success_and_required_order(
    events: list[tuple[str, bool]],
) -> None:
    last_focus_failure = max(
        (
            i
            for i, (stage, passed) in enumerate(events)
            if stage == "focused" and not passed
        ),
        default=-1,
    )
    successful_feedback = [
        i
        for i, (stage, passed) in enumerate(events)
        if stage == "focused" and passed and i > last_focus_failure
    ]
    last_final = max(
        (i for i, (stage, _) in enumerate(events) if stage == "final"), default=-1
    )
    valid = bool(
        successful_feedback
        and last_final > successful_feedback[0]
        and events[last_final][1]
    )
    records = [f"{stage}\t{'pass' if passed else 'fail'}\n" for stage, passed in events]
    if valid:
        validate(records)
    else:
        with pytest.raises(InvalidCadenceError):
            validate(records)


@pytest.mark.parametrize(
    "invalid",
    ["", "focused pass", "focused\tpass\textra", "other\tpass", "final\tunknown"],
)
def test_invalid_evidence_cannot_hide_between_valid_records(invalid: str) -> None:
    with pytest.raises(InvalidCadenceError, match="Invalid verification record"):
        validate(["focused\tpass\n", invalid + "\n", "final\tpass\n"])


@pytest.mark.parametrize(
    "contents",
    [None, b"", b"\xff", b"final\tpass\n", b"focused\tpass\nfinal\tpass\n"],
)
def test_command_preserves_evidence_and_reports_missing_or_invalid_input(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], contents: bytes | None
) -> None:
    path = tmp_path / "verification trace"
    if contents is not None:
        path.write_bytes(contents)
    status = main([str(path)])
    assert status == (0 if contents == b"focused\tpass\nfinal\tpass\n" else 1)
    assert capsys.readouterr().out
    assert path.exists() == (contents is not None)
    if contents is not None:
        assert path.read_bytes() == contents
