#!/usr/bin/env python3
"""Run this plugin's locked backend from a user-writable Darrow cache."""

from __future__ import annotations

import argparse
import hashlib
import json
import ntpath
import os
import posixpath
import re
import subprocess
import sys
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path

KEY_VERSION = 1
PLUGIN_NAME = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")


class LauncherError(Exception):
    """A user-actionable launcher configuration or storage error."""


def is_absolute_path(value: str, platform: str) -> bool:
    if platform != "nt":
        return posixpath.isabs(value)
    drive, tail = ntpath.splitdrive(value)
    return bool(drive) and tail.startswith(("/", "\\"))


def join_path(platform: str, *parts: str) -> str:
    return ntpath.join(*parts) if platform == "nt" else posixpath.join(*parts)


def normalize_path(value: str, platform: str) -> str:
    return ntpath.normpath(value) if platform == "nt" else posixpath.normpath(value)


def windows_cwd_drive(cwd: str) -> str:
    drive = ntpath.splitdrive(cwd)[0]
    if not drive:
        raise LauncherError(f"Windows working directory has no drive or share: {cwd}")
    return drive


def windows_absolute_path(value: str, cwd: str) -> str:
    drive, tail = ntpath.splitdrive(value)
    if is_absolute_path(value, "nt"):
        candidate = value
    elif tail.startswith(("/", "\\")):
        candidate = windows_cwd_drive(cwd) + tail
    elif drive:
        if ntpath.normcase(drive) != ntpath.normcase(windows_cwd_drive(cwd)):
            raise LauncherError(
                "drive-relative Python path must use the caller's current drive"
            )
        candidate = ntpath.join(cwd, tail)
    else:
        candidate = ntpath.join(cwd, value)
    return ntpath.normcase(ntpath.normpath(candidate))


def absolute_path(value: str, platform: str, cwd: str) -> str:
    if platform == "nt":
        return windows_absolute_path(value, cwd)
    candidate = (
        value if is_absolute_path(value, platform) else join_path(platform, cwd, value)
    )
    return normalize_path(candidate, platform)


def default_cache_root(environment: Mapping[str, str], platform: str) -> str:
    if platform == "nt":
        local = environment.get("LOCALAPPDATA")
        if not local:
            raise LauncherError(
                "LOCALAPPDATA is required when DARROW_CACHE_DIR is not set"
            )
        return join_path(platform, local, "Darrow", "Cache")
    home = environment.get("HOME")
    if not home:
        raise LauncherError("HOME is required when DARROW_CACHE_DIR is not set")
    return join_path(platform, home, ".darrow", "cache")


def resolve_cache_root(environment: Mapping[str, str], platform: str) -> str:
    override = environment.get("DARROW_CACHE_DIR")
    root = override or default_cache_root(environment, platform)
    if not is_absolute_path(root, platform):
        if override:
            raise LauncherError("DARROW_CACHE_DIR must be an absolute path")
        raise LauncherError(f"resolved Darrow cache root must be absolute: {root}")
    return normalize_path(root, platform)


def normalize_python_selection(selection: str | None, platform: str, cwd: str) -> str:
    if selection is None:
        return "default"
    value = selection.strip()
    if not value:
        raise LauncherError("explicit Python selection must be non-empty")
    separators = ("/", "\\") if platform == "nt" else ("/",)
    is_path = (
        is_absolute_path(value, platform)
        or value.startswith(".")
        or any(separator in value for separator in separators)
        or (platform == "nt" and bool(ntpath.splitdrive(value)[0]))
    )
    if is_path:
        return f"path:{absolute_path(value, platform, cwd)}"
    return f"request:{value.casefold()}"


def environment_key(
    plugin_name: str,
    plugin_version: str,
    backend: str,
    lock_contents: bytes,
    python_selection: str | None,
    platform: str,
    cwd: str,
) -> str:
    """Hash normalized identity, location, lock bytes, and Python selection."""
    payload = {
        "backend": absolute_path(backend, platform, cwd),
        "format": KEY_VERSION,
        "lock_sha256": hashlib.sha256(lock_contents).hexdigest(),
        "plugin": plugin_name,
        "python": normalize_python_selection(python_selection, platform, cwd),
        "version": plugin_version,
    }
    encoded = json.dumps(
        payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ).encode("ascii")
    return f"v{KEY_VERSION}-{hashlib.sha256(encoded).hexdigest()}"


def read_manifest(path: Path) -> tuple[str, str]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        name = value["name"]
        version = value["version"]
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise LauncherError(
            f"plugin manifest is unreadable or invalid: {path}"
        ) from error
    if not isinstance(name, str) or not PLUGIN_NAME.fullmatch(name):
        raise LauncherError(f"plugin manifest has an unsafe name: {path}")
    if not isinstance(version, str) or not version:
        raise LauncherError(f"plugin manifest has an invalid version: {path}")
    return name, version


def plugin_identity(backend: Path) -> tuple[str, str]:
    for root in (backend, *backend.parents):
        claude = root / ".claude-plugin" / "plugin.json"
        codex = root / ".codex-plugin" / "plugin.json"
        if claude.exists() or codex.exists():
            if not claude.is_file() or not codex.is_file():
                raise LauncherError(
                    f"plugin root must contain both readable manifests: {root}"
                )
            claude_identity = read_manifest(claude)
            codex_identity = read_manifest(codex)
            if claude_identity != codex_identity:
                raise LauncherError(f"plugin manifest identities differ: {root}")
            return claude_identity
    raise LauncherError(f"could not find plugin manifests above backend: {backend}")


def read_required(path: Path) -> bytes:
    try:
        if not path.is_file():
            raise OSError
        return path.read_bytes()
    except OSError as error:
        raise LauncherError(f"required backend file is unreadable: {path}") from error


def prepare_cache_root(cache_root: Path) -> Path:
    try:
        cache_root.mkdir(parents=True, exist_ok=True)
        resolved = cache_root.resolve(strict=True)
        if not resolved.is_dir():
            raise OSError("not a directory")
        if not os.access(resolved, os.R_OK | os.W_OK | os.X_OK):
            raise OSError("directory is not readable, writable, and traversable")
        with tempfile.NamedTemporaryFile(prefix=".darrow-write-", dir=resolved):
            pass
    except OSError as error:
        raise LauncherError(
            f"Darrow cache root is unavailable or not writable: {cache_root}: {error}"
        ) from error
    return resolved


def child_environment(
    environment: Mapping[str, str], project_environment: str
) -> dict[str, str]:
    child = dict(environment)
    child["UV_PROJECT_ENVIRONMENT"] = project_environment
    child["PYTHONDONTWRITEBYTECODE"] = "1"
    return child


def parse_arguments(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a frozen plugin backend without writing below the plugin root"
    )
    parser.add_argument(
        "--python",
        dest="python_selection",
        help="explicit uv Python request or interpreter path",
    )
    parser.add_argument(
        "--isolated",
        action="store_true",
        help="ignore uv configuration files for this invocation",
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    arguments = parser.parse_args(argv)
    if arguments.command[:1] == ["--"]:
        arguments.command = arguments.command[1:]
    if not arguments.command:
        parser.error("a backend command is required")
    return arguments


def run(argv: Sequence[str], environment: Mapping[str, str]) -> int:
    arguments = parse_arguments(argv)
    backend = Path(__file__).resolve().parents[1]
    pyproject = backend / "pyproject.toml"
    lock = backend / "uv.lock"
    read_required(pyproject)
    lock_contents = read_required(lock)
    plugin_name, plugin_version = plugin_identity(backend)
    platform = "nt" if os.name == "nt" else "posix"
    cache_root = prepare_cache_root(Path(resolve_cache_root(environment, platform)))
    explicit_python = (
        arguments.python_selection
        if arguments.python_selection is not None
        else environment.get("UV_PYTHON")
    )
    key = environment_key(
        plugin_name,
        plugin_version,
        str(backend),
        lock_contents,
        explicit_python,
        platform,
        os.getcwd(),
    )
    parent = cache_root / "uv-environments" / plugin_name
    try:
        parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise LauncherError(
            f"cannot create Darrow environment directory: {parent}"
        ) from error
    project_environment = parent / key
    command = [
        "uv",
        "run",
        "--quiet",
    ]
    if arguments.isolated:
        command.append("--isolated")
    command.extend(("--frozen", "--no-dev", "--project", str(backend)))
    if arguments.python_selection is not None:
        command.extend(("--python", arguments.python_selection))
    command.extend(arguments.command)
    try:
        result = subprocess.run(
            command,
            env=child_environment(environment, str(project_environment)),
            check=False,
        )
    except OSError as error:
        raise LauncherError(f"could not execute uv: {error}") from error
    return result.returncode if result.returncode >= 0 else 128 - result.returncode


def main() -> int:
    try:
        return run(sys.argv[1:], os.environ)
    except LauncherError as error:
        print(f"error: Darrow runtime launcher: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
