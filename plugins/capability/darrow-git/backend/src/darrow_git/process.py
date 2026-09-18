"""Literal provider execution and stable refusal boundaries."""

import os
import subprocess
from collections.abc import Sequence
from pathlib import Path


class RefusalError(Exception):
    def __init__(self, message: str, code: int = 4) -> None:
        super().__init__(message)
        self.code = code


def require(condition: object, message: str, code: int = 4) -> None:
    if not condition:
        raise RefusalError(f"error: {message}", code)


def invoke(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    input_bytes: bytes | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[bytes]:
    """Capture provider streams without allowing shell expansion or pipe deadlocks."""
    try:
        return subprocess.run(
            args,
            input=input_bytes,
            capture_output=True,
            cwd=cwd,
            env=env,
            check=False,
        )
    except OSError as error:
        raise RefusalError(f"error: cannot execute {args[0]}: {error}") from error


def decode(value: bytes) -> str:
    return value.decode("utf-8", errors="surrogateescape").rstrip("\n")


def command(*args: str, cwd: Path | None = None, code: int = 4) -> str:
    result = invoke(args, cwd=cwd)
    if result.returncode:
        raise RefusalError(decode(result.stdout + result.stderr), code)
    return decode(result.stdout)


def checked_command(message: str, *args: str) -> str:
    try:
        return command(*args)
    except RefusalError as error:
        raise RefusalError(message) from error


def git(*args: str, cwd: Path | None = None) -> str:
    return command("git", *args, cwd=cwd)


def probe(*args: str, cwd: Path | None = None) -> str:
    result = invoke(["git", *args], cwd=cwd)
    return decode(result.stdout) if result.returncode == 0 else ""


def succeeds(*args: str, cwd: Path | None = None) -> bool:
    return invoke(["git", *args], cwd=cwd).returncode == 0


def readable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.R_OK)


def emit(text: str, limit: int | None = None) -> None:
    if text:
        print("\n".join(text.splitlines()[:limit]))
