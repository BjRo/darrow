from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO

PROGRAM = "verify-shell-tests"
USAGE = "usage: verify-shell-tests [--shell <executable>]... -- <test-script>...\n"
DEFAULT_CANDIDATES = (
    "/bin/bash",
    "bash",
    "bash5",
    "/opt/homebrew/bin/bash",
    "/usr/local/bin/bash",
)
VERSION_COMMAND = (
    "printf '%s\\t%s\\t%s\\n' "
    '"${BASH_VERSINFO[0]}" "${BASH_VERSINFO[1]}" "$BASH_VERSION"'
)


@dataclass(frozen=True)
class BashInterpreter:
    label: str
    path: Path
    version: str


def _consume_shell_options(
    arguments: list[str], candidates: list[str], position: int
) -> tuple[list[str], int]:
    if position >= len(arguments):
        return candidates, position
    argument = arguments[position]
    if argument == "--shell":
        return _consume_shell_argument(arguments, candidates, position)
    if argument == "--":
        return candidates, position + 1
    if argument.startswith("-"):
        raise ValueError
    return candidates, position


def _consume_shell_argument(
    arguments: list[str], candidates: list[str], position: int
) -> tuple[list[str], int]:
    if position + 1 >= len(arguments):
        raise ValueError
    candidates.append(arguments[position + 1])
    return _consume_shell_options(arguments, candidates, position + 2)


def _parse_arguments(arguments: list[str]) -> tuple[list[str], list[str], bool]:
    candidates, position = _consume_shell_options(arguments, [], 0)
    tests = arguments[position:]
    if not tests:
        raise ValueError
    return candidates or list(DEFAULT_CANDIDATES), tests, bool(candidates)


def _canonical_file(value: str) -> Path:
    path = Path(value)
    parent = path.parent if path.parent != Path("") else Path.cwd()
    return parent.resolve(strict=True) / path.name


def _resolve_interpreter(requested: str) -> Path | None:
    has_separator = any(separator in requested for separator in ("/", "\\"))
    located = requested if has_separator else shutil.which(requested)
    if located is None:
        return None
    path = Path(located)
    if not path.is_file() or not os.access(path, os.X_OK):
        return None
    try:
        return _canonical_file(str(path))
    except OSError:
        return None


def _version(interpreter: Path) -> tuple[int, int, str] | None:
    try:
        completed = subprocess.run(
            [str(interpreter), "-c", VERSION_COMMAND],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if completed.returncode != 0 or not completed.stdout:
        return None
    fields = completed.stdout.splitlines()[0].split("\t")
    if len(fields) != 3:
        return None
    try:
        return int(fields[0]), int(fields[1]), fields[2]
    except ValueError:
        return None


def _classify_version(
    path: Path, version: tuple[int, int, str], explicit: bool
) -> BashInterpreter | None:
    major, minor, display = version
    if (major, minor) == (3, 2):
        return BashInterpreter("bash-3.2", path, display)
    if major == 5:
        return BashInterpreter("bash-5", path, display)
    if explicit:
        raise ValueError(f"unsupported Bash version {display}: {path}")
    return None


def _inspect_candidate(requested: str, explicit: bool) -> BashInterpreter | None:
    path = _resolve_interpreter(requested)
    if path is None:
        if explicit:
            raise ValueError(f"shell is not executable: {requested}")
        return None
    version = _version(path)
    if version is None:
        if explicit:
            raise ValueError(f"cannot read Bash version: {path}")
        return None
    return _classify_version(path, version, explicit)


def discover_interpreters(
    candidates: list[str], *, explicit: bool
) -> list[BashInterpreter]:
    found: dict[str, BashInterpreter] = {}
    for candidate in candidates:
        interpreter = _inspect_candidate(candidate, explicit)
        if interpreter is not None and interpreter.label not in found:
            found[interpreter.label] = interpreter
    return [found[label] for label in ("bash-3.2", "bash-5") if label in found]


def _test_files(inputs: list[str]) -> list[Path]:
    tests: list[Path] = []
    for value in inputs:
        path = Path(value)
        if not path.is_file() or not os.access(path, os.R_OK):
            raise ValueError(f"test script is not a readable regular file: {value}")
        try:
            tests.append(_canonical_file(value))
        except OSError as error:
            raise ValueError(f"cannot resolve test script: {value}") from error
    return tests


def run_test(interpreter: BashInterpreter, test: Path) -> int:
    try:
        returncode = subprocess.run(
            [str(interpreter.path), str(test)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
    except OSError:
        return 127
    return returncode if returncode >= 0 else 128 - returncode


def _report_interpreter(
    interpreter: BashInterpreter, tests: list[Path], stdout: TextIO
) -> int:
    stdout.write(
        f"interpreter\t{interpreter.label}\tavailable\t"
        f"{interpreter.path}\t{interpreter.version}\n"
    )
    failures = 0
    for test in tests:
        status = run_test(interpreter, test)
        if status == 0:
            stdout.write(f"test_result\t{interpreter.label}\t{test}\tpassed\n")
        else:
            stdout.write(
                f"test_result\t{interpreter.label}\t{test}\tfailed\texit={status}\n"
            )
            failures += 1
    return failures


def _report_matrix(
    interpreters: list[BashInterpreter], tests: list[Path], stdout: TextIO
) -> int:
    stdout.write("format\tdarrow-shell-test-matrix-v1\n")
    for test in tests:
        stdout.write(f"test_script\t{test}\n")
    by_label = {interpreter.label: interpreter for interpreter in interpreters}
    results = [
        _report_target(label, by_label, tests, stdout)
        for label in ("bash-3.2", "bash-5")
    ]
    failures = sum(result[0] for result in results)
    missing = sum(result[1] for result in results)
    if failures:
        stdout.write("matrix_status\tfailed\n")
        return 1
    if missing:
        stdout.write("matrix_status\tunverified\n")
        return 3
    stdout.write("matrix_status\tcomplete\n")
    return 0


def _report_target(
    label: str,
    by_label: dict[str, BashInterpreter],
    tests: list[Path],
    stdout: TextIO,
) -> tuple[int, int]:
    interpreter = by_label.get(label)
    if interpreter is None:
        stdout.write(f"interpreter\t{label}\tunavailable\n")
        return 0, 1
    return _report_interpreter(interpreter, tests, stdout), 0


def run(arguments: list[str], *, stdout: TextIO, stderr: TextIO) -> int:
    try:
        candidates, test_inputs, explicit = _parse_arguments(arguments)
    except ValueError:
        stderr.write(USAGE)
        return 2
    try:
        tests = _test_files(test_inputs)
        interpreters = discover_interpreters(candidates, explicit=explicit)
    except ValueError as error:
        stderr.write(f"{PROGRAM}: {error}\n")
        return 2
    return _report_matrix(interpreters, tests, stdout)


def entrypoint() -> None:
    raise SystemExit(run(sys.argv[1:], stdout=sys.stdout, stderr=sys.stderr))


if __name__ == "__main__":
    entrypoint()
