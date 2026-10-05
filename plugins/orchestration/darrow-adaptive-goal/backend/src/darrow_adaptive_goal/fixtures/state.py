"""Passive eval evidence and byte-compatible candidate fingerprints."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..common import git, git_text


def metadata(repo: Path) -> Path:
    return Path(git_text(repo, "rev-parse", "--absolute-git-dir")).resolve()


def append(path: Path, text: str) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(text)


def lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines() if path.exists() else []


def oid(repo: Path, data: bytes) -> str:
    return git(repo, "hash-object", "--stdin", data=data).decode().strip()


@dataclass(frozen=True)
class Candidate:
    target: str
    packet: bytes
    changed: tuple[str, ...]


def capture(repo: Path) -> Candidate:
    packet = git(repo, "diff", "--binary", "--full-index", "HEAD", "--")
    changed = git(repo, "diff", "--name-only", "-z", "HEAD", "--")
    untracked = git(repo, "ls-files", "--others", "--exclude-standard", "-z")
    for name in untracked.split(b"\0")[:-1]:
        path = name.decode("utf-8")
        object_id = git(repo, "hash-object", "--", path).strip()
        packet += b"untracked_path\0" + name + b"\0untracked_oid\0" + object_id + b"\0"
        packet += (repo / path).read_bytes() + b"\0"
        changed += name + b"\0"
    base = git_text(repo, "rev-parse", "HEAD")
    return Candidate(
        f"WORKTREE@{base}+{oid(repo, packet)}",
        packet,
        tuple(name.decode("utf-8") for name in changed.split(b"\0")[:-1]),
    )


def checksum(data: bytes) -> str:
    """POSIX cksum, including its length suffix, without a Unix executable."""
    crc = 0
    for byte in data + length_bytes(len(data)):
        crc ^= byte << 24
        for _ in range(8):
            crc = (crc << 1) ^ (0x04C11DB7 if crc & 0x80000000 else 0)
            crc &= 0xFFFFFFFF
    return f"{crc ^ 0xFFFFFFFF} {len(data)}"


def length_bytes(length: int) -> bytes:
    return length.to_bytes((length.bit_length() + 7) // 8, "little")
