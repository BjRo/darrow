"""Exact publication identity and refusal behavior with local remotes."""

from pathlib import Path

import pytest

from darrow_git import pr, publication
from darrow_git.process import RefusalError, git
from forge import Forge


def test_existing_publication_pins_commit(
    remote: Path,
    repository: Path,
    forge: Forge,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    git("push", "-qu", "origin", "HEAD")
    old = git("rev-parse", "HEAD")
    (repository / "tracked.txt").write_text("new")
    git("commit", "-qam", "fix: finish")
    expected = git("rev-parse", "HEAD")
    forge.created = True
    forge.pr_head = old
    original = forge.pr_row

    def follow_remote(args: list[str]) -> str:
        forge.pr_head = git("--git-dir", str(remote), "rev-parse", "fix/181-python-git")
        return original(args)

    monkeypatch.setattr(forge, "pr_row", follow_remote)
    pr.run(["publish-existing", "--expected-head", expected])
    assert "push: completed" in capsys.readouterr().out
    assert git("--git-dir", str(remote), "rev-parse", "fix/181-python-git") == expected
    pr.run(["publish-existing", "--expected-head", expected])
    assert "push: none" in capsys.readouterr().out


@pytest.mark.parametrize(
    "mode", ["stale", "wrong-base", "draft", "fork", "unavailable", "missing"]
)
def test_verification_fails_closed(remote: Path, forge: Forge, mode: str) -> None:
    git("push", "-qu", "origin", "HEAD")
    expected = git("rev-parse", "HEAD")
    forge.created = mode != "missing"
    if mode == "stale":
        forge.pr_head = git("rev-parse", "main")
    forge.base = "develop" if mode == "wrong-base" else "main"
    forge.draft = str(mode == "draft").lower()
    forge.cross = str(mode == "fork").lower()
    forge.mode = mode
    with pytest.raises(RefusalError, match="push: none"):
        pr.run(["verify", "--expected-head", expected])
    assert not any(call[:2] == ["pr", "create"] for call in forge.calls)
    assert git("--git-dir", str(remote), "rev-parse", "fix/181-python-git") == expected
    if mode == "stale":
        assert forge.observations == 5


def test_draft_selected_base_and_upstream(
    remote: Path, forge: Forge, capsys: pytest.CaptureFixture[str]
) -> None:
    git("branch", "release", "main")
    git("push", "origin", "release")
    git("branch", "--set-upstream-to", "origin/main")
    pr.run(["inspect", "--base", "release"])
    assert "base branch (selected): release" in capsys.readouterr().out
    pr.run(
        [
            "create",
            "--title",
            "fix: selected base",
            "-b",
            "Explanation",
            "--base",
            "release",
            "--draft",
        ]
    )
    output = capsys.readouterr().out
    assert "draft: true" in output and "upstream is origin/main" in output
    pr.run(
        [
            "verify",
            "--expected-head",
            git("rev-parse", "HEAD"),
            "--base",
            "release",
            "--draft",
        ]
    )
    assert "publication: verified" in capsys.readouterr().out


@pytest.mark.parametrize("effect", ["completed", "uncertain"])
def test_incomplete_creation_reports_effects(
    remote: Path, forge: Forge, effect: str
) -> None:
    git("push", "-qu", "origin", "HEAD")
    forge.created = True
    state = publication.Publication(
        expected=git("rev-parse", "HEAD"),
        push="completed",
        create=effect,
        initial_url="https://github.com/fixture/repo/pull/99",
    )
    forge.pr_head = git("rev-parse", "main")
    with pytest.raises(RefusalError) as error:
        publication.verify(state)
    assert "push completed" in str(error.value)
    assert "do not create another PR" in str(error.value)


def test_identity_change_during_propagation(
    remote: Path, forge: Forge, monkeypatch: pytest.MonkeyPatch
) -> None:
    git("push", "-qu", "origin", "HEAD")
    forge.created = True
    original = forge.pr_row

    def changed(args: list[str]) -> str:
        if forge.observations == 1:
            forge.pr_head = git("rev-parse", "main")
        else:
            forge.pr_head = ""
            forge.number = "43"
        return original(args)

    monkeypatch.setattr(forge, "pr_row", changed)
    with pytest.raises(RefusalError, match="identity changed"):
        pr.run(["verify", "--expected-head", git("rev-parse", "HEAD")])
    assert forge.observations == 2
