"""One worker process supervises one native recipe session, never engineering phases."""

import signal
import subprocess
import sys
import time
from pathlib import Path
from types import FrameType

from . import claude, codex, native
from .github import GitHub, number_value
from .installation import Installation
from .models import Claim, Outcome
from .reconciliation import report_stopped, verified_pr
from .setup import git_output
from .storage import locked


def worktree(site: Installation, claim: Claim) -> None:
    if Path(claim.worktree).is_dir():
        return
    if claim.native is not None:
        raise ValueError(
            "Original worktree unavailable; native recovery cannot create replacement work"
        )
    grant = site.grant
    remote = git_output(
        grant.git, Path(grant.checkout), "ls-remote", "--symref", "origin", "HEAD"
    )
    names = [
        name for name in ("main", "master") if f"ref: refs/heads/{name}\tHEAD" in remote
    ]
    if len(names) != 1:
        raise ValueError(
            "Origin default branch must resolve unambiguously to main or master"
        )
    base = names[0]
    git_output(
        grant.git,
        Path(grant.checkout),
        "fetch",
        "origin",
        f"+refs/heads/{base}:refs/remotes/origin/{base}",
    )
    claim.base_branch = base
    claim.base_commit = git_output(
        grant.git, Path(grant.checkout), "rev-parse", f"refs/remotes/origin/{base}"
    )
    site.save(claim)
    subprocess.run(
        [
            grant.git,
            "-C",
            grant.checkout,
            "worktree",
            "add",
            "-b",
            claim.branch,
            claim.worktree,
            claim.base_commit,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def run(site: Installation, delivery: str) -> None:
    with locked(site.lock):
        site.verify_binding()
        claim = site.claim(delivery)
        if not site.grant.enabled or claim.status != "running":
            return
    try:
        worktree(site, claim)
        outcome = supervise(site, claim)
        if outcome.status == "pr-open":
            claim.pr = outcome.pr
            forge = GitHub(site.grant.gh, site.grant.repository)
            observed = verified_pr(claim, forge)
            if observed.get("state") != "open":
                raise ValueError("Delivery completion requires an open reviewable PR")
            forge.mark_owned(number_value(observed["number"]))
    except Exception as error:
        # Native process boundary: preserve uncertain effects, never substitute an owner.
        outcome = Outcome(
            status="needs-attention", detail=str(error), question=None, pr=None
        )
    finish(site, claim, outcome)


def supervise(site: Installation, claim: Claim) -> Outcome:
    execute = claude.execute if site.grant.host == "claude" else codex.execute
    while True:
        try:
            return execute(site, claim)
        except (native.InterruptionError, TimeoutError, BrokenPipeError):
            reserve_recovery(site, claim)
            time.sleep(claim.recovery_attempts)


def reserve_recovery(site: Installation, claim: Claim) -> None:
    with locked(site.lock):
        if claim.native is None or claim.recovery_attempts >= 2:
            raise ValueError(
                "Native recovery unavailable or two attempts exhausted"
            ) from None
        if not site.grant.enabled or site.claim(claim.id).status == "cancelled":
            raise ValueError("Recovery cancelled or revoked")
        claim.recovery_attempts += 1
        claim.total_recovery_attempts += 1
        site.save(claim)


def finish(site: Installation, claim: Claim, outcome: Outcome) -> None:
    with locked(site.lock):
        retained = site.claim(claim.id)
        if retained.status == "cancelled":
            return
        claim.process = retained.process
        claim.execution_ended = True
        claim.status = "pr-open" if outcome.status == "pr-open" else "needs-attention"
        claim.resume_allowed = (
            retained.resume_allowed is not False and outcome.status != "pr-open"
        )
        claim.detail = outcome.detail
        if outcome.pr is not None:
            claim.pr = outcome.pr
        if claim.status != "pr-open":
            detail = outcome.detail
            if outcome.question:
                detail += "\n\n" + outcome.question
            claim.needs_attention(detail)
            report_stopped(site, GitHub(site.grant.gh, site.grant.repository), claim)
        site.save(claim)


def terminated(signum: int, frame: FrameType | None) -> None:
    raise InterruptedError(
        "Delivery interrupted; reconcile existing execution and effects"
    )


def main() -> None:
    signal.signal(signal.SIGTERM, terminated)
    run(Installation(Path(sys.argv[1])), sys.argv[2])


if __name__ == "__main__":
    main()
