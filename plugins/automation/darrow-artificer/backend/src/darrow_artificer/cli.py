"""Narrow explicit setup, tick, status, cancellation and recovery commands."""

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path

from . import intake, operations, plugins, scheduler, setup, shell_path
from .installation import Installation
from .launcher import default_state, installation_state, refuse_legacy, repository_at
from .models import Grant
from .storage import locked, write_object


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="darrow-artificer")
    root.add_argument("--state", type=Path)
    commands = root.add_subparsers(dest="operation", required=True)
    init = commands.add_parser("init")
    init.add_argument("--repository")
    init.add_argument("--checkout", type=Path)
    init.add_argument("--host", choices=("codex", "claude"))
    init.add_argument("--issue", type=int, action="append")
    init.add_argument("--profile-dir", type=Path)
    init.add_argument("--setup-path", action="store_true")
    for name in ("tick", "status", "revoke", "schedule", "unschedule"):
        commands.add_parser(name)
    commands.add_parser("cancel").add_argument("delivery")
    recover = commands.add_parser("recover")
    recover.add_argument("delivery")
    recover.add_argument("--thread", required=True)
    configure = commands.add_parser("configure")
    configure.add_argument("--workers", type=int)
    for name in (
        "WORK_IN_PROGRESS_LIMIT",
        "SCHEDULE_SECONDS",
    ):
        configure.add_argument(f"--{name}", type=int)
    return root


def initialize(site: Installation, args: argparse.Namespace) -> object:
    files = args.path_files
    directory = default_state(args.repository)
    with locked(directory / "init.lock"):
        if (installation_state(args.repository) / "grant.json").exists():
            grant = intake.reuse(
                Installation(installation_state(args.repository)), args
            )
        else:
            grant = create_installation(site, args, directory)
    setup.install_command(warn=not files)
    shell_path.apply(files)
    return grant.model_dump()


def create_installation(
    site: Installation, args: argparse.Namespace, directory: Path
) -> Grant:
    grant = setup.initialize(
        site,
        args.checkout,
        args.repository,
        args.issue or [],
        args.host,
        args.profile_dir,
    )
    write_object(directory / "location.json", {"state": str(site.root)})
    setup.labels(site)
    return grant


def configure(site: Installation, args: argparse.Namespace) -> object:
    with locked(site.lock):
        site.verify_binding()
        values = site.grant.model_dump()
        values.update(
            {
                key: value
                for key, value in vars(args).items()
                if (key.isupper() or key == "workers") and value is not None
            }
        )
        grant = Grant.model_validate(values)
        site.configure_capacity(grant.WORK_IN_PROGRESS_LIMIT)
        site.save_grant(grant)
        return grant.model_dump()


def dispatch(site: Installation, args: argparse.Namespace) -> object:
    handlers: dict[str, Callable[[], object]] = {
        "init": lambda: initialize(site, args),
        "configure": lambda: configure(site, args),
        "tick": lambda: {"admitted": operations.tick(site)},
        "status": lambda: {
            "worker": site.grant.id,
            "workers": site.grant.workers,
            "state": str(site.root),
            "repository": site.grant.repository,
            "enabled": site.grant.enabled,
            "host": site.grant.host,
            "profile_dir": site.grant.profile_dir,
            "WORK_IN_PROGRESS_LIMIT": site.grant.WORK_IN_PROGRESS_LIMIT,
            "blocker": plugins.blocker(site),
            "deliveries": [claim.model_dump() for claim in site.claims()],
        },
        "cancel": lambda: operations.cancel(site, args.delivery).model_dump(),
        "revoke": lambda: operations.revoke(site),
        "recover": lambda: operations.recover(
            site, args.delivery, args.thread
        ).model_dump(),
        "schedule": lambda: str(scheduler.install(site)),
        "unschedule": lambda: scheduler.remove(site),
    }
    return handlers[args.operation]()


def entrypoint() -> None:
    args = parser().parse_args()
    try:
        refuse_legacy(Path.cwd())
        if args.operation == "init":
            intake.prepare(args)
            refuse_legacy(args.checkout)
        repository = (
            args.repository
            if args.operation == "init"
            else repository_at(Path.cwd())
            if args.state is None
            else ""
        )
        state = args.state or installation_state(repository)
        if args.operation != "init" and not (state / "grant.json").is_file():
            raise ValueError(
                "Installation is not initialized; run darrow-artificer init"
            )
        site = Installation(state)
        if args.operation != "init":
            refuse_legacy(Path(site.grant.checkout))
        result = dispatch(site, args)
        print(json.dumps(result, indent=2))
    except Exception as error:
        # CLI boundary: surface exact diagnostics; no fallback, implicit retry or mutation.
        print(f"Artificer needs attention: {error}", file=sys.stderr)
        raise SystemExit(1) from error
