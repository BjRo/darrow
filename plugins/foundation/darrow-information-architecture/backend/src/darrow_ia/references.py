"""Compact Markdown reference extraction; deliberately not a runtime parser."""

import re
from dataclasses import dataclass
from pathlib import Path

from darrow_ia.filesystem import absolute_reference, existing, inside


@dataclass(frozen=True)
class Reference:
    value: str
    explicit: bool
    native: bool = False


def prose_lines(text: str) -> list[str]:
    lines: list[str] = []
    fence = ""
    for line in text.lstrip("\ufeff").splitlines():
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            if re.fullmatch(
                r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*", line
            ):
                fence = ""
        elif marker:
            fence = marker[1]
        else:
            lines.append(line)
    return lines


def clean_reference(raw: str) -> str | None:
    value = raw.strip().removeprefix("<").removesuffix(">").split("#", 1)[0]
    if re.match(r"^(https?://|mailto:|codex:|file:)", value):
        return None
    if not value or re.search(r"[\s<>${}*]", value):
        return None
    return value.rstrip("/") if re.search(r"[/\\].*\.|\.md$", value) else None


def line_references(line: str) -> list[Reference]:
    explicit = bool(
        re.search(
            r"\b(read|consult|load|follow)\b|before .*(edit|chang|work)", line.lower()
        )
    )
    explicit = explicit or bool(re.search(r"(?:^|\s)(?:->|→)(?:\s|$)", line))
    ordinary = re.findall(r"\[[^\[\]]*\]\(([^()]*)\)", line)
    ordinary.extend(re.findall(r"`([^`]+)`", line))
    refs = [
        Reference(value, explicit)
        for raw in ordinary
        if (value := clean_reference(raw))
    ]
    bare = re.sub(r"`[^`]*`", "", line)
    refs.extend(
        Reference(value, True, True)
        for value in re.findall(r"(?:^|\s)@([.A-Za-z0-9_/\\-]+\.md)", bare)
    )
    return refs


def references(text: str) -> list[Reference]:
    return [ref for line in prose_lines(text) for ref in line_references(line)]


def owning_skill(source: Path, root: Path) -> Path | None:
    directory = source.parent
    while inside(directory, root):
        if (directory / "SKILL.md").is_file():
            return directory
        if directory == root:
            break
        directory = directory.parent
    return None


@dataclass(frozen=True)
class Resolution:
    target: Path | None
    requested: Path
    nonroot: bool = False
    external_import: bool = False


def resolve(ref: Reference, source: Path, root: Path) -> Resolution:
    if ref.native:
        requested = source.parent / ref.value
        # Native absolute imports outside the repository belong to host memory.
        external = requested.is_file() and not inside(requested.resolve(), root)
        return Resolution(
            existing(requested, root), requested, external_import=external
        )
    skill = owning_skill(source, root)
    if skill is not None and not absolute_reference(ref.value):
        requested = skill / ref.value
        return Resolution(existing(requested, root), requested)
    return resolve_ordinary(ref, source, root)


def resolve_ordinary(ref: Reference, source: Path, root: Path) -> Resolution:
    requested = root / ref.value
    target = existing(requested, root)
    nonroot = absolute_reference(ref.value) and ref.explicit
    if target is None:
        target = existing(source.parent / ref.value, root)
        nonroot = nonroot or (target is not None and ref.explicit)
    return Resolution(target, requested, nonroot)


def guidance_reference(value: str) -> bool:
    return value.startswith(
        (".agent-shared/", ".claude/", ".agents/", ".codex/", ".pi/")
    ) or Path(value).name in {
        "AGENTS.md",
        "AGENTS.override.md",
        "CLAUDE.md",
        "CLAUDE.local.md",
    }
