"""Stable v1 evidence identity, prepared Markdown, and comment reconciliation."""

import re
from dataclasses import dataclass, field

from .evidence_files import Snapshot, hash_bytes
from .process import git

ASSET = re.compile(r"https://github\.com/user-attachments/assets/[A-Za-z0-9._?=&%/\-]+")
PLACEHOLDER = re.compile(
    r"darrow-evidence-attachment-[0-9]+\.(png|jpg|jpeg|gif|webp|svg|mp4|mov|webm)"
)


@dataclass(frozen=True)
class Identity:
    value: str
    marker: str
    candidate_marker: str
    prepared: bytes
    normalized: str


@dataclass
class Reconciliation:
    outcome: str = "none"
    url: str = ""
    assets: list[str] = field(default_factory=list)


def escape_tsv(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("\n", "\\n")
    )


def build(repository: str, number: str, expected: str, snapshot: Snapshot) -> Identity:
    manifest = "".join(
        f"\nattachment-{index}={item.identity}"
        for index, item in enumerate(snapshot.attachments, 1)
    )
    body_hash = git("hash-object", str(snapshot.directory / "body"))
    identity_input = f"repository={repository}\npr={number}\nhead={expected}\nbody={body_hash}\nattachment-count={len(snapshot.attachments)}{manifest}"
    value = hash_bytes(identity_input.encode())
    candidate = f"{repository}#{number}@{expected}"
    marker = f"<!-- darrow-pr-evidence:v1 candidate={candidate} identity={value} -->"
    prepared = (
        marker.encode()
        + b"\n\n"
        + snapshot.body
        + presentation(snapshot).encode()
        + f"\n<!-- darrow-pr-evidence-manifest\n{identity_input}\n-->".encode()
    )
    normalized = PLACEHOLDER.sub(
        "__DARROW_ATTACHMENT_URL__",
        escape_tsv(prepared.decode("utf-8", errors="surrogateescape")),
    )
    return Identity(
        value,
        marker,
        f"darrow-pr-evidence:v1 candidate={candidate}",
        prepared,
        normalized,
    )


def presentation(snapshot: Snapshot) -> str:
    if not snapshot.attachments:
        return ""
    lines = ["\n\n### Attached evidence\n"]
    for index, item in enumerate(snapshot.attachments, 1):
        if item.kind == "image":
            lines.append(
                f"- Image {index} alt text: {item.text}\n![{item.text}; content identity {item.content}]({item.snapshot.name})\n"
            )
        else:
            lines.append(
                f"- Video {index} explanation: {item.text}; content identity {item.content}\n![]({item.snapshot.name})\n"
            )
    return "".join(lines)


def classify(data: str, identity: Identity, count: int) -> Reconciliation:
    related = [
        row.split("\t", 2)
        for row in data.splitlines()
        if identity.candidate_marker in row
    ]
    if not related:
        return Reconciliation()
    if len(related) != 1 or len(related[0]) != 3:
        return Reconciliation(
            "ambiguous", related[-1][1] if len(related[-1]) > 1 else ""
        )
    _, url, body = related[0]
    if identity.marker not in body:
        return Reconciliation("ambiguous", url)
    assets = ASSET.findall(body)
    normalized = ASSET.sub("__DARROW_ATTACHMENT_URL__", body)
    complete = (
        normalized == identity.normalized
        and len(assets) == count
        and len(set(assets)) == count
    )
    return Reconciliation(
        "complete" if complete else "partial", url, assets if complete else []
    )
