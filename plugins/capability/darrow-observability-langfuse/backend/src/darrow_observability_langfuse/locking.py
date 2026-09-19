"""Cross-process file locks for capture sidecars and delivery drainers."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from filelock import FileLock, Timeout


@contextmanager
def exclusive_lock(path: Path, *, blocking: bool = True) -> Iterator[bool]:
    lock = FileLock(path, timeout=-1 if blocking else 0)
    try:
        lock.acquire()
    except Timeout:
        yield False
        return
    try:
        yield True
    finally:
        lock.release()
