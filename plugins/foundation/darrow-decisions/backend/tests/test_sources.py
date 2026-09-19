"""Malformed metadata, fenced Markdown, and supersession graph refusals."""

from dataclasses import replace
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from conftest import Repository, adr
from darrow_decisions.errors import DecisionError, Diagnostics
from darrow_decisions.inventory import inventory
from darrow_decisions.model import Record
from darrow_decisions.parser import parse
from darrow_decisions.relations import validate_relations
from darrow_decisions.validation import valid_date, validate_record


def problems(text: str, name: str = "ADR-0001-test.md") -> list[str]:
    parsed = parse(text)
    errors = Diagnostics()
    validate_record(parsed, parsed.record(Path(name)), errors)
    return errors.messages


@pytest.mark.parametrize(
    ("before", "after", "message"),
    [
        ("# ADR-0001: Use SQLite", "# ADR-0001:", "ADR title is empty"),
        (
            "# ADR-0001: Use SQLite",
            "# ADR-0001: " + "é" * 121,
            "title exceeds 240 bytes",
        ),
        ("ADR-0001", "ADR-1", "unsupported ADR identifier"),
        ("ADR-0001", "ADR-" + "1" * 19, "18-digit limit"),
        ("Status: Accepted", "Status: Draft", "unsupported decision status: Draft"),
        ("Status: Accepted", "Status: " + "a" * 33, "decision status exceeds 32"),
        ("Status: Accepted", "", "Status field; found 0"),
        (
            "Status: Accepted",
            "Status: Accepted\nStatus: Accepted",
            "Status field; found 2",
        ),
        ("Date: 2026-07-19", "Date: 2026-02-30", "not a valid ISO calendar date"),
        ("Date: 2026-07-19", "Date: " + "x" * 33, "Date exceeds 32"),
        ("Date: 2026-07-19", "", "Date field; found 0"),
        ("Summary: Use SQLite.", "Summary: ", "Summary field is blank"),
        ("Summary: Use SQLite.", "Summary: " + "é" * 251, "Summary exceeds 500"),
        ("Summary: Use SQLite.", "", "Summary field; found 0"),
        ("## Context", "## Other", "Context section must occur once"),
        ("The choice is explicit.", "", "Decision section must occur once"),
        ("Consequences.", "", "Consequences section must occur once"),
        (
            "## Consequences",
            "## Consequences\n\nextra\n\n## Consequences",
            "Consequences section must occur once",
        ),
        ("## Context", "```\n## Context", "Markdown fence is not closed"),
    ],
)
def test_malformed_sources(before: str, after: str, message: str) -> None:
    assert any(message in error for error in problems(adr().replace(before, after)))


@pytest.mark.parametrize("key", ["Supersedes", "Superseded by", "Revisit when"])
def test_optional_metadata(key: str) -> None:
    assert any(
        f"{key} field is blank" in error
        for error in problems(adr(metadata=f"{key}:\n"))
    )
    assert any(
        f"duplicate {key} fields" in error
        for error in problems(adr(metadata=f"{key}: x\n{key}: y\n"))
    )
    assert any(
        f"{key} exceeds" in error
        for error in problems(adr(metadata=f"{key}: " + "x" * 1001 + "\n"))
    )


def test_heading_and_sections() -> None:
    assert any(
        "filename does not carry" in error for error in problems(adr(), "notes.md")
    )
    assert any("disagrees" in error for error in problems(adr(), "ADR-0002-test.md"))
    assert any("heading has no identifier" in error for error in problems("nothing"))
    assert any(
        "found 2" in error for error in problems(adr() + "\n# ADR-0002: Duplicate\n")
    )
    text = adr(body="  ~~~lang\n# ADR-9999: not metadata\n```\n~~~\n### Nested\ntext")
    assert problems("\ufeff" + text) == []
    assert (
        problems(
            adr()
            .replace("# ADR-0001:", "   # ADR-0001:")
            .replace("## Context", "## Context ##")
        )
        == []
    )
    assert problems(adr().replace("Context.", "### Empty subsection"))


@pytest.mark.parametrize(
    "date", ["2000-02-29", "2024-02-29", "9999-12-31", "0001-01-01"]
)
def test_calendar_dates(date: str) -> None:
    assert valid_date(date)


@pytest.mark.parametrize(
    "date", ["1900-02-29", "0000-01-01", "2026-1-01", "2026-13-01", "x"]
)
def test_invalid_calendar_dates(date: str) -> None:
    assert not valid_date(date)


def test_bounded_diagnostics(repo: Repository) -> None:
    for index in range(50):
        repo.write(f"ADR-{index:04d}", status="Unknown")
    with pytest.raises(DecisionError) as caught:
        inventory(repo.directory)
    assert caught.value.code == 4
    assert len(str(caught.value).splitlines()) == 41
    assert str(caught.value).endswith("10 additional diagnostics omitted")


def record(
    identifier: str,
    status: str = "Accepted",
    supersedes: str = "",
    superseded_by: str = "",
) -> Record:
    return replace(
        parse(adr(identifier, status=status)).record(Path(f"{identifier}.md")),
        supersedes=supersedes,
        superseded_by=superseded_by,
    )


@pytest.mark.parametrize(
    ("records", "message"),
    [
        ([record("ADR-0001"), record("ADR-0001")], "duplicate ADR identifier"),
        ([record("ADR-0001", supersedes="bad")], "invalid Supersedes identifier"),
        (
            [record("ADR-0001", supersedes="ADR-0002, ADR-0002")],
            "duplicate Supersedes target",
        ),
        ([record("ADR-0001", supersedes="ADR-0001")], "cannot relate to itself"),
        ([record("ADR-0001", supersedes="ADR-0002")], "target does not exist"),
        (
            [record("ADR-0001", supersedes="ADR-0002"), record("ADR-0002")],
            "must have status Superseded",
        ),
        (
            [
                record("ADR-0001", supersedes="ADR-0002"),
                record("ADR-0002", "Superseded", superseded_by="ADR-0003"),
            ],
            "does not reciprocate",
        ),
        (
            [record("ADR-0001", "Proposed", supersedes="ADR-0002")],
            "allowed only on an Accepted",
        ),
        ([record("ADR-0001", superseded_by="ADR-0002")], "requires status Superseded"),
        ([record("ADR-0001", "Superseded")], "requires Superseded by"),
        (
            [
                record("ADR-0001", "Superseded", superseded_by="ADR-0002"),
                record("ADR-0002", "Proposed"),
            ],
            "replacement ADR-0002 must have status",
        ),
        ([record("ADR-0001", supersedes=",".join(["x"] * 51))], "more than 50 targets"),
    ],
)
def test_graph_refusals(records: list[Record], message: str) -> None:
    errors = Diagnostics()
    validate_relations(records, errors)
    assert any(message in error for error in errors.messages)


@given(st.integers(min_value=2, max_value=80), st.booleans())
@settings(max_examples=30, derandomize=True)
def test_generated_supersession_chains(length: int, cycle: bool) -> None:
    records = []
    for index in range(length):
        previous = (
            f"ADR-{index:04d}" if index else (f"ADR-{length:04d}" if cycle else "")
        )
        following = (
            f"ADR-{index + 2:04d}"
            if index < length - 1
            else ("ADR-0001" if cycle else "")
        )
        records.append(
            record(
                f"ADR-{index + 1:04d}",
                "Superseded" if following else "Accepted",
                supersedes=previous,
                superseded_by=following,
            )
        )
    errors = Diagnostics()
    validate_relations(records, errors)
    assert bool(errors.count) == cycle
    if cycle:
        assert "cycle detected" in errors.messages[-1]


@given(
    st.text(alphabet="abcXYZé|&[]<>\\ ", min_size=1, max_size=60).filter(
        lambda text: bool(text.strip())
    )
)
@settings(max_examples=50, derandomize=True)
def test_frontmatter_roundtrip(title: str) -> None:
    title = title.strip(" \t")
    parsed = parse(adr(title=title))
    result = parsed.record(Path("ADR-0001-test.md"))
    assert result.title == title
    assert result.summary == title + "."
    assert problems(adr(title=title)) == []


@given(st.text(alphabet="ABC xyz012#\n\t`~:", max_size=100))
@settings(max_examples=60, derandomize=True)
def test_fenced_metadata_cannot_override_authority(payload: str) -> None:
    # A long matching fence cannot be closed by any generated run.
    fence = "~" * 101
    text = adr(body=f"{fence}\nStatus: Rejected\n{payload}\n{fence}")
    parsed = parse(text)
    assert parsed.record(Path("ADR-0001-test.md")).status == "Accepted"
    assert parsed.counts["Status"] == 1
