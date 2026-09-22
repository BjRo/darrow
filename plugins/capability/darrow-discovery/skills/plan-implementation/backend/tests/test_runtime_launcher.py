from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import ModuleType
from typing import cast

import pytest
from hypothesis import given
from hypothesis import strategies as st

LAUNCHER = Path(__file__).resolve().parents[1] / "scripts" / "run_locked.py"


def load_launcher() -> ModuleType:
    spec = importlib.util.spec_from_file_location("darrow_runtime_launcher", LAUNCHER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_cache_root_resolution_is_native_and_fail_closed() -> None:
    module = load_launcher()
    resolve = cast(Callable[[Mapping[str, str], str], str], module.resolve_cache_root)
    error = cast(type[Exception], module.LauncherError)

    assert resolve({"DARROW_CACHE_DIR": "/var/cache/darrow-test"}, "posix") == (
        "/var/cache/darrow-test"
    )
    assert resolve({"XDG_CACHE_HOME": "/var/cache/user"}, "posix") == (
        "/var/cache/user/darrow"
    )
    assert resolve({"HOME": "/home/test"}, "posix") == "/home/test/.cache/darrow"
    assert (
        resolve({"LOCALAPPDATA": r"C:\Users\Test\AppData\Local"}, "nt")
        == r"C:\Users\Test\AppData\Local\Darrow\Cache"
    )

    with pytest.raises(error, match="absolute"):
        resolve({"DARROW_CACHE_DIR": "relative/cache", "HOME": "/home/test"}, "posix")
    with pytest.raises(error, match="absolute"):
        resolve({"DARROW_CACHE_DIR": r"\root-relative"}, "nt")
    with pytest.raises(error, match="HOME"):
        resolve({}, "posix")
    with pytest.raises(error, match="LOCALAPPDATA"):
        resolve({}, "nt")


def test_environment_key_isolates_every_contract_input(tmp_path: Path) -> None:
    module = load_launcher()
    key = cast(
        Callable[[str, str, str, bytes, str | None, str, str], str],
        module.environment_key,
    )
    inputs = (
        "darrow-test",
        "1.2.3",
        str(tmp_path / "plugin/backend"),
        b"locked",
        None,
        "posix",
        str(tmp_path),
    )
    baseline = key(*inputs)
    variants = [
        ("darrow-other", *inputs[1:]),
        (inputs[0], "1.2.4", *inputs[2:]),
        (*inputs[:2], str(tmp_path / "plugin/other-backend"), *inputs[3:]),
        (*inputs[:3], b"changed-lock", *inputs[4:]),
        (*inputs[:4], "3.11", *inputs[5:]),
        (*inputs[:4], str(tmp_path / "python"), *inputs[5:]),
    ]

    assert len(baseline) == 67 and baseline.startswith("v1-")
    assert len({baseline, *(key(*variant) for variant in variants)}) == 7
    assert key(*inputs) == baseline


def test_empty_explicit_python_is_refused(tmp_path: Path) -> None:
    module = load_launcher()
    normalize = cast(
        Callable[[str | None, str, str], str], module.normalize_python_selection
    )
    error = cast(type[Exception], module.LauncherError)

    with pytest.raises(error, match="must be non-empty"):
        normalize("  ", "posix", str(tmp_path))


def test_windows_python_paths_are_fully_qualified_before_hashing() -> None:
    module = load_launcher()
    normalize = cast(
        Callable[[str | None, str, str], str], module.normalize_python_selection
    )
    error = cast(type[Exception], module.LauncherError)

    assert normalize(r"\python.exe", "nt", r"C:\work") == r"path:c:\python.exe"
    assert normalize(r"\python.exe", "nt", r"D:\work") == r"path:d:\python.exe"
    assert normalize(r"C:python.exe", "nt", r"C:\work") == (r"path:c:\work\python.exe")
    assert normalize(r"\\server\share\python.exe", "nt", r"C:\work") == (
        r"path:\\server\share\python.exe"
    )
    with pytest.raises(error, match="current drive"):
        normalize(r"D:python.exe", "nt", r"C:\work")


@given(lock_contents=st.binary(min_size=1), suffix=st.binary(min_size=1))
def test_environment_key_changes_with_lock_bytes(
    lock_contents: bytes, suffix: bytes
) -> None:
    module = load_launcher()
    key = cast(
        Callable[[str, str, str, bytes, str | None, str, str], str],
        module.environment_key,
    )
    common = (
        "darrow-test",
        "1.0.0",
        "/plugin/backend",
    )

    assert key(*common, lock_contents, None, "posix", "/work") != key(
        *common, lock_contents + suffix, None, "posix", "/work"
    )


def test_child_environment_overrides_only_project_state(tmp_path: Path) -> None:
    module = load_launcher()
    child_environment = cast(
        Callable[[Mapping[str, str], str], dict[str, str]], module.child_environment
    )
    environment = child_environment(
        {
            "UV_PROJECT_ENVIRONMENT": "/ambient/shared",
            "UV_CACHE_DIR": "/caller/uv-cache",
            "KEEP_ME": "yes",
        },
        str(tmp_path / "environment"),
    )

    assert environment["UV_PROJECT_ENVIRONMENT"] == str(tmp_path / "environment")
    assert environment["UV_CACHE_DIR"] == "/caller/uv-cache"
    assert environment["PYTHONDONTWRITEBYTECODE"] == "1"
    assert environment["KEEP_ME"] == "yes"


def write_runtime_project(plugin: Path, name: str) -> Path:
    backend = plugin / name
    scripts = backend / "scripts"
    scripts.mkdir(parents=True)
    shutil.copy2(LAUNCHER, scripts / LAUNCHER.name)
    (backend / "pyproject.toml").write_text(
        f'[project]\nname = "{name}"\nversion = "0.0.0"\nrequires-python = ">=3.10"\n',
        encoding="utf-8",
    )
    subprocess.run(
        ["uv", "lock", "--quiet", "--project", str(backend)],
        check=True,
        capture_output=True,
    )
    return backend


def immutable_snapshot(root: Path) -> dict[str, str]:
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in root.rglob("*")
        if path.is_file()
    }


def make_read_only(root: Path) -> None:
    for path in sorted(root.rglob("*"), reverse=True):
        path.chmod(0o555 if path.is_dir() else 0o444)
    root.chmod(0o555)


def make_writable(root: Path) -> None:
    root.chmod(0o755)
    for path in root.rglob("*"):
        path.chmod(0o755 if path.is_dir() else 0o644)


def run_locked(
    backend: Path, cache: Path, uv_cache: Path
) -> subprocess.CompletedProcess[str]:
    environment = {
        **os.environ,
        "DARROW_CACHE_DIR": str(cache),
        "UV_CACHE_DIR": str(uv_cache),
        "UV_PROJECT_ENVIRONMENT": str(cache / "ambient-must-be-ignored"),
    }
    return subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(backend / "scripts/run_locked.py"),
            "python",
            "-c",
            "print('runtime-ok')",
        ],
        cwd=cache.parent,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_read_only_concurrent_first_use_isolated_by_backend(tmp_path: Path) -> None:
    plugin = tmp_path / "immutable-plugin"
    for manifest_dir in (".claude-plugin", ".codex-plugin"):
        directory = plugin / manifest_dir
        directory.mkdir(parents=True)
        (directory / "plugin.json").write_text(
            json.dumps({"name": "darrow-runtime-test", "version": "1.2.3"}),
            encoding="utf-8",
        )
    first = write_runtime_project(plugin, "backend-one")
    second = write_runtime_project(plugin, "backend-two")
    before = immutable_snapshot(plugin)
    cache = tmp_path / "darrow-cache"
    uv_cache = tmp_path / "uv-cache"
    make_read_only(plugin)
    try:
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(
                executor.map(lambda _: run_locked(first, cache, uv_cache), range(4))
            )
        other = run_locked(second, cache, uv_cache)
    finally:
        make_writable(plugin)

    for result in [*results, other]:
        assert result.returncode == 0, result.stderr
        assert result.stdout == "runtime-ok\n"
    environments = cache / "uv-environments/darrow-runtime-test"
    assert len([path for path in environments.iterdir() if path.is_dir()]) == 2
    assert immutable_snapshot(plugin) == before
    assert not list(plugin.rglob(".venv"))
    assert not list(plugin.rglob("__pycache__"))


def test_invalid_cache_path_refuses_without_fallback(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    for manifest_dir in (".claude-plugin", ".codex-plugin"):
        directory = plugin / manifest_dir
        directory.mkdir(parents=True)
        (directory / "plugin.json").write_text(
            json.dumps({"name": "darrow-runtime-test", "version": "1.0.0"}),
            encoding="utf-8",
        )
    backend = write_runtime_project(plugin, "backend")
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str(backend / "scripts/run_locked.py"),
            "python",
            "-V",
        ],
        cwd=tmp_path,
        env={**os.environ, "DARROW_CACHE_DIR": "relative-cache"},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert "DARROW_CACHE_DIR must be an absolute path" in result.stderr
    assert not (tmp_path / "relative-cache").exists()
    assert not (backend / ".venv").exists()


def test_unavailable_cache_path_refuses_without_fallback(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    for manifest_dir in (".claude-plugin", ".codex-plugin"):
        directory = plugin / manifest_dir
        directory.mkdir(parents=True)
        (directory / "plugin.json").write_text(
            json.dumps({"name": "darrow-runtime-test", "version": "1.0.0"}),
            encoding="utf-8",
        )
    backend = write_runtime_project(plugin, "backend")
    cache_file = tmp_path / "not-a-directory"
    cache_file.write_text("occupied", encoding="utf-8")
    result = run_locked(backend, cache_file, tmp_path / "uv-cache")

    assert result.returncode == 2
    assert "cache root is unavailable or not writable" in result.stderr
    assert cache_file.read_text(encoding="utf-8") == "occupied"
    assert not (backend / ".venv").exists()
