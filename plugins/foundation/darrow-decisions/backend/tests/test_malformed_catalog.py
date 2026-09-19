"""Malformed catalog structures must fail closed at explicit validation."""

import io
from pathlib import Path
from unittest.mock import patch

import pytest

from conftest import adr
from darrow_decisions import cli
from darrow_decisions.catalog_format import (
    TABLE,
    CatalogRow,
    parse_record,
    parse_source,
    render,
)
from darrow_decisions.catalog_parse import parse_catalog
from darrow_decisions.parser import parse


@pytest.mark.parametrize(
    "row",
    [
        "| too | few |",
        "| [ADR-0001: title](ADR-0001.md) | Accepted | 2026-01-01 | summary | None | injected",
        "| [ADR-0001: title](ADR-0001.md) | Proposed | 2026-01-01 | summary | None |",
        "| [ADR-0001: title](../ADR-0001.md) | Accepted | 2026-01-01 | summary | None |",
        "| [ADR-0001: title](ADR-0001-%.md) | Accepted | 2026-01-01 | summary | None |",
    ],
)
def test_malformed_visible_rows(row: str) -> None:
    with pytest.raises(ValueError):
        parse_record(row, "Accepted", Path("."))


def test_bad_source_marker() -> None:
    record = parse(adr()).record(Path("ADR-0001.md"))
    with pytest.raises(ValueError, match="invalid source marker"):
        parse_source("<!-- darrow-source: invalid -->", record)


@pytest.mark.parametrize(
    "mutation",
    [
        "duplicate-header",
        "missing-header",
        "missing-section",
        "missing-source",
        "duplicate-id",
        "duplicate-name",
        "missing-introduction",
    ],
)
def test_malformed_catalog_structure(mutation: str) -> None:
    first = parse(adr()).record(Path("ADR-0001.md"))
    second = parse(adr("ADR-0002")).record(Path("ADR-0002.md"))
    data = render(
        [CatalogRow(first, "a" * 40, 1, 1), CatalogRow(second, "b" * 40, 1, 1)]
    )
    table = TABLE.encode()
    header = table.splitlines(keepends=True)[1]
    malformed = {
        "duplicate-header": data.replace(header, header * 2, 1),
        "missing-header": data.replace(table, b"", 2),
        "missing-section": data.replace(b"## Proposed\n", b""),
        "missing-source": b"\n".join(
            line
            for line in data.split(b"\n")
            if not line.startswith(b"<!-- darrow-source:")
        ),
        "duplicate-id": data.replace(b"ADR-0002:", b"ADR-0001:"),
        "duplicate-name": data.replace(b"ADR-0002.md", b"ADR-0001.md"),
        "missing-introduction": data.replace(b"# ADR Catalog\n", b""),
    }
    with pytest.raises(ValueError):
        parse_catalog(malformed[mutation], Path("."))


def test_entrypoint_emits_utf8_without_platform_newline_conversion() -> None:
    stream = io.TextIOWrapper(io.BytesIO(), encoding="ascii")
    with (
        patch("sys.stdout", stream),
        patch("sys.stderr", stream),
        patch(
            "sys.argv",
            [
                "darrow-decision",
                "check-transition",
                "--from",
                "Proposed",
                "--to",
                "Accepted",
            ],
        ),
        pytest.raises(SystemExit, match="0"),
    ):
        cli.entrypoint()
    assert stream.encoding == "utf-8"
    stream.flush()
    assert stream.buffer.getvalue() == b"Proposed -> Accepted: allowed\n"


def test_entrypoint_supports_redirected_string_streams() -> None:
    output = io.StringIO()
    with (
        patch("sys.stdout", output),
        patch("sys.stderr", output),
        patch(
            "sys.argv",
            [
                "darrow-decision",
                "check-transition",
                "--from",
                "Proposed",
                "--to",
                "Accepted",
            ],
        ),
        pytest.raises(SystemExit, match="0"),
    ):
        cli.entrypoint()
    assert output.getvalue() == "Proposed -> Accepted: allowed\n"


def test_filesystem_race_is_a_refusal(capsys: pytest.CaptureFixture[str]) -> None:
    with patch(
        "darrow_decisions.cli.run",
        side_effect=PermissionError("record became unreadable"),
    ):
        assert cli.main(["inspect"]) == 2
    assert (
        capsys.readouterr().err
        == "error: decision filesystem operation failed: record became unreadable\n"
    )
