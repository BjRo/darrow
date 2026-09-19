"""Archives preserve opaque native bytes but never package credentials."""

import io
import os
import zipfile
from pathlib import Path

import pytest
from cryptography.fernet import Fernet, InvalidToken

from darrow_artificer.archive import restore, save


def test_encrypted_roundtrip(tmp_path: Path) -> None:
    native = tmp_path / "native"
    native.mkdir()
    (native / "sessions").mkdir()
    (native / "sessions" / "original.jsonl").write_bytes(b"native-private-history")
    (native / "auth.json").write_bytes(b"secret-credential")
    (native / "state_5.sqlite").write_bytes(b"native-database")
    os.utime(native / "state_5.sqlite", (0, 0))
    archive = tmp_path / "archive.enc"
    key = Fernet.generate_key()
    save(native, archive, key)
    assert b"native-private-history" not in archive.read_bytes()
    with pytest.raises(InvalidToken):
        Fernet(Fernet.generate_key()).decrypt(archive.read_bytes())
    destination = tmp_path / "restored"
    restore(archive, destination, key)
    assert (
        destination / "sessions" / "original.jsonl"
    ).read_bytes() == b"native-private-history"
    assert (destination / "state_5.sqlite").read_bytes() == b"native-database"
    assert not (destination / "auth.json").exists()


def test_refuse_existing_restore_destination(tmp_path: Path) -> None:
    with pytest.raises(FileExistsError):
        restore(tmp_path / "missing", tmp_path, Fernet.generate_key())


def test_refuse_native_symlinks(tmp_path: Path) -> None:
    native = tmp_path / "native"
    native.mkdir()
    (native / "unexpected").symlink_to(tmp_path / "outside")
    with pytest.raises(ValueError, match="symbolic link"):
        save(native, tmp_path / "archive", Fernet.generate_key())


def test_auth_symlink_is_excluded(tmp_path: Path) -> None:
    native = tmp_path / "native"
    native.mkdir()
    (native / "auth.json").symlink_to(tmp_path / "credentials")
    archive = tmp_path / "archive"
    key = Fernet.generate_key()
    save(native, archive, key)
    restore(archive, tmp_path / "restored", key)
    assert not list((tmp_path / "restored").iterdir())


def test_regenerable_plugin_environments_are_excluded(tmp_path: Path) -> None:
    native = tmp_path / "native"
    backend = native / "skills/plugin/backend"
    environment = backend / ".venv/bin"
    environment.mkdir(parents=True)
    (environment / "python").symlink_to("/usr/bin/python3")
    (backend / "uv.lock").write_text("locked runtime")
    archive = tmp_path / "archive"
    key = Fernet.generate_key()
    save(native, archive, key)
    destination = tmp_path / "restored"
    restore(archive, destination, key)
    assert (
        destination / "skills/plugin/backend/uv.lock"
    ).read_text() == "locked runtime"
    assert not (destination / "skills/plugin/backend/.venv").exists()


@pytest.mark.parametrize("member", ["../escape", "/absolute", "auth.json"])
def test_restore_refuses_unsafe_members(tmp_path: Path, member: str) -> None:
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as bundle:
        bundle.writestr(member, "unsafe")
    key = Fernet.generate_key()
    archive = tmp_path / "archive"
    archive.write_bytes(Fernet(key).encrypt(data.getvalue()))
    with pytest.raises(ValueError):
        restore(archive, tmp_path / "restored", key)
    assert not (tmp_path / "restored").exists()


def test_missing_home_is_not_an_empty_archive(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unavailable"):
        save(tmp_path / "missing", tmp_path / "archive", Fernet.generate_key())
