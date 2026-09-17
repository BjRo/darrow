from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from typing import TextIO

PROGRAM = "inspect-skill"
USAGE = f"""Usage: {PROGRAM} inspect SKILL_DIRECTORY PLUGIN_ROOT

Validate portable skill metadata and inline Markdown-linked resource containment.
Output paths are absolute. The command does not modify the inspected plugin.
"""
LINK_PATTERN = re.compile(r"\]\(([^)]*)\)")
METADATA_PATTERN = re.compile(
    r"^(name|description|disable-model-invocation)[ \t]*:[ \t]*(.*)$"
)
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class InspectionError(ValueError):
    """A user-facing validation failure."""


class MetadataFormatError(ValueError):
    """A malformed portable frontmatter block."""


@dataclass(frozen=True)
class Metadata:
    name: str
    description: str


def _attempted_path(candidate: str) -> Path:
    path = Path(candidate)
    return path if path.is_absolute() else Path.cwd() / path


def _readable_directory(candidate: str, label: str) -> Path:
    attempted = _attempted_path(candidate)
    if not attempted.is_dir() or not os.access(attempted, os.R_OK | os.X_OK):
        raise InspectionError(f"{label} is not a readable directory: {attempted}")
    try:
        return attempted.resolve(strict=True)
    except OSError as error:
        raise InspectionError(f"cannot resolve {label}: {attempted}") from error


def _record_metadata(values: dict[str, str], line: str) -> None:
    match = METADATA_PATTERN.fullmatch(line)
    if match is None:
        raise MetadataFormatError
    key, value = match.groups()
    if key in values:
        raise MetadataFormatError
    if key == "disable-model-invocation" and value not in {"true", "false"}:
        raise MetadataFormatError
    values[key] = value


def _frontmatter_lines(text: str) -> list[str]:
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise MetadataFormatError
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise MetadataFormatError from error
    return lines[1:end]


def _parse_frontmatter(text: str) -> Metadata:
    values: dict[str, str] = {}
    for line in _frontmatter_lines(text):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        _record_metadata(values, line)
    if "name" not in values or "description" not in values:
        raise MetadataFormatError
    return Metadata(values["name"].strip(), values["description"].strip())


def _unquote(value: str, label: str, skill_file: Path) -> str:
    for quote, name in (('"', "double"), ("'", "single")):
        if value.startswith(quote):
            if not value.endswith(quote) or len(value) == 1:
                raise InspectionError(
                    f"skill {label} has an unmatched {name} quote: {skill_file}"
                )
            return value[1:-1]
    return value


def _validate_metadata(metadata: Metadata, skill_directory: Path) -> Metadata:
    skill_file = skill_directory / "SKILL.md"
    name = _unquote(metadata.name, "name", skill_file)
    description = _unquote(metadata.description, "description", skill_file)
    if NAME_PATTERN.fullmatch(name) is None:
        raise InspectionError(
            "skill name must use lower-case letters, digits, and internal hyphens: "
            f"{skill_file}"
        )
    if name != skill_directory.name:
        raise InspectionError(
            f"skill name '{name}' does not match directory "
            f"'{skill_directory.name}': {skill_file}"
        )
    if not description:
        raise InspectionError(f"skill description is empty: {skill_file}")
    return Metadata(name, description)


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def _skill_directory(skill_input: str, plugin_root: Path) -> Path:
    attempted = _attempted_path(skill_input)
    if not attempted.is_dir():
        raise InspectionError(
            f"skill file is not a readable regular file: {attempted / 'SKILL.md'}"
        )
    skill_directory = _readable_directory(skill_input, "skill directory")
    if not _is_within(skill_directory, plugin_root):
        raise InspectionError(f"skill directory escapes plugin root: {skill_directory}")
    return skill_directory


def _read_skill(skill_directory: Path) -> str:
    skill_file = skill_directory / "SKILL.md"
    invalid = not skill_file.is_file() or not os.access(skill_file, os.R_OK)
    if invalid or skill_file.is_symlink():
        detail = (
            "skill file must not be a symbolic link"
            if skill_file.is_symlink()
            else "skill file is not a readable regular file"
        )
        raise InspectionError(f"{detail}: {skill_file}")
    try:
        return skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise InspectionError(
            f"skill file is not a readable regular file: {skill_file}"
        ) from error


def _portable_target(raw_target: str) -> str | None:
    target = raw_target
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    target = target.split("#", 1)[0]
    if not target or target.startswith(("http://", "https://", "mailto:")):
        return None
    windows_target = PureWindowsPath(target)
    if (
        "\\" in target
        or Path(target).is_absolute()
        or windows_target.is_absolute()
        or bool(windows_target.drive)
    ):
        raise InspectionError(
            f"local references must use portable relative paths: {target}"
        )
    return target


def _local_reference(target: str, skill_directory: Path, plugin_root: Path) -> Path:
    relative = Path(target)
    parent_input = skill_directory / relative.parent
    try:
        parent = parent_input.resolve(strict=True)
    except OSError as error:
        raise InspectionError(
            f"local reference parent is not readable: {parent_input}"
        ) from error
    reference = parent / relative.name
    if not _is_within(reference, plugin_root):
        raise InspectionError(f"local reference escapes plugin root: {reference}")
    if not reference.is_file() or not os.access(reference, os.R_OK):
        raise InspectionError(
            f"local reference is not a readable regular file: {reference}"
        )
    if reference.is_symlink():
        raise InspectionError(
            f"local reference must not be a symbolic link: {reference}"
        )
    return reference


def _references(text: str, skill_directory: Path, plugin_root: Path) -> list[Path]:
    references: list[Path] = []
    for match in LINK_PATTERN.finditer(text):
        target = _portable_target(match.group(1))
        if target is not None:
            references.append(_local_reference(target, skill_directory, plugin_root))
    return references


def _walk_error(error: OSError) -> None:
    raise error


def _visible_directories(parent: Path, names: list[str]) -> list[str]:
    return [name for name in names if not (parent / name).is_symlink()]


def _regular_files(parent: Path, names: list[str]) -> list[Path]:
    return [
        path
        for name in names
        if (path := parent / name).is_file() and not path.is_symlink()
    ]


def _walk_scripts(scripts_directory: Path) -> list[Path]:
    scripts: list[Path] = []
    for parent, directories, files in os.walk(
        scripts_directory, followlinks=False, onerror=_walk_error
    ):
        parent_path = Path(parent)
        if not os.access(parent_path, os.R_OK | os.X_OK):
            raise OSError
        directories[:] = _visible_directories(parent_path, directories)
        scripts.extend(_regular_files(parent_path, files))
    return scripts


def _bundled_scripts(skill_directory: Path) -> list[Path]:
    scripts_directory = skill_directory / "scripts"
    if not scripts_directory.exists():
        return []
    if not scripts_directory.is_dir() or not os.access(
        scripts_directory, os.R_OK | os.X_OK
    ):
        raise InspectionError(
            f"scripts path is not a readable directory: {scripts_directory}"
        )
    try:
        scripts = _walk_scripts(scripts_directory)
    except OSError as error:
        raise InspectionError(
            f"cannot enumerate bundled scripts: {scripts_directory}"
        ) from error
    return sorted(scripts, key=lambda path: os.fsencode(path))


def _inspect(skill_input: str, plugin_input: str, stdout: TextIO) -> None:
    plugin_root = _readable_directory(plugin_input, "plugin root")
    skill_directory = _skill_directory(skill_input, plugin_root)
    skill_file = skill_directory / "SKILL.md"
    text = _read_skill(skill_directory)
    try:
        metadata = _parse_frontmatter(text)
    except MetadataFormatError as error:
        raise InspectionError(
            "frontmatter must contain one single-line name and description plus an "
            f"optional boolean disable-model-invocation: {skill_file}"
        ) from error
    metadata = _validate_metadata(metadata, skill_directory)
    stdout.write("format\tdarrow-skill-inspection-v1\n")
    stdout.write(f"plugin_root\t{plugin_root}\n")
    stdout.write(f"skill_directory\t{skill_directory}\n")
    stdout.write(f"skill_file\t{skill_file}\n")
    stdout.write(f"name\t{metadata.name}\n")
    stdout.write(f"description_length\t{len(metadata.description)}\n")
    for reference in _references(text, skill_directory, plugin_root):
        stdout.write(f"local_reference\t{reference}\n")
    for script in _bundled_scripts(skill_directory):
        if not os.access(script, os.R_OK):
            raise InspectionError(f"bundled script is unreadable: {script}")
        stdout.write(f"bundled_script\t{script}\n")
    stdout.write("status\tvalid\n")


def run(arguments: list[str], *, stdout: TextIO, stderr: TextIO) -> int:
    if not arguments or arguments[0] != "inspect":
        stderr.write(USAGE)
        return 2
    if len(arguments) != 3:
        stderr.write(f"{PROGRAM}: inspect requires SKILL_DIRECTORY and PLUGIN_ROOT\n")
        return 2
    try:
        _inspect(arguments[1], arguments[2], stdout)
    except InspectionError as error:
        stderr.write(f"{PROGRAM}: {error}\n")
        return 2
    return 0


def entrypoint() -> None:
    raise SystemExit(run(sys.argv[1:], stdout=sys.stdout, stderr=sys.stderr))


if __name__ == "__main__":
    entrypoint()
