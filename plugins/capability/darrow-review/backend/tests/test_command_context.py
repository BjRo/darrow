from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import git
from darrow_review import scope
from darrow_review.records import Records
from fresh_install import command, runtime

BACKEND = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(os.name == "nt", reason="Executes the documented Unix bootstrap")
def test_documented_bootstrap_clears_ambient_git_context(
    repo: Path, tmp_path: Path
) -> None:
    skill = (BACKEND.parent / "skills/code-review/SKILL.md").read_text(encoding="utf-8")
    recipe = skill.split("```sh\n", 1)[1].split("```", 1)[0]
    recipe = "\n".join(
        line for line in recipe.splitlines() if not line.startswith("repo_input=")
    )
    recipe += '\nprintf "%s\\n" "$repo"\n'
    subdirectory = repo / "subdirectory"
    subdirectory.mkdir()
    environment = dict(os.environ, repo_input=str(subdirectory))
    for name in (
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    ):
        environment[name] = str(tmp_path / "wrong repository")
    process = subprocess.run(
        ["bash", "-c", recipe],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert process.returncode == 0, process.stderr
    assert process.stdout.strip() == str(repo)


def copied_backend(tmp_path: Path) -> Path:
    copy = (
        tmp_path
        / "plugin ' $HOME $(touch INJECTED) `touch INJECTED` ; & [x]"
        / "backend"
    )
    copy.mkdir(parents=True)
    shutil.copytree(
        BACKEND / "src", copy / "src", ignore=shutil.ignore_patterns("__pycache__")
    )
    for name in ("pyproject.toml", "uv.lock"):
        shutil.copyfile(BACKEND / name, copy / name)
    return copy


def test_emitted_commands_preserve_hostile_paths(repo: Path, tmp_path: Path) -> None:
    backend = copied_backend(tmp_path)
    target = repo.with_name(
        "repository ' $HOME $(touch INJECTED) `touch INJECTED` ; & [x]"
    )
    repo.rename(target)
    (target / "file.txt").write_text("prior\n", encoding="utf-8")
    prior = Records(
        runtime(
            backend,
            tmp_path,
            "review-scope",
            "prepare",
            "--repo",
            str(target),
            "--base",
            "HEAD",
            "--target",
            "WORKTREE",
        )
    )
    shell = ["pwsh", "-NoProfile", "-Command"] if os.name == "nt" else ["bash", "-c"]
    caller = tmp_path / "unrelated caller"
    caller.mkdir()
    assert command(caller, *shell, prior.value("show_command")) == Path(
        prior.value("diff")
    ).read_text(encoding="utf-8")
    (target / "file.txt").write_text("current\n", encoding="utf-8")
    current = Records(
        runtime(
            backend,
            tmp_path,
            "review-scope",
            "prepare",
            "--repo",
            str(target),
            "--base",
            "HEAD",
            "--target",
            "WORKTREE",
            "--prior-manifest",
            prior.value("manifest"),
        )
    )
    assert command(
        caller, *shell, current.value("repair_show_command")
    ) == scope.compare(prior.value("manifest"), current.value("manifest"))
    assert not list(tmp_path.rglob("INJECTED"))
    assert git(target, "status", "--porcelain=v1") == "M file.txt"
