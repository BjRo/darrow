"""Narrow explicit setup, tick, status, cancellation and recovery commands."""

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path

from . import operations, scheduler, setup
from .installation import Installation
from .models import Grant
from .storage import locked


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="darrow-artificer")
    root.add_argument("--state", type=Path, required=True)
    commands = root.add_subparsers(dest="operation", required=True)
    init = commands.add_parser("init")
    init.add_argument("--repository", required=True)
    init.add_argument("--checkout", type=Path, required=True)
    init.add_argument("--plugin", action="append", required=True)
    init.add_argument("--credential-home", type=Path, default=Path.home() / ".codex")
    init.add_argument("--model", default="gpt-5.6-terra")
    init.add_argument("--effort", default="medium")
    init.add_argument("--issue", type=int, action="append", default=[])
    init.add_argument(
        "--authorize-recurring-delivery", action="store_true", required=True
    )
    init.add_argument(
        "--confirm-no-paid-credits-or-auto-reload", action="store_true", required=True
    )
    for name in ("tick", "status", "revoke", "schedule", "unschedule"):
        commands.add_parser(name)
    commands.add_parser("cancel").add_argument("delivery")
    recover = commands.add_parser("recover")
    recover.add_argument("delivery")
    recover.add_argument("--parent", required=True)
    recover.add_argument("--owner", required=True)
    configure = commands.add_parser("configure")
    for name in (
        "WORK_IN_PROGRESS_LIMIT",
        "MAX_STARTS_PER_ACTIVATION",
        "SESSION_RETENTION_DAYS",
        "SCHEDULE_SECONDS",
    ):
        configure.add_argument(f"--{name}", type=int)
    return root


def initialize(site: Installation, args: argparse.Namespace) -> object:
    grant = setup.initialize(
        site,
        args.checkout,
        args.repository,
        args.plugin,
        args.credential_home,
        args.model,
        args.effort,
        args.issue,
    )
    setup.labels(site)
    return grant.model_dump()


def configure(site: Installation, args: argparse.Namespace) -> object:
    with locked(site.lock):
        site.verify_binding()
        values = site.grant.model_dump()
        values.update(
            {
                key: value
                for key, value in vars(args).items()
                if key.isupper() and value is not None
            }
        )
        grant = Grant.model_validate(values)
        site.save_grant(grant)
        return grant.model_dump()


def dispatch(site: Installation, args: argparse.Namespace) -> object:
    handlers: dict[str, Callable[[], object]] = {
        "init": lambda: initialize(site, args),
        "configure": lambda: configure(site, args),
        "tick": lambda: {"admitted": operations.tick(site)},
        "status": lambda: {
            "repository": site.grant.repository,
            "enabled": site.grant.enabled,
            "deliveries": [claim.model_dump() for claim in site.claims()],
        },
        "cancel": lambda: operations.cancel(site, args.delivery).model_dump(),
        "revoke": lambda: operations.revoke(site),
        "recover": lambda: operations.recover(
            site, args.delivery, args.parent, args.owner
        ).model_dump(),
        "schedule": lambda: str(
            scheduler.install(site, Path(__file__).resolve().parents[2])
        ),
        "unschedule": lambda: scheduler.remove(site),
    }
    return handlers[args.operation]()


def entrypoint() -> None:
    args = parser().parse_args()
    try:
        result = dispatch(Installation(args.state), args)
        print(json.dumps(result, indent=2))
    except Exception as error:
        # CLI boundary: surface exact diagnostics; no fallback, implicit retry or mutation.
        print(f"Artificer needs attention: {error}", file=sys.stderr)
        raise SystemExit(1) from error
