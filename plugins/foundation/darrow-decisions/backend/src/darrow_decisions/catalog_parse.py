"""Parse catalog structure independently of source body parsing."""

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .catalog_format import INTRO, TABLE, CatalogRow, parse_record, parse_source
from .model import STATUSES, Record

CONSTANTS = Counter(line for line in (INTRO + TABLE * 5).splitlines() if line.strip())


@dataclass
class CatalogParser:
    directory: Path
    counts: Counter[str] = field(default_factory=Counter)
    sections: list[str] = field(default_factory=list)
    records: list[Record] = field(default_factory=list)
    rows: list[CatalogRow] = field(default_factory=list)
    current: str = ""
    tables: Counter[tuple[str, str]] = field(default_factory=Counter)

    def consume(self, line: str) -> None:
        if line in CONSTANTS:
            self.constant(line)
        elif line.startswith("## "):
            self.current = line[3:]
            self.sections.append(self.current)
        elif line.startswith("| "):
            self.record(line)
        elif line.startswith("<!-- darrow-source: ") and len(self.rows) < len(
            self.records
        ):
            self.rows.append(parse_source(line, self.records[len(self.rows)]))
        else:
            raise ValueError("unsupported catalog line")

    def constant(self, line: str) -> None:
        self.counts[line] += 1
        if line.startswith("|"):
            key = self.current, line
            self.tables[key] += 1
            if self.current not in STATUSES or self.tables[key] != 1:
                raise ValueError("invalid table header")

    def record(self, line: str) -> None:
        if not all(
            self.tables[self.current, header] == 1 for header in TABLE.splitlines()[1:]
        ):
            raise ValueError("missing table header")
        self.records.append(parse_record(line, self.current, self.directory))


def parse_catalog(data: bytes, directory: Path) -> list[CatalogRow]:
    parser = CatalogParser(directory)
    for line in data.decode("utf-8", errors="surrogateescape").split("\n"):
        if line.strip(" \t"):
            parser.consume(line)
    validate_counts(
        parser.counts, CONSTANTS, parser.sections, parser.records, parser.rows
    )
    return parser.rows


def validate_counts(
    counts: Counter[str],
    constants: Counter[str],
    sections: list[str],
    records: list[Record],
    rows: list[CatalogRow],
) -> None:
    if counts != constants or sorted(sections) != sorted(STATUSES):
        raise ValueError("invalid catalog structure")
    if len(records) != len(rows):
        raise ValueError("missing catalog sources")
    if len({record.identifier for record in records}) != len(records):
        raise ValueError("duplicate catalog identifier")
    if len({record.path.name for record in records}) != len(records):
        raise ValueError("duplicate catalog filename")
