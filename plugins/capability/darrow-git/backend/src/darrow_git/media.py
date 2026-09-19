"""Bounded media signature checks for the supported attachment types."""

import re
from collections.abc import Callable
from pathlib import Path


def png(data: bytes, tail: bytes, size: int) -> bool:
    return (
        size >= 45
        and data.startswith(bytes.fromhex("89504e470d0a1a0a0000000d49484452"))
        and data[16:20] != b"\0" * 4
        and data[20:24] != b"\0" * 4
        and tail.endswith(bytes.fromhex("0000000049454e44ae426082"))
    )


def jpeg(data: bytes, tail: bytes, size: int) -> bool:
    return (
        size >= 12
        and data.startswith(b"\xff\xd8\xff")
        and any(marker in data for marker in (b"\xff\xc0", b"\xff\xc1", b"\xff\xc2"))
        and tail.endswith(b"\xff\xd9")
    )


def gif(data: bytes, tail: bytes, size: int) -> bool:
    return (
        size >= 14
        and data.startswith((b"GIF87a", b"GIF89a"))
        and data[6:10] != b"\0" * 4
        and tail.endswith(b";")
    )


def webp(data: bytes, tail: bytes, size: int) -> bool:
    return (
        size >= 20
        and data.startswith(b"RIFF")
        and data[8:16] in (b"WEBPVP8 ", b"WEBPVP8L", b"WEBPVP8X")
    )


def video(data: bytes, tail: bytes, size: int) -> bool:
    return size >= 20 and data[4:8] == b"ftyp" and (b"moov" in data or b"mdat" in data)


def webm(data: bytes, tail: bytes, size: int) -> bool:
    return (
        size >= 8
        and data.startswith(bytes.fromhex("1a45dfa3"))
        and bytes.fromhex("18538067") in data[:4096]
    )


SIGNATURES: dict[str, Callable[[bytes, bytes, int], bool]] = {
    "png": png,
    "jpg": jpeg,
    "jpeg": jpeg,
    "gif": gif,
    "webp": webp,
    "mp4": video,
    "mov": video,
    "webm": webm,
}


def matches(path: Path, extension: str, size: int) -> bool:
    with path.open("rb") as stream:
        prefix = stream.read(65536)
        stream.seek(max(0, size - 12))
        tail = stream.read(12)
    if extension == "svg":
        return (
            size >= 12
            and bool(re.search(rb"<svg[\s>]", prefix[:4096]))
            and bool(re.search(rb"</svg\s*>", path.read_bytes()))
        )
    check = SIGNATURES.get(extension)
    return check(prefix, tail, size) if check else False
