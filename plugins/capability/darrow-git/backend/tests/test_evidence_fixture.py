"""Serialization contracts for the independent publication fixture."""

import re
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from evidence_gh import comment_record, render


@given(st.text())
@settings(derandomize=True)
def test_comment_tsv_round_trip(body: str) -> None:
    identifier, url, field = comment_record(body).removesuffix("\n").split("\t")
    assert identifier == "9"
    assert url.endswith("#issuecomment-9")
    decoded = re.sub(
        r"\\([\\rtn])",
        lambda match: {"\\": "\\", "r": "\r", "t": "\t", "n": "\n"}[match[1]],
        field,
    )
    assert decoded == body.removesuffix("\n")


def test_attachment_names_are_literal_and_content_bytes_survive(tmp_path: Path) -> None:
    path = tmp_path / "body"
    path.write_bytes(b"[image](file[1].svg)\r\nC:\\tmp\n")
    assert render(path, ["file[1].svg"], "") == (
        "[image](https://github.com/user-attachments/assets/mock-1)\r\nC:\\tmp\n"
    )
