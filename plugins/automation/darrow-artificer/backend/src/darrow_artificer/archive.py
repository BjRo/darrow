"""Authenticated archives of stopped, dedicated native homes (no credentials)."""

import io
import os
import zipfile
from collections.abc import Iterator
from pathlib import Path, PurePosixPath

from cryptography.fernet import Fernet

from .storage import write_bytes

REGENERABLE = {".venv", "__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache"}


def members(home: Path) -> Iterator[Path]:
    for root, directories, files in os.walk(home, followlinks=False):
        directories[:] = [name for name in directories if name not in REGENERABLE]
        for name in directories + files:
            path = Path(root) / name
            if included(path, home):
                yield path


def included(path: Path, home: Path) -> bool:
    if path.relative_to(home).parts[0] == "auth.json":
        return False
    if path.is_symlink():
        raise ValueError(f"Native state contains symbolic link: {path}")
    return path.is_file()


def save(home: Path, archive: Path, key: bytes) -> None:
    if not home.is_dir():
        raise ValueError(f"Native state is unavailable: {home}")
    data = io.BytesIO()
    with zipfile.ZipFile(
        data, "w", zipfile.ZIP_DEFLATED, strict_timestamps=False
    ) as bundle:
        for path in members(home):
            bundle.write(path, path.relative_to(home).as_posix())
    write_bytes(archive, Fernet(key).encrypt(data.getvalue()))


def safe_member(name: str) -> bool:
    path = PurePosixPath(name)
    return bool(path.parts) and not path.is_absolute() and ".." not in path.parts


def restore(archive: Path, destination: Path, key: bytes) -> None:
    if destination.exists():
        raise FileExistsError(
            f"Native restore destination already exists: {destination}"
        )
    data = Fernet(key).decrypt(archive.read_bytes())
    with zipfile.ZipFile(io.BytesIO(data)) as bundle:
        names = bundle.namelist()
        if not all(safe_member(name) for name in names):
            raise ValueError("Archive contains an unsafe member path")
        if any(PurePosixPath(name).parts[0] == "auth.json" for name in names):
            raise ValueError("Archive contains credentials")
        destination.mkdir(mode=0o700, parents=True)
        for name in names:
            write_bytes(destination / name, bundle.read(name))
