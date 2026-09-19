"""Exact presentation contracts retained from the former shell suite."""

from __future__ import annotations

from pathlib import Path

import pytest

from darrow_review import cli, report
from darrow_review.common import blob_hash, rows
from fixtures import change, write

GOLDEN = Path(__file__).with_name("golden")


@pytest.mark.parametrize(
    ("name", "operation"),
    [("comprehensive", "render"), ("verification", "render-verification")],
)
def test_complete_report_bytes(name: str, operation: str, tmp_path: Path) -> None:
    # Preserve the original Unix goldens; qualify their absolute root on Windows.
    root = f"{tmp_path.drive}/workspace/"
    source = (GOLDEN / f"{name}.tsv").read_text(encoding="utf-8")
    record = tmp_path / "result.tsv"
    record.write_text(source.replace("/workspace/", root), encoding="utf-8")
    actual = cli.report_command([operation, str(record)])
    expected = (GOLDEN / f"{name}.txt").read_text(encoding="utf-8")
    assert actual == expected.replace("/workspace/", root)


def test_checksum_bound_report_bytes(tmp_path: Path) -> None:
    original = rows((GOLDEN / "verification.tsv").read_text(encoding="utf-8"))
    previous = Path(write(tmp_path / "previous.tsv", original))
    current = change(original, "prior_target", "WORKTREE@base+repair-one")
    current = change(current, "current_target", "WORKTREE@base+repair-two")
    current = change(
        current,
        "previous_verification",
        blob_hash(previous.read_bytes()),
        str(previous),
    )
    current.append(["history_target", "WORKTREE@base+original"])
    path = write(tmp_path / "current.tsv", current)
    actual = cli.report_command(["render-verification", path])
    assert actual.replace(report.escape(str(previous)), "PREVIOUS_ARTIFACT") == (
        GOLDEN / "verification-next.txt"
    ).read_text(encoding="utf-8")
