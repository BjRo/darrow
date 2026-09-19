"""One local process waits on one Codex invocation; no engineering phase loop."""

import signal
import subprocess
import sys
import time
from pathlib import Path
from types import FrameType
from uuid import uuid4

from . import account, archive, native, prompts
from .github import GitHub
from .installation import Installation
from .models import Claim, Outcome
from .reconciliation import verified_pr
from .storage import locked, write_bytes


def home_for(site: Installation, claim: Claim) -> Path:
    home = site.delivery_dir(claim.id) / "native"
    if claim.native is None:
        if home.exists():
            raise ValueError("Ambiguous existing native state; refusing a new owner")
        native.prepare_home(home, site.grant)
    if not home.is_dir():
        raise ValueError(
            "Native continuation state unavailable; human restoration required"
        )
    verify_retained_home(site, claim, home)
    return home


def verify_retained_home(site: Installation, claim: Claim, home: Path) -> None:
    if claim.native is None:
        return
    observed = native.correlate(
        home, claim.native.parent, claim.native.owner, site.grant
    )
    if observed != claim.native:
        raise ValueError(
            "Original native owner or route no longer matches the reservation"
        )


def worktree(site: Installation, claim: Claim) -> None:
    if claim.native is not None:
        if not Path(claim.worktree).is_dir():
            raise ValueError("Original worktree is unavailable")
        return
    subprocess.run(
        [
            site.grant.git,
            "-C",
            site.grant.checkout,
            "worktree",
            "add",
            "-b",
            claim.branch,
            claim.worktree,
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def execute(site: Installation, claim: Claim, home: Path) -> tuple[Path, Path]:
    directory = site.delivery_dir(claim.id)
    attempt = str(uuid4())
    output = directory / f"{attempt}-result.json"
    events = directory / f"{attempt}-events.jsonl"
    prompt = (
        prompts.continuation(claim) if claim.native else prompts.initial(site, claim)
    )
    parent = claim.native.parent if claim.native else None
    with events.open("wb") as stream:
        result = subprocess.run(
            native.command(site.grant, home, output, parent),
            input=prompt.encode(),
            stdout=stream,
            stderr=subprocess.PIPE,
            cwd=claim.worktree,
            env=native.environment(home),
            check=False,
        )
    write_bytes(directory / f"{attempt}-stderr", result.stderr)
    if result.returncode:
        raise RuntimeError(
            f"Codex exited {result.returncode}; access or execution needs attention"
        )
    return events, output


def apply_outcome(
    site: Installation, claim: Claim, home: Path, events: Path, output: Path
) -> None:
    outcome = Outcome.model_validate_json(output.read_bytes())
    if outcome.status == "pr-open" and not outcome.owner:
        raise ValueError("PR completion requires the original engineering owner")
    parent = native.thread_id(events)
    observed = native.correlate(home, parent, outcome.owner or "", site.grant)
    if claim.native is not None and not native.preserves(claim.native, observed):
        raise ValueError("Original parent/owner identity or model/effort changed")
    claim.native = observed
    site.save(claim)
    claim.pending_answer = None
    claim.question = claim.question_text = None
    claim.question_comment = None
    claim.status, claim.detail, claim.pr = outcome.status, outcome.detail, outcome.pr
    if outcome.status == "question":
        question(site, claim, outcome)
    if outcome.status == "pr-open":
        verified_pr(claim, GitHub(site.grant.gh, site.grant.repository))


def question(site: Installation, claim: Claim, outcome: Outcome) -> None:
    if not outcome.question or not outcome.question.strip():
        raise ValueError("Native owner returned an empty question")
    claim.question, claim.question_text = str(uuid4()), outcome.question
    claim.question_comment = None
    site.save(claim)
    forge = GitHub(site.grant.gh, site.grant.repository)
    claim.question_comment = forge.comment(
        claim.issue,
        f"Artificer delivery `{claim.id}`, question `{claim.question}`\n\n"
        f"{outcome.question}\n\nReply with:\n\n"
        f"```text\n/artificer reply {claim.id} {claim.question}\nYour complete answer\n```\n"
        "Only repository writers may resume this original delivery.",
    )


def save_native(site: Installation, claim: Claim, home: Path) -> None:
    key = (site.root / "archive.key").read_bytes()
    archive.save(home, site.delivery_dir(claim.id) / "session.enc", key)
    claim.saved_at = time.time()


def finish(
    site: Installation,
    delivery: str,
    home: Path,
    result: tuple[Path, Path] | None,
    error: str | None,
) -> None:
    with locked(site.lock):
        claim = site.claim(delivery)
        if claim.status != "cancelled":
            claim.needs_attention(error or "Unresolved native result")
            if result is not None:
                reconcile_result(site, claim, home, result)
        site.save(claim)
        save_native(site, claim, home)
        site.save(claim)


def reconcile_result(
    site: Installation, claim: Claim, home: Path, result: tuple[Path, Path]
) -> None:
    try:
        apply_outcome(site, claim, home, *result)
    except Exception as failure:
        # An uncertain result or comment must not prevent preserving native state.
        claim.needs_attention(f"Native result needs reconciliation: {failure}")


def run(site: Installation, delivery: str) -> None:
    result, error = None, None
    home = site.delivery_dir(delivery) / "native"
    try:
        with locked(site.lock):
            site.verify_binding()
            claim = site.claim(delivery)
            if not site.grant.enabled or claim.status != "running":
                return
            home = home_for(site, claim)
            native.check_login(site.grant, home)
            account.check(site.grant, home)
            worktree(site, claim)
        result = execute(site, claim, home)
    except Exception as failure:
        # Process boundary: no exception can authorize a new owner or automatic retry.
        error = str(failure)
    finally:
        finish_safely(site, delivery, home, result, error)


def finish_safely(
    site: Installation,
    delivery: str,
    home: Path,
    result: tuple[Path, Path] | None,
    error: str | None,
) -> None:
    try:
        finish(site, delivery, home, result, error)
    except Exception as failure:
        with locked(site.lock):
            claim = site.claim(delivery)
            if claim.status != "cancelled":
                claim.needs_attention(
                    f"Native result/archive needs reconciliation: {failure}"
                )
            claim.detail = f"Native result/archive needs reconciliation: {failure}"
            site.save(claim)


def terminated(signum: int, frame: FrameType | None) -> None:
    raise InterruptedError("Delivery interrupted; claim retained")


def main() -> None:
    signal.signal(signal.SIGTERM, terminated)
    run(Installation(Path(sys.argv[1])), sys.argv[2])


if __name__ == "__main__":
    main()
