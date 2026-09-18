"""Evidence reconciliation and preflight failures never trigger retries."""

from pathlib import Path

import pytest

from darrow_git import evidence, evidence_files, evidence_preflight
from darrow_git.evidence_identity import Identity, classify
from darrow_git.process import RefusalError, git
from forge import Forge


def arguments(tmp_path: Path) -> list[str]:
    body = tmp_path / "body.md"
    body.write_text("Evidence.\n")
    return [
        "publish",
        "--expected-head",
        git("rev-parse", "HEAD"),
        "--body-file",
        str(body),
    ]


def test_preflight_and_reconciliation_failures(
    remote: Path,
    forge: Forge,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    args = arguments(tmp_path)
    with pytest.raises(SystemExit) as failure:
        evidence.run(args)
    assert failure.value.code == 4
    assert "stage: pr-preflight" in capsys.readouterr().out
    forge.created = True

    def unavailable(*args: object) -> str:
        raise RefusalError("cannot reconcile top-level PR comments")

    monkeypatch.setattr(evidence_preflight, "comments", unavailable)
    with pytest.raises(SystemExit) as failure:
        evidence.run(args)
    assert failure.value.code == 4
    assert "stage: reconciliation" in capsys.readouterr().out
    assert not any(
        call[:2] == ["pr", "comment"] and "--help" not in call for call in forge.calls
    )


@pytest.mark.parametrize(
    "mode,outcome",
    [
        ("extra", "partial"),
        ("conflicting", "ambiguous"),
        ("failed", "ambiguous"),
        ("head", "partial"),
        ("observation-failure", "partial"),
    ],
)
def test_post_publication_uncertainty(
    remote: Path,
    forge: Forge,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    mode: str,
    outcome: str,
) -> None:
    forge.created = True
    original = forge.comment

    def uncertain(args: list[str]) -> tuple[str, int]:
        result = original(args)
        if "--help" not in args:
            change_remote_observation(forge, mode)
        return result

    monkeypatch.setattr(forge, "comment", uncertain)
    with pytest.raises(SystemExit) as failure:
        evidence.run(arguments(tmp_path))
    assert failure.value.code == 5
    output = capsys.readouterr().out
    assert f"outcome: {outcome}" in output
    assert "one gh pr comment invocation attempted" in output
    assert (
        sum(
            call[:2] == ["pr", "comment"] and "--help" not in call
            for call in forge.calls
        )
        == 1
    )


def change_remote_observation(forge: Forge, mode: str) -> None:
    comments = {
        "extra": forge.comments + " extra",
        "conflicting": forge.comments + "\n" + forge.comments,
        "failed": "",
    }
    if mode in comments:
        forge.comments = comments[mode]
    elif mode == "head":
        forge.pr_head = "f" * 40
    else:
        forge.mode = "unavailable"


@pytest.mark.parametrize("change", ["head", "body", "attachment"])
def test_changed_snapshot_refuses_before_comment(
    remote: Path,
    forge: Forge,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    change: str,
) -> None:
    forge.created = True
    args = arguments(tmp_path)
    image = tmp_path / "picture.svg"
    image.write_text("<svg>image</svg>")
    args += ["--image", str(image), "--alt", "Evidence image"]
    state = evidence.prepare(args[1:])
    if change == "head":
        git("commit", "--allow-empty", "-qm", "fix: concurrent change")
    elif change == "body":
        state.prepared.write_text("changed")
    else:
        state.files.attachments[0].snapshot.write_text("changed")
    with pytest.raises(SystemExit) as failure:
        evidence.recheck_files(state)
    assert failure.value.code == 4
    assert "outcome: refused" in capsys.readouterr().out
    assert not any(
        call[:2] == ["pr", "comment"] and "--help" not in call for call in forge.calls
    )


def test_comment_classification() -> None:
    identity = Identity(
        "identity", "full-marker", "candidate", b"", "candidate full-marker exact"
    )
    assert classify("", identity, 0).outcome == "none"
    assert classify("candidate", identity, 0).outcome == "ambiguous"
    assert (
        classify("1\turl\tcandidate different-marker", identity, 0).outcome
        == "ambiguous"
    )
    assert (
        classify("1\turl\tcandidate full-marker changed", identity, 0).outcome
        == "partial"
    )
    assert (
        classify("1\turl\tcandidate full-marker exact", identity, 0).outcome
        == "complete"
    )


@pytest.mark.parametrize(
    "help_text,expected",
    [
        ("global maximum 1\n--attach file\n  Maximum: 10\n\n--other", 10),
        ("--attach file (maximum 50)\n  --body Maximum 1", 50),
        ("--attach file\n  up to 25 files", 25),
    ],
)
def test_attachment_limit_scope(help_text: str, expected: int) -> None:
    assert evidence_preflight.advertised_limit(help_text) == expected


def test_missing_snapshot_file(tmp_path: Path) -> None:
    with pytest.raises(RefusalError, match="unreadable"):
        evidence_files.checked_file(tmp_path / "missing" / "body", "unreadable body")


def test_body_identity_preserves_legacy_git_filters(
    repository: Path, tmp_path: Path
) -> None:
    from darrow_git.evidence_identity import build
    from darrow_git.evidence_options import EvidenceOptions

    git("config", "core.autocrlf", "true")
    body = tmp_path / "windows-body.md"
    body.write_bytes(b"First\r\nSecond\r\n")
    files = evidence_files.snapshot(EvidenceOptions(body=str(body)), repository)
    head = git("rev-parse", "HEAD")
    identity = build("fixture/repo", "42", head, files)
    legacy_body_hash = git("hash-object", str(files.directory / "body"))
    assert legacy_body_hash != evidence_files.hash_bytes(files.body)
    legacy_input = f"repository=fixture/repo\npr=42\nhead={head}\nbody={legacy_body_hash}\nattachment-count=0"
    assert identity.value == evidence_files.hash_bytes(legacy_input.encode())


def test_video_presentation_and_partial_existing(
    remote: Path, forge: Forge, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    forge.created = True
    video = tmp_path / "video.mp4"
    video.write_bytes(b"xxxxftypmp42padding-mdat")
    args = [
        *arguments(tmp_path),
        "--video",
        str(video),
        "--explanation",
        "Recorded acceptance",
    ]
    with pytest.raises(SystemExit) as success:
        evidence.run(args)
    assert success.value.code == 0
    assert "outcome: published" in capsys.readouterr().out
    assert "Video 1 explanation: Recorded acceptance" in forge.body
    forge.comments += " extra"
    with pytest.raises(SystemExit) as partial:
        evidence.run(args)
    assert partial.value.code == 5
    assert "outcome: partial" in capsys.readouterr().out
