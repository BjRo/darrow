from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from evals.review_receipts import InvalidReceiptError, main, validate


def records(target: str, record_format: str) -> list[str]:
    if record_format == "comprehensive":
        return [f"{target}\tclear\tcomprehensive"]
    return [f"review\t{target}"]


@pytest.mark.parametrize("record_format", ["comprehensive", "events"])
@given(
    target=st.text(alphabet=st.characters(exclude_categories=["C"]), max_size=40),
    copies=st.integers(min_value=1, max_value=8),
    position=st.integers(min_value=0, max_value=8),
)
def test_current_receipts_may_repeat_but_never_dilute_invalid_evidence(
    record_format: str, target: str, copies: int, position: int
) -> None:
    expected = f"WORKTREE@{target}"
    valid = records(expected, record_format) * copies
    assert validate(valid, expected, record_format) == copies
    for bad in [*records(expected + "stale", record_format), valid[0] + "\textra"]:
        changed = valid.copy()
        changed.insert(position % (copies + 1), bad)
        with pytest.raises(InvalidReceiptError, match="Invalid independent review"):
            validate(changed, expected, record_format)


@pytest.mark.parametrize(
    "lines,record_format",
    [
        ([], "comprehensive"),
        ([""], "comprehensive"),
        (["target\tblocked\tcomprehensive"], "comprehensive"),
        (["target\tclear\tverify"], "comprehensive"),
        (["target\tclear\tcomprehensive\textra"], "comprehensive"),
        (["review"], "events"),
        (["check\ttarget", "publication\tbranch\thead"], "events"),
    ],
)
def test_missing_malformed_and_uncleared_receipts_fail(
    lines: Iterable[str], record_format: str
) -> None:
    with pytest.raises(InvalidReceiptError):
        validate(lines, "target", record_format)


def test_events_ignore_unrelated_records_but_require_every_review_to_match() -> None:
    assert (
        validate(
            [
                "check\tpass",
                "review\ttarget",
                "publication\tbranch\thead",
                "review\ttarget",
            ],
            "target",
            "events",
        )
        == 2
    )
    with pytest.raises(InvalidReceiptError):
        validate(["review\ttarget", "review\tstale"], "target", "events")


@pytest.mark.parametrize(
    "contents", [None, b"", b"\xff", b"review\tstale\n", b"review\ttarget\n"]
)
def test_command_reports_real_input_errors_without_mutating_receipts(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], contents: bytes | None
) -> None:
    path = tmp_path / "receipts"
    if contents is not None:
        path.write_bytes(contents)
    status = main(["--format", "events", "--expected", "target", str(path)])
    assert status == (0 if contents == b"review\ttarget\n" else 1)
    assert "Expected reviewed target: target" in capsys.readouterr().out
    assert path.exists() == (contents is not None)
    if contents is not None:
        assert path.read_bytes() == contents
