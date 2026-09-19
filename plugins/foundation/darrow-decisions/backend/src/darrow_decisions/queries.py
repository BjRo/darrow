"""Read-only inspection, literal filtering, and next-ID allocation."""

import os
import re
import sys
from pathlib import Path

from . import catalog
from .arguments import Arguments
from .errors import DecisionError
from .inventory import inventory
from .model import STATUSES, Record, byte_length, relation_ids
from .paths import read_bytes


def surfaces(root: Path, names: tuple[str, ...], kind: str) -> None:
    print(f"{kind}-surfaces:")
    found = False
    for name in names:
        path = root / name
        if not path.exists() and not (kind == "policy" and path.is_symlink()):
            continue
        if not os.access(path, os.R_OK):
            raise DecisionError(f"canonical {kind} surface is not readable: {path}")
        suffix = (
            surface_count(path) if kind == "specification" and path.is_dir() else ""
        )
        print(f"  - {path}{suffix}")
        found = True
    if not found:
        print("  - (none detected)")


def surface_count(path: Path) -> str:
    try:
        count = sum(
            entry.is_file() and not entry.is_symlink() and entry.name.endswith(".md")
            for entry in path.iterdir()
        )
    except OSError as error:
        raise DecisionError(
            f"cannot enumerate canonical specification surface: {path}"
        ) from error
    return f" ({count} Markdown files)"


def inspect(root: Path, directory: Path | None) -> None:
    records = inventory(directory)
    print(f"root: {root}")
    print(f"adr-directory: {directory or '(none detected)'}")
    print(f"adr-records: {len(records)}")
    surfaces(root, ("docs/specs", "specs"), "specification")
    surfaces(
        root, ("AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "GOVERNANCE.md"), "policy"
    )


def list_limit(arguments: Arguments) -> int:
    status, related = arguments.get("status"), arguments.get("related-to")
    if status and status not in STATUSES:
        raise DecisionError(f"unsupported decision status: {status}")
    if related and not re.fullmatch(r"ADR-[0-9]{4,}", related):
        raise DecisionError(f"invalid related decision identifier: {related}")
    if byte_length(related) > 22:
        raise DecisionError("related decision identifier exceeds the 18-digit limit")
    return validate_search_limit(arguments)


def validate_search_limit(arguments: Arguments) -> int:
    if byte_length(arguments.get("search")) > 200:
        raise DecisionError("--search must be at most 200 bytes")
    value = arguments.get("limit", "50")
    # Bound before integer conversion, including arbitrarily long leading zeros.
    normalized = value.lstrip("0")
    if not re.fullmatch(r"[0-9]+", value) or not normalized or len(normalized) > 3:
        raise DecisionError("--limit must be an integer from 1 to 200")
    limit = int(normalized)
    if limit > 200:
        raise DecisionError("--limit must be an integer from 1 to 200")
    return limit


def list_inventory(root: Path, directory: Path | None, search: str) -> list[Record]:
    if directory is None:
        return []
    records, problem = catalog.fresh(root, directory)
    if problem:
        print(
            f"warning: ADR catalog is {problem}; using full scan: {directory / 'README.md'}",
            file=sys.stderr,
        )
    if problem or search:
        return inventory(directory)
    return records


def matches(record: Record, arguments: Arguments) -> bool:
    status, related, search = (
        arguments.get(key) for key in ("status", "related-to", "search")
    )
    if status and record.status != status:
        return False
    if related and related not in (
        *relation_ids(record.supersedes),
        *relation_ids(record.superseded_by),
    ):
        return False
    if search:
        body = read_bytes(record.path, "cannot search ADR file")
        return search.encode("utf-8", errors="surrogateescape").lower() in body.lower()
    return True


def listing(root: Path, directory: Path | None, arguments: Arguments) -> None:
    limit = list_limit(arguments)
    records = list_inventory(root, directory, arguments.get("search"))
    matched = [record for record in records if matches(record, arguments)]
    for record in matched[:limit]:
        suffix = "".join(
            f"; {key}: {value}"
            for key, value in (
                ("supersedes", record.supersedes),
                ("superseded by", record.superseded_by),
            )
            if value
        )
        print(
            f"{record.identifier} {record.status} architecture — {record.title} — {record.path}{suffix}"
        )
    print(
        f"total: {len(matched)} (status={arguments.get('status') or 'all'}, "
        f"search={arguments.get('search') or '(none)'}, related-to={arguments.get('related-to') or '(none)'})"
    )
    if len(matched) > limit:
        print(f"note: showing first {limit} of {len(matched)} matching ADRs")


def next_id(directory: Path, title: str) -> None:
    records = inventory(directory)
    highest = max((int(record.identifier[4:]) for record in records), default=0)
    if highest >= 999999999999999999:
        raise DecisionError("ADR identifier space is exhausted", 4)
    identifier = f"ADR-{highest + 1:04d}"
    print(f"id: {identifier}")
    if title:
        path = directory / f"{identifier}-{slugify(title)}.md"
        if path.exists() or path.is_symlink():
            raise DecisionError(f"next ADR path is already occupied: {path}", 4)
        print(f"path: {path}")


def slugify(value: str) -> str:
    if byte_length(value) > 200:
        raise DecisionError("--title must be at most 200 bytes")
    slug = re.sub(
        r"[^a-z0-9]+", "-", value.encode("utf-8").lower().decode("utf-8")
    ).strip("-")
    if not slug:
        raise DecisionError("--title must contain an ASCII letter or digit")
    return slug
