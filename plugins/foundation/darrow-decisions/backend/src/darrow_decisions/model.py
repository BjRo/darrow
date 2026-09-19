"""Decision records shared by source validation and derived catalogs."""

import re
from dataclasses import dataclass
from pathlib import Path

STATUSES = ("Proposed", "Accepted", "Rejected", "Deprecated", "Superseded")
EFFECTIVE = frozenset(("Accepted", "Deprecated", "Superseded"))
CONTROL = re.compile(r"[\x00-\x1f\x7f]")
IDENTIFIER = re.compile(r"ADR-[0-9]{4,18}")
FIELDS = ("Status", "Date", "Summary", "Supersedes", "Superseded by", "Revisit when")
SECTIONS = ("Context", "Decision", "Consequences")


def byte_length(value: str) -> int:
    return len(value.encode("utf-8", errors="surrogateescape"))


def relation_ids(value: str) -> list[str]:
    return [part.strip(" \t") for part in value.split(",")] if value else []


@dataclass(frozen=True)
class Record:
    identifier: str
    title: str
    status: str
    date: str
    summary: str
    supersedes: str
    superseded_by: str
    revisit: str
    path: Path

    def values(self) -> tuple[str, ...]:
        return (
            self.identifier,
            self.title,
            self.status,
            self.date,
            self.summary,
            self.supersedes,
            self.superseded_by,
            self.revisit,
        )

    def sort_key(self) -> bytes:
        return "\x1c".join((*self.values(), str(self.path))).encode(
            "utf-8", errors="surrogateescape"
        )
