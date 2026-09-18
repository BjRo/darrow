"""Enumerate and validate canonical ADRs; catalogs never hide invalid inputs."""

import os
from pathlib import Path

from .errors import DecisionError, Diagnostics
from .model import CONTROL, Record
from .parser import parse
from .paths import read_text
from .relations import validate_relations
from .validation import validate_record


def markdown_files(directory: Path) -> list[Path]:
    try:
        return sorted(
            (path for path in directory.iterdir() if path.name.endswith(".md")),
            key=lambda path: os.fsencode(path.name),
        )
    except OSError as error:
        raise DecisionError(
            f"{directory}: cannot enumerate Markdown entries", 4
        ) from error


def file_error(path: Path) -> str:
    if path.is_symlink():
        return "ADR symlinks are not allowed"
    if not path.is_file():
        return "ADR path is occupied by an unsupported file type"
    if not os.access(path, os.R_OK):
        return "Markdown file is not readable"
    return ""


def load_record(path: Path, errors: Diagnostics) -> Record | None:
    problem = file_error(path)
    if problem:
        errors.add(f"{path}: {problem}")
        return None
    try:
        parsed = parse(read_text(path, "cannot parse ADR file"))
    except DecisionError:
        errors.add(f"{path}: cannot parse ADR file")
        return None
    record = parsed.record(path)
    validate_record(parsed, record, errors)
    return record


def inventory(directory: Path | None) -> list[Record]:
    if directory is None:
        return []
    errors = Diagnostics()
    files = markdown_files(directory)
    unsafe = sum(bool(CONTROL.search(str(path))) for path in files)
    if unsafe:
        errors.add(
            f"{directory}: {unsafe} ADR filename(s) contain unsupported control bytes"
        )
    safe = [
        path
        for path in files
        if not CONTROL.search(str(path)) and path.name != "README.md"
    ]
    records = [
        record for path in safe if (record := load_record(path, errors)) is not None
    ]
    records.sort(key=Record.sort_key)
    validate_relations(records, errors)
    errors.require_valid()
    return records
