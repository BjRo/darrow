"""Private per-user review state and dependency-aware retention."""

from __future__ import annotations

import errno
import hashlib
import importlib
import ntpath
import os
import posixpath
import shutil
import tempfile
import time
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from pathlib import Path

from .common import ReviewError, require, rows, safe_line

RETENTION_DAYS = 30
RUN_PREFIX = "darrow-review."
WINDOWS_LOCK_WAIT_SECONDS = 120


def windows_absolute(path: str) -> bool:
    drive, tail = ntpath.splitdrive(path)
    return bool(drive) and (
        tail.startswith(("/", "\\")) or (not tail and drive.startswith(("\\\\", "//")))
    )


def resolve_root(environment: Mapping[str, str], platform: str) -> str:
    override = environment.get("DARROW_REVIEW_STATE_DIR")
    if override:
        if platform == "nt":
            require(
                windows_absolute(override), "DARROW_REVIEW_STATE_DIR must be absolute"
            )
            return ntpath.normpath(override)
        require(posixpath.isabs(override), "DARROW_REVIEW_STATE_DIR must be absolute")
        return posixpath.normpath(override)
    return default_root(environment, platform)


def default_root(environment: Mapping[str, str], platform: str) -> str:
    if platform == "nt":
        local = environment.get("LOCALAPPDATA")
        if not local:
            raise ReviewError("LOCALAPPDATA is required for review state")
        require(windows_absolute(local), "LOCALAPPDATA must be absolute")
        return ntpath.join(local, "Darrow", "Reviews")
    home = environment.get("HOME")
    if not home:
        raise ReviewError("HOME is required for review state")
    require(posixpath.isabs(home), "HOME must be absolute")
    return posixpath.join(home, ".darrow", "reviews")


def state_root(repo: Path | None = None, *, create: bool = True) -> Path:
    requested = Path(resolve_root(os.environ, os.name))
    require(not requested.is_symlink(), "review-state root must not be a symlink")
    root = requested.resolve()
    if repo is not None:
        require(
            not root.is_relative_to(repo.resolve()),
            "review-state root must be outside the repository",
        )
    if create:
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(root.is_dir(), f"review-state root is unreadable: {root}")
    if os.name != "nt":
        require(
            root.stat().st_mode & 0o077 == 0,
            f"review-state root must be accessible only to the current user: {root}",
        )
    return root


def repository_state(repo: Path, *, create: bool = True) -> Path:
    root = state_root(repo, create=create)
    bucket = root / repository_digest(repo)
    require(
        not bucket.is_symlink(), "review-state repository path must not be a symlink"
    )
    if create:
        bucket.mkdir(mode=0o700, exist_ok=True)
    require(bucket.is_dir(), f"review-state repository path is unreadable: {bucket}")
    if os.name != "nt":
        require(
            bucket.stat().st_mode & 0o077 == 0,
            f"review-state repository path must be user-only: {bucket}",
        )
    return bucket


def repository_digest(repo: Path) -> str:
    return hashlib.sha256(str(repo.resolve()).encode("utf-8")).hexdigest()


def allocate(repo: Path) -> Path:
    bucket = repository_state(repo)
    return Path(tempfile.mkdtemp(prefix=RUN_PREFIX, dir=bucket))


def allocate_terminal(repo: Path) -> Path:
    safe_line(str(repo), "repository path")
    run = allocate(repo)
    try:
        manifest = run / "scope.tsv"
        body = f"format\tdarrow-review-terminal-v1\nrepository\t{repo}\n"
        descriptor = os.open(manifest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(body)
    except BaseException:
        shutil.rmtree(run)
        raise
    prune_all(repo)
    return run


def run_for_manifest(manifest: Path) -> Path:
    require(manifest.is_absolute(), "review manifest path must be absolute")
    require(manifest.name == "scope.tsv", "review manifest must name scope.tsv")
    fields = fields_at(manifest)
    require(
        fields.get("format") in ("darrow-review-scope-v1", "darrow-review-terminal-v1"),
        "invalid review manifest",
    )
    repo = Path(fields.get("repository", ""))
    require(repo.is_absolute(), "review manifest repository must be absolute")
    bucket = repository_state(repo, create=False)
    run = manifest.parent.resolve()
    require(
        run.parent == bucket and run.name.startswith(RUN_PREFIX),
        "unsafe review run path",
    )
    require(
        not manifest.is_symlink() and not run.is_symlink(), "unsafe review run path"
    )
    return run


def check_output(repo: Path, output: Path) -> Path:
    require(output.is_absolute(), "output must be an absolute path")
    require(output.name not in ("", ".", ".."), "output must name a file")
    path = output.parent.resolve(strict=True) / output.name
    run = run_for_manifest(path.parent / "scope.tsv")
    require(
        run.parent == repository_state(repo, create=False),
        "output must be beneath this repository's review-state directory",
    )
    return path


def fields_at(path: Path) -> dict[str, str]:
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise ReviewError(f"review state is unreadable: {path}") from exc
    return {row[0]: row[1] for row in rows(content) if len(row) == 2}


def runs(bucket: Path) -> list[Path]:
    return sorted(
        path
        for path in bucket.iterdir()
        if path.name.startswith(RUN_PREFIX) and path.is_dir() and not path.is_symlink()
    )


def locate(repo: Path, target: str) -> Path | None:
    root = Path(resolve_root(os.environ, os.name))
    if not root.exists() or not (root / repository_digest(repo)).exists():
        return None
    bucket = repository_state(repo, create=False)
    matches: list[Path] = []
    from . import scope

    for run in runs(bucket):
        candidate = run / "scope.tsv"
        if not candidate.is_file() or candidate.is_symlink():
            continue
        fields = fields_at(candidate)
        if fields.get("repository") != str(repo) or fields.get("target") != target:
            continue
        scope.show(str(candidate))
        matches.append(candidate)
    require(len(matches) <= 1, f"multiple review artifacts match target: {target}")
    return matches[0] if matches else None


def dependencies(run: Path, by_file: dict[Path, Path]) -> set[Path]:
    result: set[Path] = set()
    for file, field, index in (
        (run / "scope.tsv", "prior_manifest", 1),
        (run / "verification.tsv", "previous_verification", 2),
    ):
        result.update(references(file, field, index, by_file))
    return result


def references(
    file: Path, field: str, index: int, by_file: dict[Path, Path]
) -> set[Path]:
    if not file.is_file() or file.is_symlink():
        return set()
    try:
        lines = rows(file.read_text(encoding="utf-8"))
    except (OSError, UnicodeError) as exc:
        raise ReviewError(f"review dependency is unreadable: {file}") from exc
    paths = (
        by_file.get(Path(row[index]).resolve())
        for row in lines
        if len(row) > index and row[0] == field
    )
    return {path for path in paths if path is not None}


def retained_runs(all_runs: list[Path], cutoff: float) -> set[Path]:
    by_file = {
        run / name: run
        for run in all_runs
        for name in ("scope.tsv", "verification.tsv")
    }
    keep = {
        run
        for run in all_runs
        if run.stat().st_mtime >= cutoff or (run / ".pinned").is_file()
    }
    pending = list(keep)
    while pending:
        for prior in dependencies(pending.pop(), by_file) - keep:
            keep.add(prior)
            pending.append(prior)
    return keep


@contextmanager
def bucket_lock(bucket: Path) -> Iterator[None]:
    path = bucket / ".lock"
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    acquired = False
    try:
        if os.name == "nt":
            os.lseek(descriptor, 0, os.SEEK_SET)
            windows_lock(descriptor, "LK_LOCK")
        else:
            import fcntl

            fcntl.flock(descriptor, fcntl.LOCK_EX)
        acquired = True
        yield
    finally:
        if acquired:
            if os.name == "nt":
                windows_lock(descriptor, "LK_UNLCK")
            else:
                fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def windows_lock(descriptor: int, mode: str) -> None:
    module = importlib.import_module("msvcrt")
    if mode == "LK_UNLCK":
        module.locking(descriptor, module.LK_UNLCK, 1)
        return
    deadline = time.monotonic() + WINDOWS_LOCK_WAIT_SECONDS
    while True:
        try:
            module.locking(descriptor, module.LK_NBLCK, 1)
            return
        except OSError as exc:
            if (
                exc.errno not in (errno.EACCES, errno.EAGAIN)
                or time.monotonic() >= deadline
            ):
                raise
            time.sleep(0.1)


def prune(repo: Path, older_than_days: int = RETENTION_DAYS) -> list[Path]:
    require(older_than_days >= 0, "retention days must not be negative")
    bucket = repository_state(repo)
    cutoff = time.time() - older_than_days * 86_400
    return prune_bucket(bucket, cutoff)


def prune_all(
    repo: Path | None = None, older_than_days: int = RETENTION_DAYS
) -> list[Path]:
    require(older_than_days >= 0, "retention days must not be negative")
    root = state_root(repo)
    cutoff = time.time() - older_than_days * 86_400
    removed: list[Path] = []
    for bucket in sorted(root.iterdir()):
        if not safe_bucket(bucket):
            continue
        removed.extend(prune_bucket(bucket, cutoff))
    return removed


def safe_bucket(bucket: Path) -> bool:
    return (
        bucket.is_dir()
        and not bucket.is_symlink()
        and len(bucket.name) == 64
        and all(char in "0123456789abcdef" for char in bucket.name)
    )


def prune_bucket(bucket: Path, cutoff: float) -> list[Path]:
    removed: list[Path] = []
    with bucket_lock(bucket):
        all_runs = runs(bucket)
        keep = retained_runs(all_runs, cutoff)
        for run in all_runs:
            if run not in keep:
                shutil.rmtree(run)
                removed.append(run)
    return removed


def pin(manifest: Path) -> Path:
    run = run_for_manifest(manifest)
    with bucket_lock(run.parent):
        marker = run / ".pinned"
        descriptor = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
    return run


def unpin(manifest: Path) -> Path:
    run = run_for_manifest(manifest)
    with bucket_lock(run.parent):
        (run / ".pinned").unlink()
    return run
