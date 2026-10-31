"""Claude Code print/stream protocol using its existing profile and native resume."""

import json
import subprocess
from collections.abc import Callable
from uuid import uuid4

from .github import array_value, object_value, text_value
from .installation import Installation
from .models import Claim, Native, Outcome
from .native import InterruptionError, environment, progress, require_capabilities
from .prompts import initial, recovery
from .storage import locked


def execute(site: Installation, claim: Claim) -> Outcome:
    prompt = recovery(claim) if claim.native is not None else initial(site, claim)
    outcome = invoke(site, claim, prompt)
    require_completion_evidence(claim, outcome)
    if outcome.status != "goal-required":
        return outcome
    if outcome.goal is None or claim.goal_objective is not None:
        raise ValueError(
            "Native goal request is missing its prepared objective or would replace an existing goal"
        )
    with locked(site.lock):
        claim.goal_objective = outcome.goal
        site.save(claim)
    result = invoke(site, claim, "/goal " + outcome.goal)
    if result.status == "goal-required":
        raise ValueError(
            "Native goal activation was not established; reconcile the original session"
        )
    require_completion_evidence(claim, result)
    return result


def require_completion_evidence(claim: Claim, outcome: Outcome) -> None:
    if outcome.status != "pr-open":
        return
    if claim.goal_objective is None:
        raise ValueError("Claude PR completion requires the prepared /goal handoff")
    raise ValueError(
        "Claude delivery lacks independently observed native goal completion; "
        "the supported stream reports turn results, not goal completion. "
        "Inspect the original native session and published effects."
    )


def invoke(site: Installation, claim: Claim, prompt: str) -> Outcome:
    log = site.delivery_dir(claim.id) / "native.stderr"
    with log.open("ab") as errors:
        with locked(site.lock):
            if not site.grant.enabled or site.claim(claim.id).status == "cancelled":
                raise ValueError("Delivery cancelled or revoked before native launch")
            resuming = claim.native is not None
            if claim.native is None:
                claim.native = Native(
                    thread=str(uuid4()), model="profile", effort="profile"
                )
                site.save(claim)
            command = [
                site.grant.executable,
                "--print",
                "--verbose",
                "--output-format",
                "stream-json",
                "--resume" if resuming else "--session-id",
                claim.native.thread,
                "--json-schema",
                json.dumps(Outcome.model_json_schema()),
                "--permission-prompts",
                "none",
                prompt,
            ]
            process = subprocess.Popen(
                command,
                cwd=claim.worktree,
                stdout=subprocess.PIPE,
                stderr=errors,
                text=True,
                env=environment(),
            )
        with process:
            try:
                return observe(
                    process, claim.native.thread, lambda: progress(site, claim)
                )
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


def observe(
    process: subprocess.Popen[str],
    identity: str,
    progressed: Callable[[], None] = lambda: None,
) -> Outcome:
    if process.stdout is None:
        raise ValueError("Claude stream unavailable")
    observer = Observer(identity, progressed)
    for line in process.stdout:
        outcome = observer.event(object_value(json.loads(line)))
        if outcome is not None:
            return outcome
    if observer.initialized:
        raise InterruptionError("Claude stream ended before a terminal result")
    raise RuntimeError("Claude session initialization unavailable")


class Observer:
    def __init__(self, identity: str, progressed: Callable[[], None]) -> None:
        self.identity, self.progressed = identity, progressed
        self.initialized = False

    def event(self, event: dict[str, object]) -> Outcome | None:
        self.validate(event)
        if event.get("type") == "system" and event.get("subtype") == "init":
            require_capabilities(
                [text_value(name) for name in array_value(event["slash_commands"])]
            )
            self.initialized = True
        if event.get("type") == "result":
            return self.result(event)
        return None

    def validate(self, event: dict[str, object]) -> None:
        if event.get("session_id", self.identity) != self.identity:
            raise ValueError("Claude resumed a different native session")
        if event.get("error") in {"server_error", "rate_limit"}:
            raise InterruptionError(
                f"Claude temporary execution failure: {event['error']}"
            )

    def result(self, event: dict[str, object]) -> Outcome:
        if not self.initialized:
            raise ValueError("Claude result lacks original native initialization")
        if event.get("is_error"):
            raise RuntimeError(f"Claude execution interrupted: {event}")
        outcome = Outcome.model_validate(event.get("structured_output"))
        if event.get("subtype") == "success" and event.get("is_error") is False:
            self.progressed()
        return outcome
