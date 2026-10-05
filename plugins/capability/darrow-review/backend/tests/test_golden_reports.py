"""Exact presentation contracts retained from the former shell suite."""

from __future__ import annotations

from html import unescape
from pathlib import Path
from typing import cast
from urllib.parse import unquote

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli, report
from darrow_review.common import blob_hash, document, serialize

GOLDEN = Path(__file__).with_name("golden")


def assert_complete_report(actual: str, expected: str, report_path: Path) -> None:
    body, separator, destination = actual.rpartition(
        "\nComplete review report: [report](<"
    )
    assert body == expected
    assert separator
    assert not any(character in destination[:-3] for character in " \\#?<>")
    assert unquote(destination) == f"{report_path}>)\n"


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
    assert_complete_report(
        actual,
        expected.replace("/workspace/", root),
        report_path,
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
    assert_complete_report(
        actual.replace(report.escape(str(previous)), "PREVIOUS_ARTIFACT"),
        (GOLDEN / "verification-next.txt")
        .read_text(encoding="utf-8")
        .replace("PREVIOUS_CHECKSUM", blob_hash(previous.read_bytes())),
        path.parent / "verification.md",
    )


def test_report_destination_escapes_markdown_delimiters() -> None:
    assert report.escape_destination("/tmp/a% b#c?d<e>f\\g") == (
        "/tmp/a%25%20b%23c%3Fd%3Ce%3Ef%5Cg"
    )


@pytest.mark.parametrize(
    ("name", "operation", "finding_set"),
    [
        ("comprehensive", "render", "findings"),
        ("verification", "render-verification", "original_findings"),
    ],
)
def test_reports_preserve_leading_underscore_paths_without_emphasis(
    name: str, operation: str, finding_set: str, tmp_path: Path
) -> None:
    root = f"{tmp_path.drive}/workspace/"
    source = (GOLDEN / f"{name}.json").read_text(encoding="utf-8")
    record = document(source.replace("/workspace/", root))
    finding = cast(list[dict[str, str]], record[finding_set])[0]
    finding["location"] = "/workspace/_cache/_module/file_name.js:1"
    finding["source"] = "/workspace/_rules/AGENTS.md"
    finding["evidence"] = "Keep _pending, _emphasis_ and __unsafe__ literal"
    check = cast(list[dict[str, str]], record["checks"])[0]
    check["command"] = "bash _check.sh"
    check["evidence"] = "result_ <script> [link](evil)"
    path = tmp_path / "result.json"
    path.write_text(serialize(record), encoding="utf-8")

    rendered = cli.report_command([operation, str(path)])

    assert "/workspace/_cache/_module/file_name.js:1" in rendered
    assert "/workspace/_rules/AGENTS.md" in rendered
    assert (
        "Keep _pending, _emphasis&#95; and &#95;&#95;unsafe&#95;&#95; literal"
        in rendered
    )
    assert "bash _check.sh: result&#95; &lt;script&gt; &#91;link&#93;(evil)" in rendered


@settings(max_examples=50, derandomize=True)
@given(
    st.lists(
        st.text(
            alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            min_size=1,
            max_size=12,
        ),
        min_size=1,
        max_size=5,
    )
)
def test_leading_underscore_paths_stay_readable(parts: list[str]) -> None:
    path = "/" + "/".join("_" + part for part in parts)
    assert report.escape(path) == path


@settings(max_examples=100, derandomize=True)
@given(st.text())
def test_report_escaping_preserves_visible_field_value(value: str) -> None:
    expected = value.replace("\r", "\\r").replace("\n", "\\n").replace("\t", "\\t")
    assert unescape(report.escape(value)) == expected
