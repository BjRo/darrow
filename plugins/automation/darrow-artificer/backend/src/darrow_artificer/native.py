"""Native host launch configuration; profiles and persistence belong to the host."""

import os

from .installation import Installation
from .models import Claim, Grant
from .storage import locked


class InterruptionError(RuntimeError):
    """A positively identified transient host/transport failure."""


def check_error(error: dict[str, object]) -> None:
    kind = error.get("codexErrorInfo")
    if kind in ("internalServerError", "serverOverloaded", "rateLimitExceeded"):
        raise InterruptionError(str(error))


def environment() -> dict[str, str]:
    return {key: value for key, value in os.environ.items() if key != "CLAUDECODE"}


def command(grant: Grant) -> list[str]:
    return [grant.executable, "app-server", "--stdio"]


def require_capabilities(names: list[str]) -> None:
    available = {name.rsplit(":", 1)[-1] for name in names}
    missing = {
        "adaptive-goal",
        "verify-change",
        "code-review",
        "ticket-to-pr",
    } - available
    if missing:
        raise ValueError(
            "Missing required session capabilities: " + ", ".join(sorted(missing))
        )


def progress(site: Installation, claim: Claim) -> None:
    """A successfully completed native turn closes the transport incident."""
    if claim.recovery_attempts == 0:
        return
    with locked(site.lock):
        retained = site.claim(claim.id)
        retained.recovery_attempts = claim.recovery_attempts = 0
        site.save(retained)
