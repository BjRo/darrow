"""User-level storage for short-lived ticket body files."""

import ntpath
import os
import posixpath
import stat
import tempfile
from collections.abc import Mapping
from pathlib import Path

from .errors import TicketError


def root_path(environment: Mapping[str, str], platform: str) -> str:
    path_module = ntpath if platform == "nt" else posixpath
    if "DARROW_TMP_DIR" in environment:
        value = environment["DARROW_TMP_DIR"]
    elif platform == "nt":
        base = environment.get("LOCALAPPDATA", "")
        value = ntpath.join(base, "Darrow", "Tmp") if base else ""
    else:
        base = environment.get("HOME", "")
        value = posixpath.join(base, ".darrow", "tmp") if base else ""
    if not value or not path_module.isabs(value):
        raise TicketError(
            "error: Darrow temp directory must be a non-empty absolute path"
        )
    return str(path_module.normpath(value))


def temporary_root() -> Path:
    root = Path(root_path(os.environ, os.name))
    if root.is_symlink():
        raise TicketError(f"error: Darrow temp directory is a symlink: {root}")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.is_symlink():
        raise TicketError(f"error: Darrow temp directory is a symlink: {root}")
    if not root.is_dir():
        raise TicketError(f"error: Darrow temp path is not a directory: {root}")
    if os.name != "nt" and (
        root.stat().st_uid != os.getuid() or stat.S_IMODE(root.stat().st_mode) & 0o077
    ):
        raise TicketError(f"error: Darrow temp directory must be private: {root}")
    return root


def allocate_temp_file() -> Path:
    descriptor, name = tempfile.mkstemp(
        prefix="darrow-ticket-draft-", suffix=".md", dir=temporary_root()
    )
    os.close(descriptor)
    return Path(name)
