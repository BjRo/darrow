"""Publication contracts through the console API, real Git, and a fake gh process."""

import importlib
import os
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import pytest

from darrow_git import cli, process
from darrow_git.process import git

INVOKE = process.invoke
FAKE_GH = Path(__file__).with_name("evidence_gh.py")
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415408d763f8cfc0f01f00050001ff89993d1d0000000049454e44ae426082"
)
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>\n'


def provider(
    args: Sequence[str],
    *,
    cwd: Path | None = None,
    input_bytes: bytes | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[bytes]:
    command = [sys.executable, str(FAKE_GH), *args[1:]] if args[0] == "gh" else args
    return INVOKE(command, cwd=cwd, input_bytes=input_bytes, env=env)


@dataclass
class Publication:
    repository: Path
    body: Path
    head: str
    monkeypatch: pytest.MonkeyPatch
    capture: pytest.CaptureFixture[str]

    def publish(self, *args: str, outcome: str = "published") -> dict[str, str]:
        self.monkeypatch.setattr(
            sys,
            "argv",
            [
                "darrow-publish-pr-evidence",
                "publish",
                "--expected-head",
                self.head,
                "--body-file",
                str(self.body),
                *args,
            ],
        )
        with pytest.raises(SystemExit) as result:
            cli.publish_evidence()
        output = self.capture.readouterr()
        assert (result.value.code == 0) == (outcome in {"published", "existing"}), (
            output
        )
        fields = dict(
            line.split(": ", 1) for line in output.out.splitlines() if ": " in line
        )
        assert fields["outcome"] == outcome, output
        return fields

    def record(self, name: str) -> Path:
        return self.repository / ".git" / name

    def calls(self) -> list[str]:
        return self.record("comment-calls").read_text(encoding="utf-8").splitlines()

    def image(self, name: str, content: bytes = SVG) -> Path:
        path = self.body.parent / name
        path.write_bytes(content)
        return path


@pytest.fixture
def publication(
    repository: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> Publication:
    git("switch", "-qc", "feat/evidence")
    (repository / "tracked.txt").write_text("feature\n", encoding="utf-8")
    git("commit", "-qam", "feat: evidence")
    head = git("rev-parse", "HEAD")
    body = tmp_path / "evidence body.txt"
    body.write_text(f"Verification passed for candidate {head}.\n", encoding="utf-8")
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    for name in (
        "NO_ATTACH",
        "STRICT_ATTACH",
        "DISTRACTING_LIMIT",
        "HOST_MODE",
        "FORGE_HEAD_MODE",
        "COMMENT_MODE",
        "DARROW_EVIDENCE_REPOSITORY",
    ):
        monkeypatch.delenv(name, raising=False)
    for path in Path(process.__file__).parent.glob("*.py"):
        module = importlib.import_module(f"darrow_git.{path.stem}")
        if hasattr(module, "invoke"):
            monkeypatch.setattr(module, "invoke", provider)
    which = shutil.which
    monkeypatch.setattr(
        "shutil.which", lambda name: sys.executable if name == "gh" else which(name)
    )
    return Publication(repository, body, head, monkeypatch, capsys)


def test_publish_deduplicate_and_refuse_ambiguous_comments(
    publication: Publication,
) -> None:
    result = publication.publish()
    assert result["attachment-count"] == "0"
    assert result["head-preserved"] == result["index-preserved"] == "true"
    assert Path(result["prepared-body"]).read_bytes().endswith(b">")
    calls = publication.record("api-calls").read_text(encoding="utf-8")
    assert ".body] | @tsv" in calls and "gsub" not in calls
    publication.publish(outcome="existing")
    assert len(publication.calls()) == 1
    comments = publication.record("comments")
    comments.write_bytes(comments.read_bytes() * 2)
    publication.publish(outcome="ambiguous")
    assert len(publication.calls()) == 1


def test_ordered_attachments_preserve_sources(publication: Publication) -> None:
    image = publication.image("view.png", PNG)
    detail = publication.image("detail.svg")
    video = publication.image(
        "run.mp4",
        bytes.fromhex(
            "00000018667479706d703432000000006d70343269736f6d000000086d646174"
        ),
    )
    sources = {path: path.read_bytes() for path in (image, video, detail)}
    result = publication.publish(
        "--image",
        str(image),
        "--alt",
        "Overview screenshot",
        "--video",
        str(video),
        "--explanation",
        "Recording of the verified flow",
        "--image",
        str(detail),
        "--alt",
        "Detailed result",
    )
    assert result["attachment-count"] == "3"
    body = Path(result["prepared-body"]).read_text(encoding="utf-8")
    assert "Image 1 alt text: Overview screenshot" in body
    assert f"content identity {git('hash-object', str(image))}" in body
    assert "Video 2 explanation: Recording of the verified flow" in body
    assert publication.record("attach-order").read_text(
        encoding="utf-8"
    ).splitlines() == [
        "darrow-evidence-attachment-1.png#Overview screenshot",
        "darrow-evidence-attachment-2.mp4",
        "darrow-evidence-attachment-3.svg#Detailed result",
    ]
    assert {path: path.read_bytes() for path in sources} == sources


@pytest.mark.parametrize(
    "name,content",
    [
        ("empty.svg", b""),
        ("unsupported.txt", b"x"),
        ("not-image.png", b"plain text\n"),
        ("truncated.png", PNG[:8]),
        (
            "no-ihdr.png",
            PNG[:8] + bytes.fromhex("0000001574455874") + b"0" * 21 + PNG[-12:],
        ),
        ("zero-width.png", PNG[:16] + b"\0" * 4 + PNG[20:]),
        ("zero-height.png", PNG[:20] + b"\0" * 4 + PNG[24:]),
    ],
    ids=[
        "empty",
        "unsupported",
        "renamed",
        "truncated",
        "no-ihdr",
        "zero-width",
        "zero-height",
    ],
)
def test_invalid_media_refused_before_comment(
    publication: Publication, name: str, content: bytes
) -> None:
    path = publication.image(name, content)
    publication.publish("--image", str(path), "--alt", "invalid", outcome="refused")
    assert not publication.record("comment-calls").exists()


def test_oversized_media_refused(publication: Publication) -> None:
    path = publication.image("large.svg")
    with path.open("r+b") as stream:
        stream.truncate(1048577 * 10)
    publication.publish("--image", str(path), "--alt", "large", outcome="refused")
    assert not publication.record("comment-calls").exists()


def test_missing_media_refused(publication: Publication) -> None:
    publication.publish(
        "--image",
        str(publication.body.parent / "missing.svg"),
        "--alt",
        "missing",
        outcome="refused",
    )
    assert not publication.record("comment-calls").exists()


def test_duplicate_media_refused(publication: Publication) -> None:
    one = publication.image("one.svg")
    two = publication.image("two.svg")
    publication.publish(
        "--image",
        str(one),
        "--alt",
        "one",
        "--image",
        str(two),
        "--alt",
        "two",
        outcome="refused",
    )


@pytest.mark.parametrize("alt", ["   ", "one\nattachment-2=forged"])
def test_invalid_alt_refused(publication: Publication, alt: str) -> None:
    publication.publish(
        "--image", str(publication.image("image.svg")), "--alt", alt, outcome="refused"
    )


@pytest.mark.parametrize(
    "name,value",
    [
        ("NO_ATTACH", "1"),
        ("STRICT_ATTACH", "1"),
        ("DISTRACTING_LIMIT", "1"),
        ("HOST_MODE", "enterprise"),
        ("FORGE_HEAD_MODE", "wrong"),
    ],
)
def test_provider_refusals(publication: Publication, name: str, value: str) -> None:
    publication.monkeypatch.setenv(name, value)
    publication.publish(outcome="refused")
    assert not publication.record("comment-calls").exists()


def test_identity_independent_of_source_path(publication: Publication) -> None:
    one = publication.image("path-one.svg")
    two = publication.image("path-two.svg")
    first = publication.publish("--image", str(one), "--alt", "Same presentation")
    for name in ("comments", "comment-calls", "attach-order"):
        publication.record(name).unlink()
    second = publication.publish("--image", str(two), "--alt", "Same presentation")
    assert first["identity"] == second["identity"]


@pytest.mark.parametrize(
    "mode,outcome",
    [("partial", "ambiguous"), ("extra", "partial"), ("duplicate-url", "partial")],
)
def test_uncertain_remote_body_prevents_retry(
    publication: Publication, mode: str, outcome: str
) -> None:
    publication.monkeypatch.setenv("COMMENT_MODE", mode)
    arguments = []
    if mode == "duplicate-url":
        one = publication.image("one.svg", SVG.replace(b"M0 0", b"M1 1"))
        two = publication.image("two.svg")
        arguments = [
            "--image",
            str(one),
            "--alt",
            "one",
            "--image",
            str(two),
            "--alt",
            "two",
        ]
    publication.publish(*arguments, outcome=outcome)
    assert len(publication.calls()) == 1


def test_stale_attachment_url_refused(publication: Publication) -> None:
    publication.body.write_text(
        "Evidence and https://github.com/user-attachments/assets/stale\n",
        encoding="utf-8",
    )
    publication.publish(outcome="refused")
    assert not publication.record("comment-calls").exists()


def test_crlf_and_backslashes_survive_deduplication(publication: Publication) -> None:
    publication.body.write_bytes(b"Windows path C:\\tmp\r\nSecond line.\n")
    publication.publish()
    publication.publish(outcome="existing")
    assert len(publication.calls()) == 1


def test_concurrent_head_change_prevents_republication(
    publication: Publication,
) -> None:
    publication.monkeypatch.setenv("COMMENT_MODE", "head-change")
    publication.publish(outcome="partial")
    assert len(publication.calls()) == 1
    publication.monkeypatch.delenv("COMMENT_MODE")
    publication.publish(outcome="refused")
    assert len(publication.calls()) == 1


def test_attachment_count_limit(publication: Publication) -> None:
    arguments = []
    for number in range(51):
        path = publication.image(
            f"count-{number}.svg", SVG.replace(b"M0 0", f"M{number} 0".encode())
        )
        arguments.extend(["--image", str(path), "--alt", f"image {number}"])
    publication.publish(*arguments, outcome="refused")


@pytest.mark.parametrize("suffix", ["", os.sep])
def test_temporary_parent_with_optional_separator(
    publication: Publication, suffix: str
) -> None:
    parent = publication.body.parent / "temporary parent"
    parent.mkdir()
    publication.monkeypatch.setenv("TMPDIR", str(parent) + suffix)
    publication.monkeypatch.setattr(tempfile, "tempdir", None)
    result = publication.publish()
    assert Path(result["prepared-body"]).parent == parent.resolve()
