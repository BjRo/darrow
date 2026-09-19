"""Catalog freshness, rendering from raw bytes, and atomic replacement."""

import os
import tempfile
from dataclasses import replace
from pathlib import Path

from .catalog_format import FORMAT, CatalogRow, checksum, render
from .catalog_parse import parse_catalog
from .errors import DecisionError
from .inventory import file_error, inventory, markdown_files
from .model import CONTROL, Record
from .paths import git, read_bytes


def fingerprint(root: Path, path: Path) -> str:
    result = git(root, "hash-object", "--no-filters", str(path))
    value = result.stdout.decode("ascii", errors="replace").strip()
    if (
        result.returncode
        or not value
        or any(char not in "0123456789abcdef" for char in value)
    ):
        raise DecisionError(f"cannot fingerprint ADR file: {path}")
    return value


def make_rows(root: Path, records: list[Record]) -> list[CatalogRow]:
    rows = []
    for record in records:
        row = CatalogRow(record, fingerprint(root, record.path), 0, 0)
        crc, size = checksum(row.signature())
        rows.append(replace(row, crc=crc, size=size))
    return rows


def catalog_problem(path: Path) -> str:
    if not path.exists() and not path.is_symlink():
        return "missing"
    if path.is_symlink() or not path.is_file():
        return "malformed"
    if not os.access(path, os.R_OK):
        return "unreadable"
    return ""


def load(path: Path) -> list[CatalogRow]:
    problem = catalog_problem(path)
    if problem:
        raise DecisionError(f"ADR catalog is {problem}: {path}", 4)
    try:
        return parse_catalog(read_bytes(path, "ADR catalog is unreadable"), path.parent)
    except ValueError as error:
        raise DecisionError(f"ADR catalog is malformed: {path}", 4) from error


def committed(root: Path, path: Path) -> bool:
    relative = path.relative_to(root).as_posix()
    blob = git(root, "cat-file", "blob", f"HEAD:{relative}")
    flag = git(root, "ls-files", "-v", "--", relative)
    return (
        blob.returncode == 0
        and flag.returncode == 0
        and flag.stdout.decode("utf-8", errors="surrogateescape").rstrip("\n")
        == f"H {relative}"
        and blob.stdout == read_bytes(path, "ADR catalog is unreadable")
    )


def fresh(root: Path, directory: Path) -> tuple[list[Record], str]:
    path = directory / "README.md"
    problem = catalog_problem(path)
    if problem:
        return [], problem
    if not committed(root, path):
        return [], "stale"
    try:
        rows = load(path)
    except DecisionError:
        return [], "malformed"
    return check_sources(root, directory, rows)


def check_sources(
    root: Path, directory: Path, rows: list[CatalogRow]
) -> tuple[list[Record], str]:
    files = [path for path in markdown_files(directory) if path.name != "README.md"]
    if any(CONTROL.search(str(path)) or file_error(path) for path in files):
        return [], "stale"
    if set(files) != {row.record.path for row in rows}:
        return [], "stale"
    problem = row_problem(root, rows)
    return sorted((row.record for row in rows), key=Record.sort_key), problem


def row_problem(root: Path, rows: list[CatalogRow]) -> str:
    for row in rows:
        if not row.valid_checksum():
            return "malformed"
        if fingerprint(root, row.record.path) != row.fingerprint:
            return "stale"
    return ""


def verify(root: Path, directory: Path, records: list[Record]) -> None:
    path = directory / "README.md"
    load(path)
    expected = render(make_rows(root, records))
    if expected != read_bytes(path, "ADR catalog is unreadable"):
        raise DecisionError(f"ADR catalog is stale: {path}", 4)


def atomic_write(path: Path, data: bytes) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent, prefix=path.name + ".tmp.", delete=False
        ) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except OSError as error:
        action = (
            f"cannot replace ADR catalog: {path}"
            if temporary
            else f"cannot create an atomic ADR catalog in: {path.parent}"
        )
        raise DecisionError(action) from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def rebuild(root: Path, directory: Path) -> list[Record]:
    path = directory / "README.md"
    problem = catalog_problem(path)
    if problem != "missing":
        require_replaceable(path, problem)
    records = inventory(directory)
    atomic_write(path, render(make_rows(root, records)))
    return records


def require_replaceable(path: Path, problem: str) -> None:
    if problem:
        adjective = "a regular file" if problem == "malformed" else "readable"
        raise DecisionError(f"ADR catalog is not {adjective}: {path}")
    lines = read_bytes(path, "ADR catalog is not readable").split(b"\n")
    markers = (FORMAT.encode(), b"<!-- darrow-adr-catalog-v1 -->")
    if not any(marker in lines for marker in markers):
        raise DecisionError(
            f"refusing to replace a README without the derived ADR catalog marker: {path}",
            4,
        )
