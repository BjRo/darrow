"""UTF-8 snapshots and exclusive candidate publication; no tracker operations."""

import os
import tempfile
from pathlib import Path

from .model import PipelineError


def read(path: str) -> str:
    try:
        return Path(path).read_bytes().decode("utf-8")
    except (OSError, UnicodeError) as exc:
        raise PipelineError(f"not a readable UTF-8 file: {path}", 2) from exc


def output_available(path: str) -> Path:
    target = Path(path).absolute()
    if target.exists() or target.is_symlink():
        raise PipelineError(f"refusing to overwrite output: {path}")
    if not target.parent.is_dir() or not os.access(target.parent, os.W_OK):
        raise PipelineError(f"output directory is not writable: {target.parent}", 2)
    return target


def write(path: str, text: str) -> str:
    target = output_available(path)
    # Publish only complete bytes. Linking in the same directory is atomic and
    # refuses a concurrent destination on POSIX and native Windows.
    descriptor, temporary = tempfile.mkstemp(
        prefix=".ticket-pipeline-", dir=target.parent
    )
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(text.encode("utf-8"))
        os.link(temporary, target)
    except FileExistsError as exc:
        raise PipelineError(f"refusing to overwrite output: {path}") from exc
    finally:
        Path(temporary).unlink()
    return str(target)
