"""Capture explicit recurring authority without enabling any implicit entry."""

import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

from cryptography.fernet import Fernet

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


def primary_checkout(git: str, checkout: Path) -> Path:
    first = git_output(git, checkout, "worktree", "list", "--porcelain").splitlines()[0]
    if not first.startswith("worktree "):
        raise ValueError("Cannot resolve the primary repository worktree")
    return Path(first.removeprefix("worktree ")).resolve(strict=True)


def initialize(
    site: Installation,
    checkout: Path,
    repository: str,
    plugins: list[str],
    credential_home: Path,
    model: str,
    effort: str,
    issues: list[int],
) -> Grant:
    git, gh, codex = executable("git"), executable("gh"), executable("codex")
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
    remote = git_output(git, primary, "remote", "get-url", "origin")
    if remote not in (
        f"git@github.com:{repository}.git",
        f"https://github.com/{repository}.git",
        f"https://github.com/{repository}",
    ):
        raise ValueError(
            "Origin must match the explicitly authorized GitHub repository"
        )
    grant = Grant(
        id=str(uuid4()),
        repository=repository,
        checkout=str(primary),
        common_git=str(common),
        grantor=grantor,
        codex=codex,
        gh=gh,
        git=git,
        model=model,
        effort=effort,
        credential_home=str(credential_home.resolve(strict=True)),
        plugins=[str(Path(plugin).resolve(strict=True)) for plugin in plugins],
        issue_scope=issues,
        subscription_only_confirmed=True,
        effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
    )
    bind(site, grant)
    return grant


def bind(site: Installation, grant: Grant) -> None:
    directory = Path(grant.common_git) / "artificer"
    with locked(directory / "admission.lock"):
        if (directory / "installation.json").exists() or (
            site.root / "grant.json"
        ).exists():
            raise ValueError(
                "A controlling installation already exists; inspect it before recovery"
            )
        site.save_grant(grant)
        write_bytes(site.root / "archive.key", Fernet.generate_key())
        write_object(
            directory / "installation.json", {"root": str(site.root), "grant": grant.id}
        )


def labels(site: Installation) -> None:
    forge = GitHub(site.grant.gh, site.grant.repository)
    known = {
        object_value(label)["name"] for label in forge.collection("labels?per_page=100")
    }
    for name, color in (("artificer:ready", "1d76db"), ("artificer:claimed", "5319e7")):
        if name not in known:
            forge.request(forge.route("labels"), "POST", {"name": name, "color": color})
