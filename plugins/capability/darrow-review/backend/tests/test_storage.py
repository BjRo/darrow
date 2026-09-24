"""Per-user review-state location, discovery, and retention contracts."""

from __future__ import annotations

import errno
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest

from conftest import git
from darrow_review import scope, storage
from darrow_review.common import ReviewError
from darrow_review.records import Records


def packet(repo: Path, content: str = "changed", prior_manifest: str = "") -> Path:
    (repo / "file.txt").write_text(content, encoding="utf-8")
    options = scope.ScopeOptions(
        str(repo), "HEAD", "WORKTREE", prior_manifest=prior_manifest
    )
    return Path(Records(scope.prepare(options)).value("manifest"))


def test_root_defaults_and_absolute_override() -> None:
    assert storage.resolve_root({"HOME": "/people/me"}, "posix") == (
        "/people/me/.darrow/reviews"
    )
    assert storage.resolve_root(
        {"LOCALAPPDATA": r"C:\Users\Me\AppData\Local"}, "nt"
    ) == (r"C:\Users\Me\AppData\Local\Darrow\Reviews")
    assert (
        storage.resolve_root({"DARROW_REVIEW_STATE_DIR": r"D:\review-state"}, "nt")
        == r"D:\review-state"
    )
    assert (
        storage.resolve_root({"DARROW_REVIEW_STATE_DIR": r"\\server\share"}, "nt")
        == r"\\server\share"
    )
    with pytest.raises(ReviewError, match="absolute"):
        storage.resolve_root({"DARROW_REVIEW_STATE_DIR": "relative"}, "posix")
    with pytest.raises(ReviewError, match="HOME"):
        storage.resolve_root({}, "posix")
    with pytest.raises(ReviewError, match="absolute"):
        storage.resolve_root({"HOME": "relative/home"}, "posix")
    with pytest.raises(ReviewError, match="LOCALAPPDATA"):
        storage.resolve_root({}, "nt")
    with pytest.raises(ReviewError, match="absolute"):
        storage.resolve_root({"LOCALAPPDATA": r"relative\AppData"}, "nt")
    with pytest.raises(ReviewError, match="absolute"):
        storage.resolve_root({"DARROW_REVIEW_STATE_DIR": r"D:relative"}, "nt")
    with pytest.raises(ReviewError, match="absolute"):
        storage.resolve_root({"DARROW_REVIEW_STATE_DIR": r"\root-relative"}, "nt")


def test_scope_is_private_user_state_and_worktrees_are_distinct(repo: Path) -> None:
    first = packet(repo)
    state = Path(os.environ["DARROW_REVIEW_STATE_DIR"])
    assert first.is_relative_to(state)
    assert not first.is_relative_to(repo / ".git")
    assert storage.locate(repo, Records(first.read_text()).value("target")) == first
    assert storage.locate(repo, "missing") is None
    if os.name != "nt":
        assert state.stat().st_mode & 0o777 == 0o700
        assert first.parent.stat().st_mode & 0o777 == 0o700

    linked = repo.parent / "linked worktree"
    git(repo, "worktree", "add", "-qb", "linked", str(linked))
    second = packet(linked)
    assert second.is_relative_to(state)
    assert second.parent.parent != first.parent.parent
    assert storage.locate(linked, Records(second.read_text()).value("target")) == second


def test_terminal_manifest_refuses_tsv_unsafe_repository_path(repo: Path) -> None:
    with pytest.raises(ReviewError, match="tab or newline"):
        storage.allocate_terminal(repo.parent / "unsafe\tpath")


def test_locate_returns_none_before_any_review(repo: Path) -> None:
    assert storage.locate(repo, "unseen") is None
    storage.state_root(repo)
    assert storage.locate(repo, "unseen") is None


def test_locate_ignores_incomplete_run(repo: Path) -> None:
    storage.allocate(repo)
    assert storage.locate(repo, "unseen") is None


def test_locate_refuses_ambiguous_target(repo: Path) -> None:
    first = packet(repo)
    packet(repo)
    target = Records(first.read_text()).value("target")
    with pytest.raises(ReviewError, match="multiple review artifacts"):
        storage.locate(repo, target)


def test_state_root_refuses_public_permissions_and_symlink(
    repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    if os.name == "nt":
        pytest.skip("Unix permission mode")
    root = storage.state_root(repo)
    root.chmod(0o755)
    with pytest.raises(ReviewError, match="current user"):
        storage.state_root(repo)
    root.chmod(0o700)
    alias = tmp_path / "alias"
    alias.symlink_to(root, target_is_directory=True)
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(alias))
    with pytest.raises(ReviewError, match="symlink"):
        storage.state_root(repo)


def test_prune_ignores_unrelated_entries(repo: Path) -> None:
    root = storage.state_root(repo)
    (root / "notes.txt").write_text("keep", encoding="utf-8")
    assert storage.prune_all() == []
    assert (root / "notes.txt").exists()


def test_prune_refuses_corrupt_retained_dependency(repo: Path) -> None:
    original = packet(repo, content="first")
    current = packet(repo, content="second", prior_manifest=str(original))
    (current.parent / "verification.tsv").write_bytes(b"\xff")
    old = 1_600_000_000
    os.utime(original.parent, (old, old))
    with pytest.raises(ReviewError, match="dependency is unreadable"):
        storage.prune(repo)
    assert original.exists()


def test_windows_lock_retries_contention_and_releases(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts: list[int] = []

    def locking(_descriptor: int, mode: int, _length: int) -> None:
        attempts.append(mode)
        if mode == 1 and attempts.count(1) < 3:
            raise OSError(errno.EACCES, "locked")

    module = SimpleNamespace(LK_NBLCK=1, LK_UNLCK=2, locking=locking)
    monkeypatch.setattr(
        "darrow_review.storage.importlib.import_module", lambda _name: module
    )
    monkeypatch.setattr("darrow_review.storage.time.sleep", lambda _seconds: None)
    storage.windows_lock(3, "LK_LOCK")
    storage.windows_lock(3, "LK_UNLCK")
    assert attempts == [1, 1, 1, 2]


def test_windows_bucket_lock_does_not_write_locked_byte(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    windows_os = SimpleNamespace(
        name="nt",
        open=os.open,
        lseek=os.lseek,
        close=os.close,
        O_CREAT=os.O_CREAT,
        O_RDWR=os.O_RDWR,
        SEEK_SET=os.SEEK_SET,
    )
    monkeypatch.setattr(storage, "os", windows_os)
    monkeypatch.setattr(
        storage, "windows_lock", lambda _descriptor, mode: calls.append(mode)
    )
    with storage.bucket_lock(tmp_path):
        assert (tmp_path / ".lock").stat().st_size == 0
    assert calls == ["LK_LOCK", "LK_UNLCK"]


@pytest.mark.parametrize("failure", [errno.EACCES, errno.EINVAL])
def test_windows_lock_refuses_timeout_or_unrelated_error(
    monkeypatch: pytest.MonkeyPatch, failure: int
) -> None:
    def locking(_descriptor: int, _mode: int, _length: int) -> None:
        raise OSError(failure, "unavailable")

    module = SimpleNamespace(LK_NBLCK=1, LK_UNLCK=2, locking=locking)
    monkeypatch.setattr(
        "darrow_review.storage.importlib.import_module", lambda _name: module
    )
    monkeypatch.setattr(storage, "WINDOWS_LOCK_WAIT_SECONDS", 0)
    with pytest.raises(OSError) as error:
        storage.windows_lock(3, "LK_LOCK")
    assert error.value.errno == failure


def test_prune_preserves_referenced_history_then_removes_whole_chain(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = packet(repo, content="first")
    repair = packet(repo, content="second", prior_manifest=str(original))
    current = packet(repo, content="third", prior_manifest=str(repair))
    old = 1_600_000_000
    now = old + 31 * 86_400
    for run in (original.parent, repair.parent):
        os.utime(run, (old, old))
    os.utime(current.parent, (now, now))
    monkeypatch.setattr("darrow_review.storage.time.time", lambda: now)
    assert storage.prune(repo) == []
    assert original.exists() and repair.exists() and current.exists()

    os.utime(current.parent, (old, old))
    removed = storage.prune(repo)
    assert set(removed) == {original.parent, repair.parent, current.parent}
    assert not any(path.exists() for path in removed)


def test_prune_preserves_prior_verification_record(repo: Path) -> None:
    original = packet(repo, content="first")
    previous = original.parent / "verification.tsv"
    previous.write_text("format\tdarrow-review-verification-v1\n", encoding="utf-8")
    current = packet(repo, content="second")
    (current.parent / "verification.tsv").write_text(
        f"previous_verification\thash\t{previous}\n", encoding="utf-8"
    )
    old = 1_600_000_000
    os.utime(original.parent, (old, old))
    assert storage.prune(repo) == []
    assert previous.exists()


def test_new_review_keeps_expired_prior_manifest(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = packet(repo, content="first")
    old = 1_600_000_000
    os.utime(original.parent, (old, old))
    monkeypatch.setattr("darrow_review.storage.time.time", lambda: old + 31 * 86_400)
    repair = packet(repo, content="second", prior_manifest=str(original))
    assert repair.exists() and original.exists()


def test_noncanonical_prior_path_still_keeps_expired_run(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = packet(repo, content="first")
    alias = original.parent / ".." / original.parent.name / original.name
    old = 1_600_000_000
    os.utime(original.parent, (old, old))
    monkeypatch.setattr("darrow_review.storage.time.time", lambda: old + 31 * 86_400)
    repair = packet(repo, content="second", prior_manifest=str(alias))
    assert repair.exists() and original.exists()


def test_concurrent_prune_waits_until_prior_is_linked(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = packet(repo, content="first")
    old = 1_600_000_000
    os.utime(original.parent, (old, old))
    (repo / "file.txt").write_text("second", encoding="utf-8")
    validated = Event()
    release = Event()
    actual_validate = scope.validate_prior

    def paused_validate(path: Path, base: str, prior: str) -> None:
        actual_validate(path, base, prior)
        validated.set()
        assert release.wait(timeout=5)

    monkeypatch.setattr(scope, "validate_prior", paused_validate)
    with ThreadPoolExecutor(max_workers=2) as pool:
        prepare = pool.submit(
            scope.prepare,
            scope.ScopeOptions(
                str(repo), "HEAD", "WORKTREE", prior_manifest=str(original)
            ),
        )
        assert validated.wait(timeout=5)
        pruning = pool.submit(storage.prune, repo)
        try:
            with pytest.raises(TimeoutError):
                pruning.result(timeout=0.1)
        finally:
            release.set()
        assert Records(prepare.result(timeout=5)).value("manifest")
        assert pruning.result(timeout=5) == []
    assert original.exists()


def test_pin_retains_run_and_dependencies(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = packet(repo, content="first")
    repair = packet(repo, content="second", prior_manifest=str(original))
    storage.pin(repair)
    old = 1_600_000_000
    for run in (original.parent, repair.parent):
        os.utime(run, (old, old))
    monkeypatch.setattr("darrow_review.storage.time.time", lambda: old + 31 * 86_400)
    assert storage.prune(repo) == []
    storage.unpin(repair)
    os.utime(repair.parent, (old, old))
    assert set(storage.prune(repo)) == {original.parent, repair.parent}


def test_prune_refuses_unsafe_state_root(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(repo / ".git"))
    with pytest.raises(ReviewError, match="outside the repository"):
        packet(repo)


def test_global_prune_removes_old_runs_after_repository_disappears(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest = packet(repo)
    old = 1_600_000_000
    os.utime(manifest.parent, (old, old))
    shutil.rmtree(repo)
    monkeypatch.setattr("darrow_review.storage.time.time", lambda: old + 31 * 86_400)
    assert storage.prune_all() == [manifest.parent]
    assert not manifest.parent.exists()


def test_global_prune_covers_multiple_worktree_buckets(repo: Path) -> None:
    first = packet(repo)
    linked = repo.parent / "linked worktree"
    git(repo, "worktree", "add", "-qb", "linked", str(linked))
    second = packet(linked)
    old = 1_600_000_000
    for manifest in (first, second):
        os.utime(manifest.parent, (old, old))
    assert set(storage.prune_all()) == {first.parent, second.parent}
