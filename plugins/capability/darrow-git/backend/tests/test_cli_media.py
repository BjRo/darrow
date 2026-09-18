"""Console exit contracts, provider failures, and bounded media recognition."""

from collections.abc import Callable
from pathlib import Path

import pytest

from darrow_git import cli, media
from darrow_git.process import RefusalError, command, invoke


@pytest.mark.parametrize(
    "entrypoint,args",
    [
        (cli.create_branch, ["inspect"]),
        (cli.prepare_branch, ["inspect"]),
        (cli.create_commit, ["inspect"]),
        (cli.create_pr, ["inspect"]),
    ],
)
def test_console_inspect(
    repository: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    entrypoint: Callable[[], None],
    args: list[str],
) -> None:
    monkeypatch.setattr("sys.argv", ["darrow-command", *args])
    entrypoint()
    assert "## mode:" in capsys.readouterr().out


@pytest.mark.parametrize(
    "entrypoint,name",
    [
        (cli.create_branch, "darrow-create-branch"),
        (cli.prepare_branch, "darrow-prepare-task-branch"),
        (cli.create_commit, "darrow-create-commit"),
        (cli.create_pr, "darrow-create-pr"),
        (cli.publish_evidence, "darrow-publish-pr-evidence"),
    ],
)
def test_cli_refusal(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    entrypoint: Callable[[], None],
    name: str,
) -> None:
    monkeypatch.setattr("sys.argv", [name])
    with pytest.raises(SystemExit) as failure:
        entrypoint()
    assert failure.value.code == 64
    assert f"usage: {name} " in capsys.readouterr().err


def test_cli_filesystem_boundary(capsys: pytest.CaptureFixture[str]) -> None:
    def inaccessible(args: list[str]) -> None:
        raise PermissionError("cannot read requested file")

    with pytest.raises(SystemExit) as failure:
        cli.execute(inaccessible)
    assert failure.value.code == 4
    assert "cannot read requested file" in capsys.readouterr().err


def test_provider_failures(tmp_path: Path) -> None:
    with pytest.raises(RefusalError, match="cannot execute"):
        invoke([str(tmp_path / "missing-program")])
    with pytest.raises(RefusalError):
        command("git", "not-a-real-command")


@pytest.mark.parametrize(
    "extension,data",
    [
        (
            "png",
            bytes.fromhex("89504e470d0a1a0a0000000d494844520000000100000001")
            + b"padding padding"
            + bytes.fromhex("0000000049454e44ae426082"),
        ),
        ("jpg", b"\xff\xd8\xff\xe0padding\xff\xc0\xff\xd9"),
        ("gif", b"GIF89a\x01\x00\x01\x00padding;"),
        ("webp", b"RIFFxxxxWEBPVP8Xpadding"),
        ("mp4", b"xxxxftypmp42padding-mdat"),
        ("webm", bytes.fromhex("1a45dfa318538067")),
        ("svg", b"<svg><text>Example</text></svg>"),
    ],
)
def test_media_valid_and_truncated(tmp_path: Path, extension: str, data: bytes) -> None:
    path = tmp_path / ("media." + extension)
    path.write_bytes(data)
    assert media.matches(path, extension, len(data))
    path.write_bytes(data[:3])
    assert not media.matches(path, extension, 3)
    assert not media.matches(path, "txt", 3)
