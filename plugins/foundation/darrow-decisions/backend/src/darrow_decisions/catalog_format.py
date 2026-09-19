"""Byte-stable v2 Markdown catalog encoding, with its public POSIX checksum."""

import re
from dataclasses import dataclass
from pathlib import Path

from .model import STATUSES, Record

FORMAT = "<!-- darrow-adr-catalog-v2 -->"
INTRO = (
    "# ADR Catalog\n\n"
    "This checked-in catalog is derived, non-authoritative metadata. ADR files remain canonical.\n"
    "Rebuild it with `decision catalog rebuild` and verify it with `decision catalog check`.\n\n"
    f"{FORMAT}\n"
)
TABLE = (
    "<!-- prettier-ignore -->\n"
    "| Decision | Status | Date | Summary | Relationships |\n"
    "| --- | --- | --- | --- | --- |\n"
)
TARGET_ESCAPES = {char: f"%{ord(char):02X}" for char in "%\\ ()#?|<>"}
TARGET_TRANSLATION = str.maketrans(TARGET_ESCAPES)
TARGET_UNESCAPES = {escaped: char for char, escaped in TARGET_ESCAPES.items()}
CELL_ESCAPES = {"&": "&#38;", "<": "&#60;", ">": "&#62;", "\\": "\\\\", "|": "\\|"}
CELL_TRANSLATION = str.maketrans(CELL_ESCAPES)
LABEL_TRANSLATION = str.maketrans(CELL_ESCAPES | {"[": "\\[", "]": "\\]"})


def target(value: str) -> str:
    return value.translate(TARGET_TRANSLATION)


def untarget(value: str) -> str:
    return re.sub(
        r"%[0-9A-F]{2}", lambda match: TARGET_UNESCAPES.get(match[0], match[0]), value
    )


def cell(value: str, *, label: bool = False) -> str:
    return value.translate(LABEL_TRANSLATION if label else CELL_TRANSLATION)


def unhtml(value: str) -> str:
    return value.replace("&#60;", "<").replace("&#62;", ">").replace("&#38;", "&")


def relationships(record: Record) -> str:
    pairs = (
        ("Supersedes", record.supersedes),
        ("Superseded by", record.superseded_by),
        ("Revisit when", record.revisit),
    )
    return "; ".join(f"{key}: {value}" for key, value in pairs if value) or "None"


def crc_byte(crc: int, value: int) -> int:
    crc ^= value << 24
    for _ in range(8):
        crc = (crc << 1) ^ (0x04C11DB7 if crc & 0x80000000 else 0)
    return crc & 0xFFFFFFFF


def checksum(payload: bytes) -> tuple[int, int]:
    crc = 0
    for value in payload:
        crc = crc_byte(crc, value)
    length = len(payload)
    while length:
        crc = crc_byte(crc, length & 255)
        length >>= 8
    return (~crc & 0xFFFFFFFF, len(payload))


@dataclass(frozen=True)
class CatalogRow:
    record: Record
    fingerprint: str
    crc: int
    size: int

    def signature(self) -> bytes:
        name = self.record.path.name
        return (
            "\t".join((self.fingerprint, name, target(name), *self.record.values()))
            + "\n"
        ).encode("utf-8", errors="surrogateescape")

    def valid_checksum(self) -> bool:
        return checksum(self.signature()) == (self.crc, self.size)


def row_text(row: CatalogRow) -> str:
    record = row.record
    return (
        f"| [{cell(record.identifier + ': ' + record.title, label=True)}]"
        f"({target(record.path.name)}) | {record.status} | {record.date} | "
        f"{cell(record.summary)} | {cell(relationships(record))} |\n"
    )


def render(rows: list[CatalogRow]) -> bytes:
    parts = [INTRO]
    for status in STATUSES:
        group = [row for row in rows if row.record.status == status]
        parts.extend((f"\n## {status}\n\n", TABLE))
        parts.extend(row_text(row) for row in group)
        if group:
            parts.append("\n")
        parts.extend(
            f"<!-- darrow-source: {row.fingerprint} {row.crc} {row.size} "
            f"{target(row.record.path.name)} -->\n"
            for row in group
        )
    return "".join(parts).encode("utf-8", errors="surrogateescape")


def split_cells(line: str) -> list[str]:
    # An escaped backslash consumes its successor before a pipe can delimit.
    if not line.startswith("| ") or not line.endswith(" |"):
        raise ValueError("invalid table row")
    pieces = re.findall(r"((?:\\.|[^\\|])*)\|", line[1:])
    return [re.sub(r"\\(.)", r"\1", value).strip(" \t") for value in pieces]


def parse_relationships(value: str) -> tuple[str, str, str]:
    if value == "None":
        return "", "", ""
    result = []
    rest = value
    for prefix in ("Supersedes: ", "Superseded by: "):
        item = ""
        if rest.startswith(prefix):
            item, _, rest = rest[len(prefix) :].partition("; ")
        result.append(item)
    revisit = (
        rest.removeprefix("Revisit when: ") if rest.startswith("Revisit when: ") else ""
    )
    if (rest and not revisit) or not any((*result, revisit)):
        raise ValueError("invalid relationships")
    return result[0], result[1], revisit


def parse_record(line: str, status: str, directory: Path) -> Record:
    cells = split_cells(line)
    if len(cells) != 5:
        raise ValueError("invalid table cells")
    label, state, date, summary, relations = cells
    match = re.fullmatch(r"\[(ADR-[0-9]{4,}): (.+)\]\((.*)\)", label)
    if not match or state != status or not summary:
        raise ValueError("invalid catalog record")
    name = untarget(match[3])
    if Path(name).name != name or not re.fullmatch(r"ADR-[0-9]+.*\.md", name):
        raise ValueError("invalid catalog filename")
    if target(name) != match[3]:
        raise ValueError("invalid catalog link")
    return Record(
        match[1],
        unhtml(match[2]),
        state,
        date,
        unhtml(summary),
        *parse_relationships(unhtml(relations)),
        directory / name,
    )


def parse_source(line: str, record: Record) -> CatalogRow:
    match = re.fullmatch(
        r"<!-- darrow-source: ([0-9a-f]{40}|[0-9a-f]{64}) ([0-9]+) ([0-9]+) (.+) -->",
        line,
    )
    if not match or untarget(match[4]) != record.path.name:
        raise ValueError("invalid source marker")
    return CatalogRow(record, match[1], int(match[2]), int(match[3]))
