"""Collect setup intent without waiting on input in scripted execution."""

import argparse
import sys
from pathlib import Path

from .installation import Installation
from .launcher import installation_state, repository_at
from .setup import executable, git_output


def prompt(label: str, default: str = "") -> str:
    return input(f"{label} [{default}]: ").strip() or default


def saved_host(repository: str | None) -> str | None:
    if repository is None:
        return None
    state = installation_state(repository)
    return Installation(state).grant.host if (state / "grant.json").exists() else None


def prepare(args: argparse.Namespace) -> None:
    if sys.stdin.isatty():
        guided(args)
    else:
        args.host = args.host or saved_host(args.repository)
    missing = [
        f"--{name}"
        for name in ("repository", "checkout", "host")
        if not getattr(args, name)
    ]
    if missing:
        raise ValueError("Missing initialization flags: " + ", ".join(missing))
    if args.host not in {"codex", "claude"}:
        raise ValueError("Host must be codex or claude")


def guided(args: argparse.Namespace) -> None:
    if args.checkout is None:
        checkout = git_output(
            executable("git"), Path.cwd(), "rev-parse", "--show-toplevel"
        )
        args.checkout = Path(prompt("Checkout", checkout))
    if args.repository is None:
        args.repository = prompt("Repository", repository_at(args.checkout))
    if args.host is None:
        args.host = prompt("Host (codex/claude)", saved_host(args.repository) or "")
    profile = args.profile_dir or Path.home() / f".{args.host}"
    state = args.state or installation_state(args.repository)
    print(
        f"Repository: {args.repository}\nHost: {args.host}\nProfile: {profile}\nWorkers: 1\nWIP: 1\nState: {state}"
    )
    if prompt("Authorize unattended delivery and save? (y/N)").lower() != "y":
        raise ValueError("Initialization cancelled; no configuration saved")
