"""Shared record and process boundaries; no review judgment."""

from __future__ import annotations

import hashlib
import json
import os
import shlex
import signal
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from contextlib import ExitStack, suppress
from pathlib import Path
from typing import cast

from .windows_job import WindowsJob


class ReviewError(Exception):
    def __init__(self, message: str, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def require(condition: object, message: str, code: int = 2) -> None:
    if not condition:
        raise ReviewError(message, code)


def safe_line(value: str, label: str) -> str:
    require(
        "\x00" not in value,
        f"{label} contains a NUL byte and cannot be represented safely",
    )
    return value


def read_text(path: str | Path, label: str = "record") -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise ReviewError(f"{label} is not a readable regular file: {path}") from exc


def rows(text: str) -> list[list[str]]:
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ReviewError(f"invalid JSON record: {exc.msg}") from exc
    require(isinstance(value, list), "JSON record must be an array")
    require(
        all(
            isinstance(row, list)
            and bool(row)
            and all(isinstance(field, str) for field in row)
            for row in value
        ),
        "JSON records must be nonempty arrays of strings",
    )
    return cast(list[list[str]], value)


def serialize(records: Sequence[Sequence[str]]) -> str:
    return json.dumps(records, ensure_ascii=False, indent=2) + "\n"


def unique_records(text: str, label: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for row in rows(text):
        require(row[0] not in result, f"incomplete or duplicate {label} record")
        result[row[0]] = row[1:]
    return result


def new_record(path: str, body: str) -> Path:
    safe_line(path, "record path")
    requested = Path(path)
    require(requested.is_absolute(), f"record path must be absolute: {path}")
    require(not requested.is_symlink(), f"record path already exists: {path}")
    canonical = requested.parent.resolve(strict=True) / requested.name
    descriptor, temporary = tempfile.mkstemp(
        prefix=".darrow-review-record.", dir=canonical.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(body)
        # Install a complete record atomically, refusing a concurrent writer.
        # Hard links work natively on the supported Unix and Windows filesystems.
        os.link(temporary, canonical)
    except FileExistsError as exc:
        raise ReviewError(f"record path already exists: {canonical}") from exc
    finally:
        Path(temporary).unlink()
    return canonical


def record_file(path: str) -> str:
    require(Path(path).is_absolute(), f"record path must be absolute: {path}")
    require(not Path(path).is_symlink(), f"record is unreadable or unsafe: {path}")
    return read_text(path, "record")


def git_environment() -> dict[str, str]:
    selectors = {
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    }
    return {key: value for key, value in os.environ.items() if key not in selectors}


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if sys.platform == "win32":  # Native Windows owns a process tree.
        # WindowsJob owns descendants. Stop the direct child before joining it;
        # the enclosing cleanup closes its job even if the child already exited.
        process.kill()
    else:
        with suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
    process.wait()


def run(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    merge_output: bool = False,
) -> subprocess.CompletedProcess[bytes]:
    job = WindowsJob() if os.name == "nt" else None
    with ExitStack() as cleanup:
        if job:
            cleanup.callback(job.close)
        process = subprocess.Popen(
            list(args),
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT if merge_output else subprocess.PIPE,
            start_new_session=os.name != "nt",
            creationflags=4 if job else 0,
        )
        if job:
            job.attach(process)
        stdout, stderr = communicate(process)
        return subprocess.CompletedProcess(
            args, process.returncode, stdout, stderr or b""
        )


def communicate(process: subprocess.Popen[bytes]) -> tuple[bytes, bytes | None]:
    try:
        return process.communicate()
    except BaseException:
        # Process boundary: cancellation must not leave checks/providers running.
        stop_process(process)
        raise


def git(repo: Path, *args: str, message: str) -> bytes:
    result = run(["git", "-C", str(repo), *args], env=git_environment())
    require(result.returncode == 0, message)
    return result.stdout


def root_directory(path: str) -> Path:
    raw = git(
        Path(path),
        "rev-parse",
        "--show-toplevel",
        message=f"not a Git working tree: {path}",
    )
    return Path(raw.decode("utf-8").rstrip("\r\n")).resolve(strict=True)


def blob_hash(data: bytes, *, sha256: bool = False) -> str:
    digest = hashlib.sha256 if sha256 else hashlib.sha1
    return digest(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def command_line(args: list[str]) -> str:
    if os.name == "nt":
        return "& " + " ".join("'" + arg.replace("'", "''") + "'" for arg in args)
    return shlex.join(args)


def package_root() -> Path:
    return Path(__file__).resolve().parents[2]


def entrypoint(name: str, *args: str) -> list[str]:
    return [
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((package_root() / "scripts/run_locked.py").resolve()),
        name,
        *args,
    ]
