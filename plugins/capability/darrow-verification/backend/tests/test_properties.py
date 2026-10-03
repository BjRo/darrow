import os
import string
import tempfile
from io import BytesIO
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

from darrow_verification.assessment import escape_destination, main


@given(
    value=st.text(
        alphabet=string.ascii_letters + string.digits + " /#%?<>\\[]()_-.",
        min_size=1,
        max_size=80,
    )
)
def test_destination_escaping_preserves_order_and_safe_characters(value: str) -> None:
    escapes = {
        "%": "%25",
        " ": "%20",
        "#": "%23",
        "?": "%3F",
        "<": "%3C",
        ">": "%3E",
        "\\": "%5C",
    }
    expected = "".join(escapes.get(character, character) for character in value)

    assert escape_destination(value) == expected


@given(body=st.binary(min_size=1, max_size=512))
def test_rendering_preserves_every_assessment_byte(body: bytes) -> None:
    with tempfile.TemporaryDirectory() as directory:
        assessment = Path(directory) / "assessment.md"
        report = Path(directory) / "report.md"
        assessment.write_bytes(body)
        report.write_bytes(b"Provider result.\n")
        stdout = BytesIO()
        stderr = BytesIO()

        status = main(
            (
                "--assessment",
                str(assessment),
                "--provider-report",
                str(report),
            ),
            stdout=stdout,
            stderr=stderr,
        )

        assert status == 0
        assert stderr.getvalue() == b""
        assert stdout.getvalue() == (
            body
            + b"\n\nComplete provider result: [report](<"
            + os.fsencode(
                escape_destination(os.fspath(report.parent.resolve() / report.name))
            )
            + b">)\n"
        )
