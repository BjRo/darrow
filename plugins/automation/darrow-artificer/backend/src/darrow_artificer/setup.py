"""Capture explicit recurring authority without enabling any implicit entry."""

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Literal
from uuid import uuid4

from .github import GitHub, object_value
from .installation import Installation
from .models import Grant
from .storage import locked, write_bytes, write_object


def executable(name: str) -> str:
    result = shutil.which(name)
    if result is None:
        raise ValueError(f"Required executable is unavailable: {name}")
    return str(Path(result).resolve())


def git_output(git: str, checkout: Path, *args: str) -> str:
    return subprocess.run(
        [git, "-C", str(checkout), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def profile_directory(path: Path) -> str:
    if not path.is_absolute() or not path.is_dir():
        raise ValueError(
            f"Profile directory must be an existing absolute directory: {path}"
        )
    return str(path.resolve())


def initialize(
    site: Installation,
    checkout: Path,
    repository: str,
    issues: list[int],
    host: Literal["codex", "claude"] = "codex",
    profile: Path | None = None,
) -> Grant:
    profile_dir = (
        profile_directory(profile)
        if profile is not None
        else str(Path.home() / f".{host}")
    )
    git, gh, codex = executable("git"), executable("gh"), executable(host)
    selected = Path(git_output(git, checkout, "rev-parse", "--show-toplevel")).resolve()
    common = Path(
        git_output(
            git, selected, "rev-parse", "--path-format=absolute", "--git-common-dir"
        )
    )
    require_external_state(site.root, git, selected)
    forge = GitHub(gh, repository)
    grantor = forge.login()
    if not forge.writable(grantor):
        raise ValueError("Recurring grantor must have repository write access")
    remote = git_output(git, selected, "config", "--get", "remote.origin.url")
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
        checkout=str(selected),
        common_git=str(common),
        grantor=grantor,
        executable=codex,
        profile_dir=profile_dir,
        gh=gh,
        git=git,
        issue_scope=issues,
        effects="claims,reports,worktrees,recipe,commits,push,pr",
    )
    bind(site, grant)
    return grant


def bind(site: Installation, grant: Grant) -> None:
    directory = site.root
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


def install_command(*, warn: bool = True) -> Path:
    from . import launcher

    destination = Path.home() / ".local" / "bin" / "darrow-artificer"
    source = Path(launcher.__file__).read_bytes()
    write_bytes(
        destination,
        b"#!/usr/bin/env -S uv run --quiet --no-project --script\n" + source,
    )
    destination.chmod(0o700)
    if warn and str(destination.parent) not in os.environ.get("PATH", "").split(
        os.pathsep
    ):
        print(
            f"Add {destination.parent} to PATH to run darrow-artificer.",
            file=sys.stderr,
        )
    return destination


def require_external_state(state: Path, git: str, checkout: Path) -> None:
    listing = git_output(git, checkout, "worktree", "list", "--porcelain")
    roots = [
        Path(line.removeprefix("worktree ")).resolve()
        for line in listing.splitlines()
        if line.startswith("worktree ")
    ]
    if any(state.is_relative_to(root) for root in roots):
        raise ValueError(
            "Artificer state must live outside repository checkouts and worktrees"
        )
