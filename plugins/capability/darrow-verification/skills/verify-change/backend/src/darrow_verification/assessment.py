"""Validate and render one retained verification assessment handoff."""

from __future__ import annotations

import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from io import TextIOWrapper
from pathlib import Path
from typing import Protocol, cast

USAGE = (
    "usage: render-assessment --assessment ABSOLUTE_FILE "
    "--provider-report ABSOLUTE_FILE"
)
ERROR_PREFIX = "render-assessment"


class BinaryWriter(Protocol):
    """Minimal byte stream used by the renderer boundary."""

    def write(self, data: bytes, /) -> object:
        """Write bytes to the stream."""


class UsageError(Exception):
    """Signal malformed command syntax."""


class InputError(Exception):
    """Signal an invalid assessment or provider-report input."""


@dataclass(frozen=True)
class AssessmentInputs:
    """Canonical files used to render one assessment handoff."""

    assessment: Path
    provider_report: Path


def parse(arguments: Sequence[str]) -> tuple[str, str]:
    """Parse the renderer's stable ordered flag contract."""
    if (
        len(arguments) != 4
        or arguments[0] != "--assessment"
        or arguments[2] != "--provider-report"
    ):
        raise UsageError
    return arguments[1], arguments[3]


def _contains_control_character(value: str) -> bool:
    return any(ord(character) < 32 or ord(character) == 127 for character in value)


def _is_readable_nonempty_file(path: Path) -> bool:
    try:
        if not path.is_file():
            return False
        with path.open("rb") as stream:
            return bool(stream.read(1))
    except OSError:
        return False


def canonical_input(value: str, label: str) -> Path:
    """Validate one path and resolve its parent without resolving its filename."""
    path = Path(value)
    if not path.is_absolute():
        raise InputError(f"{label} requires an absolute path")
    if _contains_control_character(value):
        raise InputError(f"{label} path contains a control character")
    if not _is_readable_nonempty_file(path):
        raise InputError(f"{label} is not a readable nonempty regular file: {value}")
    try:
        parent = path.parent.resolve(strict=True)
    except OSError as error:
        raise InputError(f"cannot resolve {label} parent: {value}") from error
    return parent / path.name


def escape_destination(value: str) -> str:
    """Escape the Markdown URI delimiters escaped by the original renderer."""
    destination = value.replace("%", "%25")
    destination = destination.replace(" ", "%20")
    destination = destination.replace("#", "%23")
    destination = destination.replace("?", "%3F")
    destination = destination.replace("<", "%3C").replace(">", "%3E")
    return destination.replace("\\", "%5C")


def validate(arguments: Sequence[str]) -> AssessmentInputs:
    """Parse and validate both inputs in their public error order."""
    assessment, provider_report = parse(arguments)
    return AssessmentInputs(
        assessment=canonical_input(assessment, "assessment"),
        provider_report=canonical_input(provider_report, "provider-report"),
    )


def render(inputs: AssessmentInputs) -> bytes:
    """Preserve the assessment bytes and append the canonical report link."""
    destination = escape_destination(os.fspath(inputs.provider_report))
    try:
        assessment = inputs.assessment.read_bytes()
    except OSError as error:
        raise InputError(
            f"assessment is not a readable nonempty regular file: {inputs.assessment}"
        ) from error
    return assessment + (
        b"\n\nComplete provider result: [report](<" + os.fsencode(destination) + b">)\n"
    )


def _write_error(stream: BinaryWriter, message: str) -> None:
    stream.write(os.fsencode(f"{ERROR_PREFIX}: {message}\n"))


def main(
    arguments: Sequence[str], *, stdout: BinaryWriter, stderr: BinaryWriter
) -> int:
    """Run the renderer and return its public process status."""
    try:
        inputs = validate(arguments)
    except UsageError:
        _write_error(stderr, USAGE)
        return 2
    except InputError as error:
        _write_error(stderr, str(error))
        return 2
    try:
        output = render(inputs)
    except InputError as error:
        _write_error(stderr, str(error))
        return 2
    stdout.write(output)
    return 0


def entrypoint() -> None:
    """Run the installed console entrypoint with byte-stable streams."""
    stdout = cast(TextIOWrapper, sys.stdout).buffer
    stderr = cast(TextIOWrapper, sys.stderr).buffer
    raise SystemExit(main(tuple(sys.argv[1:]), stdout=stdout, stderr=stderr))
