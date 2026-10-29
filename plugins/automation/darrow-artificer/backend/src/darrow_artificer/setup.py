"""Capture explicit recurring authority without enabling any implicit entry."""

import shutil
import subprocess
from pathlib import Path
from typing import Literal
from uuid import uuid4

from .github import GitHub, object_value
from .installation import Installation
from .models import Grant
from .storage import locked, write_object


def executable(name: str) -> str:
    result = shutil.which(name)
    if result is None:
        raise ValueError(f"Required executable is unavailable: {name}")
    return str(Path(result).resolve())


def git_output(git: str, checkout: Path, *args: str) -> str:
    return subprocess.run(
        [git, "-C", str(checkout), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def primary_checkout(git: str, checkout: Path) -> Path:
    first = git_output(git, checkout, "worktree", "list", "--porcelain").splitlines()[0]
    if not first.startswith("worktree "):
        raise ValueError("Cannot resolve the primary repository worktree")
    return Path(first.removeprefix("worktree ")).resolve(strict=True)


def initialize(
    site: Installation,
    checkout: Path,
    repository: str,
    issues: list[int],
    host: Literal["codex", "claude"] = "codex",
) -> Grant:
    git, gh, codex = executable("git"), executable("gh"), executable(host)
    primary = primary_checkout(git, checkout)
    common = Path(
        git_output(
            git, primary, "rev-parse", "--path-format=absolute", "--git-common-dir"
        )
    )
    forge = GitHub(gh, repository)
    grantor = forge.login()
    if not forge.writable(grantor):
        raise ValueError("Recurring grantor must have repository write access")
    remote = git_output(git, primary, "config", "--get", "remote.origin.url")
    if remote not in (
        f"git@github.com:{repository}.git",
        f"https://github.com/{repository}.git",
        f"https://github.com/{repository}",
    ):
        raise ValueError(
            "Origin must match the explicitly authorized GitHub repository"
        )
    grant = Grant(
        host=host,
        id=str(uuid4()),
        repository=repository,
        checkout=str(primary),
        common_git=str(common),
        grantor=grantor,
        executable=codex,
        gh=gh,
        git=git,
        issue_scope=issues,
        effects="claims,reports,worktrees,recipe,commits,push,pr",
    )
    bind(site, grant)
    return grant


def bind(site: Installation, grant: Grant) -> None:
    directory = Path(grant.common_git) / "artificer"
    with locked(directory / "admission.lock"):
        if (directory / "installation.json").exists():
            raise ValueError(
                "Legacy controlling installation: reconcile it before adding workers"
            )
        if (site.root / "grant.json").exists():
            raise ValueError("Worker already exists; inspect its state before recovery")
        bind_repository(directory, grant)
        site.save_grant(grant)
        write_object(
            directory / "workers" / f"{grant.id}.json",
            {"root": str(site.root), "grant": grant.id},
        )


def bind_repository(directory: Path, grant: Grant) -> None:
    from .storage import read_object

    path = directory / "repository.json"
    value = {
        "repository": grant.repository,
        "host": grant.host,
        "WORK_IN_PROGRESS_LIMIT": grant.WORK_IN_PROGRESS_LIMIT,
    }
    if not path.exists():
        write_object(path, value)
        return
    existing = read_object(path)
    if (existing["repository"], existing["host"]) != (grant.repository, grant.host):
        raise ValueError("Workers must use the same repository and configured host")


def labels(site: Installation) -> None:
    forge = GitHub(site.grant.gh, site.grant.repository)
    known = {
        object_value(label)["name"] for label in forge.collection("labels?per_page=100")
    }
    for name, color in (("artificer:ready", "1d76db"), ("artificer:claimed", "5319e7")):
        if name not in known:
            forge.request(forge.route("labels"), "POST", {"name": name, "color": color})
