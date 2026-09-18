"""Native file snapshots and path-independent attachment identities."""

import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from . import media
from .evidence_options import AttachmentInput, EvidenceOptions
from .process import RefusalError, decode, git, invoke, readable, require


@dataclass(frozen=True)
class Attachment:
    original: Path
    snapshot: Path
    kind: str
    text: str
    content: str
    identity: str


@dataclass(frozen=True)
class Snapshot:
    directory: Path
    body: bytes
    attachments: list[Attachment]


def hash_bytes(value: bytes) -> str:
    result = invoke(["git", "hash-object", "--stdin"], input_bytes=value)
    require(result.returncode == 0, "cannot hash evidence content")
    return decode(result.stdout)


def canonical_file(path: Path) -> Path:
    # Resolve the parent while preserving the supplied filename.
    return path.parent.resolve(strict=True) / path.name


def checked_file(path: Path, description: str) -> Path:
    try:
        canonical = canonical_file(path)
        require(readable(canonical) and canonical.stat().st_size, description)
        return canonical
    except OSError as error:
        raise RefusalError(f"error: {description}") from error


def checked_media(item: AttachmentInput, top: Path) -> tuple[Path, str, int]:
    path = checked_file(
        item.path,
        f"attachment must be a readable non-empty regular file: {item.path.absolute()}",
    )
    require(
        not path.is_relative_to(top),
        f"evidence attachment must remain outside the repository: {path}",
    )
    extension = path.suffix[1:].lower()
    require(
        extension in {*media.SIGNATURES, "svg"}, f"unsupported attachment type: {path}"
    )
    kind = "video" if extension in {"mp4", "mov", "webm"} else "image"
    require(item.kind == kind, f"attachment kind does not match file type: {path}")
    size = path.stat().st_size
    require(
        size <= (104857600 if kind == "video" else 10485760),
        f"attachment exceeds supported size: {path}",
    )
    require(
        media.matches(path, extension, size),
        f"attachment content does not match its supported type: {path}",
    )
    return path, extension, size


def snapshot_attachment(
    item: AttachmentInput, top: Path, directory: Path, number: int, seen: set[str]
) -> Attachment:
    path, extension, size = checked_media(item, top)
    content = git("hash-object", str(path))
    require(content not in seen, f"duplicate attachment content: {path}")
    seen.add(content)
    presentation_hash = hash_bytes(item.text.encode("utf-8"))
    identity = f"{number}:{item.kind}:{content}:{size}:{presentation_hash}"
    snapshot = directory / f"darrow-evidence-attachment-{number}.{extension}"
    shutil.copyfile(path, snapshot)
    require(
        git("hash-object", str(snapshot)) == content,
        f"attachment changed while snapshotting: {path}",
    )
    return Attachment(path, snapshot, item.kind, item.text, content, identity)


def snapshot(options: EvidenceOptions, top: Path) -> Snapshot:
    body = checked_file(Path(options.body), "body file must be readable and non-empty")
    original = body.read_bytes()
    require(
        b"darrow-evidence-attachment-" not in original,
        "body file contains reserved attachment reference text",
    )
    require(
        b"github.com/user-attachments/assets/" not in original,
        "body file contains an attachment URL that prevents deterministic reconciliation",
    )
    directory = Path(tempfile.mkdtemp(prefix="darrow-pr-evidence-files.")).resolve()
    require(
        not directory.is_relative_to(top),
        "attachment snapshot location is inside the repository",
    )
    seen: set[str] = set()
    attachments = [
        snapshot_attachment(item, top, directory, index, seen)
        for index, item in enumerate(options.attachments, 1)
    ]
    target = directory / "body"
    shutil.copyfile(body, target)
    require(
        git("hash-object", str(target)) == git("hash-object", str(body)),
        "body file changed while snapshotting",
    )
    return Snapshot(directory, target.read_bytes(), attachments)


def prepared_file(body: bytes, top: Path) -> Path:
    descriptor, name = tempfile.mkstemp(prefix="darrow-pr-evidence.")
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(body)
    path = Path(name).resolve()
    require(
        not path.is_relative_to(top), "temporary body location is inside the repository"
    )
    return path
