"""A small Markdown state machine for the existing ADR metadata dialect."""

import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .model import CONTROL, FIELDS, SECTIONS, Record

HEADING = re.compile(r"^(#{1,6})[ \t]+(.*)$")
FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")


@dataclass
class Parsed:
    values: dict[str, str] = field(default_factory=dict)
    counts: Counter[str] = field(default_factory=Counter)
    content: set[str] = field(default_factory=set)
    section: str = ""
    metadata: bool = True
    fence: str = ""

    def fence_line(self, line: str, scan: str) -> bool:
        match = FENCE.match(scan)
        if match:
            self.toggle_fence(match[1], match[2], line)
            return True
        if self.fence:
            self.mark_content(line)
            return True
        return False

    def toggle_fence(self, marker: str, tail: str, line: str) -> None:
        if not self.fence:
            self.fence = marker
        elif (
            marker[0] == self.fence[0]
            and len(marker) >= len(self.fence)
            and not tail.strip(" \t")
        ):
            self.fence = ""
        else:
            self.mark_content(line)

    def mark_content(self, line: str) -> None:
        if self.section and line.strip(" \t"):
            self.content.add(self.section)

    def heading(self, level: int, text: str) -> None:
        text = re.sub(r"[ \t]+#+[ \t]*$", "", text.strip(" \t"))
        if level == 1 and text.startswith("ADR-"):
            self.counts["heading"] += 1
            identifier, _, title = text.partition(":")
            self.values.update(
                identifier=identifier.strip(" \t"), title=title.strip(" \t")
            )
        if level <= 2:
            self.section = ""
        if level == 2:
            self.start_section(text)

    def start_section(self, text: str) -> None:
        self.metadata = False
        if text in SECTIONS:
            self.section = text
            self.counts[text] += 1

    def ordinary_line(self, line: str) -> None:
        key, separator, value = line.partition(":")
        if self.metadata and separator and key in FIELDS:
            self.counts[key] += 1
            self.values[key] = value.strip(" \t")
        else:
            self.mark_content(line)

    def record(self, path: Path) -> Record:
        keys = ("identifier", "title", *FIELDS)
        identifier, title, status, date, summary, supersedes, replaced, revisit = (
            CONTROL.sub(" ", self.values.get(key, "")) for key in keys
        )
        return Record(
            identifier,
            title,
            status,
            date,
            summary,
            supersedes,
            replaced,
            revisit,
            path,
        )


def parse(text: str) -> Parsed:
    result = Parsed()
    # Split only LF: other control bytes belong to metadata, not line boundaries.
    lines = text.removeprefix("\ufeff").split("\n")
    for line in lines:
        scan = re.sub(r"^ {0,3}", "", line)
        if result.fence_line(line, scan):
            continue
        match = HEADING.match(scan)
        if match:
            result.heading(len(match[1]), match[2])
        else:
            result.ordinary_line(line)
    return result
