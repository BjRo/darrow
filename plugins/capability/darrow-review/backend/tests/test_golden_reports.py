"""Exact presentation contracts retained from the former shell suite."""

from __future__ import annotations

from pathlib import Path

import pytest

from darrow_review import cli, report
from darrow_review.common import blob_hash, document, serialize

GOLDEN = Path(__file__).with_name("golden")


@pytest.mark.parametrize(
    ("name", "operation"),
    [("comprehensive", "render"), ("verification", "render-verification")],
)
def test_complete_report_bytes(name: str, operation: str, tmp_path: Path) -> None:
    # Preserve the original Unix goldens; qualify their absolute root on Windows.
    root = f"{tmp_path.drive}/workspace/"
    source = (GOLDEN / f"{name}.json").read_text(encoding="utf-8")
    record = tmp_path / "result.json"
    record.write_text(source.replace("/workspace/", root), encoding="utf-8")
    actual = cli.report_command([operation, str(record)])
    expected = (GOLDEN / f"{name}.txt").read_text(encoding="utf-8")
    report_name = "verification.md" if name == "verification" else "review.md"
    report_path = record.parent / report_name
    assert actual == (
        expected.replace("/workspace/", root)
        + f"\nComplete review report: [report](<{report_path}>)\n"
    )


def test_checksum_bound_report_bytes(tmp_path: Path) -> None:
    original = document((GOLDEN / "verification.json").read_text(encoding="utf-8"))
    previous = tmp_path / "previous.json"
    previous.write_text(serialize(original), encoding="utf-8")
    current = {
        **original,
        "prior_target": "WORKTREE@base+repair-one",
        "current_target": "WORKTREE@base+repair-two",
        "previous_verification": {
            "checksum": blob_hash(previous.read_bytes()),
            "path": str(previous),
        },
        "history_targets": ["WORKTREE@base+original"],
    }
    path = tmp_path / "current.json"
    path.write_text(serialize(current), encoding="utf-8")
    actual = cli.report_command(["render-verification", str(path)])
    assert (
        actual.replace(report.escape(str(previous)), "PREVIOUS_ARTIFACT")
        == (GOLDEN / "verification-next.txt")
        .read_text(encoding="utf-8")
        .replace("PREVIOUS_CHECKSUM", blob_hash(previous.read_bytes()))
        + f"\nComplete review report: [report](<{path.parent / 'verification.md'}>)\n"
    )


def test_report_destination_escapes_markdown_delimiters() -> None:
    assert report.escape_destination("/tmp/a% b#c?d<e>f\\g") == (
        "/tmp/a%25%20b%23c%3Fd%3Ce%3Ef%5Cg"
    )
