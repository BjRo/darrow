"""Ticket body files stay under the user-selected Darrow temp root."""

import os
from pathlib import Path

import pytest

from darrow_tickets.cli import main
from darrow_tickets.errors import TicketError
from darrow_tickets.temporary import root_path


def test_native_default_roots() -> None:
    assert root_path({"HOME": "/home/alice"}, "posix") == "/home/alice/.darrow/tmp"
    assert root_path({"LOCALAPPDATA": r"C:\Users\Alice\AppData\Local"}, "nt") == (
        r"C:\Users\Alice\AppData\Local\Darrow\Tmp"
    )


@pytest.mark.parametrize("platform", ["posix", "nt"])
def test_refuses_relative_override(platform: str) -> None:
    with pytest.raises(TicketError, match="absolute"):
        root_path({"DARROW_TMP_DIR": "relative/tmp"}, platform)


def test_temp_file_is_private_and_needs_no_tracker(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root = tmp_path / "Darrow Tmp"
    monkeypatch.setenv("DARROW_TMP_DIR", str(root))
    monkeypatch.setattr(
        "darrow_tickets.cli.select_provider",
        lambda _: pytest.fail("temp-file must not select a tracker"),
    )
    assert main(["temp-file"]) == 0
    path = Path(capsys.readouterr().out.strip())
    assert path.is_file()
    assert path.parent == root
    if os.name != "nt":
        assert path.stat().st_mode & 0o077 == 0
        assert root.stat().st_mode & 0o077 == 0
    path.unlink()


def test_refuses_symlink_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    target = tmp_path / "target"
    target.mkdir()
    link = tmp_path / "link"
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        if os.name != "nt":
            raise
        pytest.skip("Windows symlink creation requires developer mode or privilege")
    monkeypatch.setenv("DARROW_TMP_DIR", str(link))
    assert main(["temp-file"]) == 2
    assert "symlink" in capsys.readouterr().err
    assert not list(target.iterdir())


def test_refuses_insecure_existing_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    if os.name == "nt":
        pytest.skip("POSIX permissions only")
    root = tmp_path / "shared"
    root.mkdir(mode=0o755)
    root.chmod(0o755)
    monkeypatch.setenv("DARROW_TMP_DIR", str(root))
    assert main(["temp-file"]) == 2
    assert "private" in capsys.readouterr().err
    assert not list(root.iterdir())
