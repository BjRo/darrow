"""Atomic publication of already approved guidance content, without policy choices."""

import argparse
import hashlib
import os
import stat
import sys
import tempfile
from pathlib import Path

from darrow_ia.cli import Parser, run
from darrow_ia.filesystem import inside, resolve_root


def fingerprint(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "missing"


def destination(root: Path, relative: str) -> Path:
    path = root / relative
    resolved = path.resolve()
    if not inside(resolved, root) or resolved == root:
        raise ValueError(
            f"guidance destination must stay inside the repository: {path}"
        )
    if path.is_symlink() and not path.is_file():
        raise ValueError(f"guidance adapter is broken or not a file: {path}")
    return resolved


def replacement_bytes(content: bytes, original: bytes) -> bytes:
    text = content.decode("utf-8-sig").replace("\r\n", "\n")
    newline = "\r\n" if b"\r\n" in original else "\n"
    bom = b"\xef\xbb\xbf" if original.startswith(b"\xef\xbb\xbf") else b""
    return bom + text.replace("\n", newline).encode("utf-8")


def check_unchanged(root: Path, relative: str, target: Path, expected: str) -> None:
    if destination(root, relative) != target or fingerprint(target) != expected:
        raise ValueError(f"guidance changed since approval: {root / relative}")


def replace(root: Path, relative: str, content: bytes, expected: str) -> Path:
    target = destination(root, relative)
    check_unchanged(root, relative, target, expected)
    original = target.read_bytes() if target.exists() else b""
    mode = stat.S_IMODE(target.stat().st_mode) if target.exists() else 0o644
    payload = replacement_bytes(content, original)
    descriptor, temporary = tempfile.mkstemp(prefix=".ia-", dir=target.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        check_unchanged(root, relative, target, expected)
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return target


def arguments_parser() -> argparse.ArgumentParser:
    parser = Parser(
        add_help=False,
        usage="usage: ia-write --expected SHA256|missing --content-file FILE path [repository]",
    )
    parser.add_argument("--expected", required=True)
    parser.add_argument("--content-file", required=True)
    parser.add_argument("path")
    parser.add_argument("repository", nargs="?", default=".")
    return parser


def command(arguments: list[str] | tuple[str, ...]) -> int:
    args = arguments_parser().parse_args(arguments)
    root = resolve_root(args.repository)
    target = replace(
        root, args.path, Path(args.content_file).read_bytes(), args.expected
    )
    print(f"updated: {target}")
    return 0


def entrypoint() -> None:
    sys.exit(run(lambda arguments: command(list(arguments)), sys.argv[1:]))
