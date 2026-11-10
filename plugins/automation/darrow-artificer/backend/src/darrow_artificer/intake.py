"""Collect setup intent without waiting on input in scripted execution."""

import argparse
import subprocess
import sys
from pathlib import Path

from . import shell_path
from .installation import Installation
from .launcher import installation_state, repository_at
from .models import Grant
from .setup import executable, git_output


def prompt(label: str, default: str = "") -> str:
    return input(f"{label} [{default}]: ").strip() or default


def saved_host(repository: str | None) -> str | None:
    if repository is None:
        return None
    state = installation_state(repository)
    return Installation(state).grant.host if (state / "grant.json").exists() else None


def prepare(args: argparse.Namespace) -> None:
    args.existing = saved_installation(args)
    if args.existing is not None:
        reuse(args.existing, args)
    interactive = sys.stdin.isatty()
    if interactive:
        guided_inputs(args)
    else:
        args.host = args.host or saved_host(args.repository)
    validate_inputs(args)
    if interactive:
        confirm(args)
    else:
        args.path_files = shell_path.prepare(args.setup_path)


def validate_inputs(args: argparse.Namespace) -> None:
    missing = [
        f"--{name}"
        for name in ("repository", "checkout", "host")
        if not getattr(args, name)
    ]
    if missing:
        raise ValueError("Missing initialization flags: " + ", ".join(missing))
    if args.host not in {"codex", "claude"}:
        raise ValueError("Host must be codex or claude")


def guided_inputs(args: argparse.Namespace) -> None:
    if args.checkout is None:
        checkout = git_output(
            executable("git"), Path.cwd(), "rev-parse", "--show-toplevel"
        )
        args.checkout = Path(prompt("Checkout", checkout))
    if args.repository is None:
        args.repository = prompt("Repository", repository_at(args.checkout))
    if args.host is None:
        args.host = prompt("Host (codex/claude)", saved_host(args.repository) or "")


def confirm(args: argparse.Namespace) -> None:
    grant = args.existing.grant if args.existing else None
    profile = args.profile_dir or Path.home() / f".{args.host}"
    state = args.state or installation_state(args.repository)
    print(
        f"Repository: {args.repository}\nHost: {args.host}\nProfile: {profile}\nWorkers: {grant.workers if grant else 1}\nWIP: {grant.WORK_IN_PROGRESS_LIMIT if grant else 1}\nState: {state}"
    )
    args.path_files = guided_path(args.setup_path)
    print(f"PATH setup: {'yes' if args.path_files else 'no'}")
    action = (
        "Repair installed command and save? (y/N)"
        if grant
        else "Authorize unattended delivery and save? (y/N)"
    )
    if prompt(action).lower() != "y":
        raise ValueError("Initialization cancelled; no configuration saved")


def saved_installation(args: argparse.Namespace) -> Installation | None:
    repository = args.repository
    if (
        repository is None
        and args.state is not None
        and (args.state / "grant.json").exists()
    ):
        repository = Installation(args.state).grant.repository
    if repository is None:
        try:
            repository = repository_at(args.checkout or Path.cwd())
        except (ValueError, subprocess.CalledProcessError):
            return None
    state = installation_state(repository)
    return Installation(state) if (state / "grant.json").exists() else None


def reuse(site: Installation, args: argparse.Namespace) -> Grant:
    site.verify_binding()
    grant = site.grant
    saved = {
        "repository": grant.repository,
        "host": grant.host,
        "checkout": Path(grant.checkout),
        "profile_dir": Path(grant.profile_dir)
        if grant.profile_dir is not None
        else None,
        "issue": grant.issue_scope,
        "state": site.root,
    }
    for name, expected in saved.items():
        supplied = getattr(args, name)
        if isinstance(supplied, Path):
            supplied = supplied.resolve()
        comparable = expected.resolve() if isinstance(expected, Path) else expected
        if supplied is not None and supplied != comparable:
            raise ValueError(
                f"Repository installation already exists with different --{name.replace('_', '-')}; saved configuration is unchanged"
            )
        setattr(args, name, expected)
    return grant


def guided_path(requested: bool) -> list[Path]:
    if requested:
        files = shell_path.prepare(True)
        if files:
            print("PATH setup will update: " + ", ".join(str(path) for path in files))
        return files
    if shell_path.present():
        return []
    if not shell_path.supported():
        print(
            "Automatic PATH setup supports macOS zsh and Bash; manual shell setup is required."
        )
        return []
    print(
        "PATH setup would update: "
        + ", ".join(str(path) for path in shell_path.destinations())
    )
    accepted = prompt("Add ~/.local/bin to your shell PATH? (y/N)").lower() == "y"
    return shell_path.prepare(accepted)
