"""Codex app-server adapter retaining one native main thread and its goal."""

import subprocess
from pathlib import Path
from uuid import uuid4

from . import native, prompts
from .installation import Installation
from .models import Claim, Native, Outcome
from .rpc import Rpc
from .session import Session
from .storage import locked


def execute(site: Installation, claim: Claim) -> Outcome:
    directory = site.delivery_dir(claim.id)
    attempt = str(uuid4())
    with (
        (directory / f"{attempt}-events.jsonl").open("wb") as events,
        (directory / "native.stderr").open("ab") as errors,
        subprocess.Popen(
            native.command(site.grant),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=errors,
            cwd=claim.worktree,
            env=native.environment(),
            bufsize=0,
        ) as process,
    ):
        try:
            session = Session(
                Rpc(process, events),
                site.grant,
                Path(claim.worktree),
                claim.goal_objective,
            )
            submit(site, claim, session)
            session.observed_progress = lambda: native.progress(site, claim)
            return session.wait()
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def submit(site: Installation, claim: Claim, session: Session) -> None:
    with locked(site.lock):
        if site.claim(claim.id).status == "cancelled" or not site.grant.enabled:
            raise ValueError("Delivery cancelled or revoked before native submission")

        def accepted(observed: Native) -> None:
            claim.native = observed
            site.save(claim)

        def goal(objective: str) -> None:
            with locked(site.lock):
                claim.goal_objective = objective
                site.save(claim)

        resuming = claim.native is not None
        session.start(claim.native, accepted)
        claim.goal_objective = session.objective
        site.save(claim)
        if not session.resuming_active:
            session.submit(
                prompts.recovery(claim) if resuming else prompts.initial(site, claim)
            )
        session.observed_goal = goal
