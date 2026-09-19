"""Phase records and the historical dependency graph."""

from collections.abc import Callable
from dataclasses import dataclass, field

PHASES = ("refine", "challenge", "implement", "review", "rework", "qa", "codify")
LIMITS = dict(zip(PHASES, (3, 3, 1, 2, 2, 2, 1), strict=True))
STATUSES = {
    "refine": {"complete", "needs_human", "blocked"},
    "challenge": {"approved", "needs_revision", "needs_human", "blocked"},
    "implement": {"complete", "failed", "needs_human", "blocked"},
    "review": {"approved", "changes_requested", "needs_human", "blocked"},
    "rework": {"complete", "failed", "needs_human", "blocked"},
    "qa": {"passed", "failed", "needs_human", "blocked"},
    "codify": {"complete", "no_change", "needs_human", "blocked"},
}
OUTCOMES = {"verified", "needs_human", "blocked", "failed", "budget_exhausted"}
PREFIX = "## Ticket Pipeline "
TICKET_FORMAT = "darrow-ticket-pipeline-ticket-v1"
ARTIFACT_FORMAT = "darrow-ticket-pipeline-phase-v1"
HEADERS = ("format", "run_id", "phase", "iteration", "agent", "status", "summary")


class PipelineError(Exception):
    """A public refusal with its stable process exit code."""

    def __init__(self, message: str, code: int = 4) -> None:
        super().__init__(message)
        self.code = code


def require(condition: bool, message: str, code: int = 4) -> None:
    if not condition:
        raise PipelineError(message, code)


@dataclass(frozen=True)
class PhaseState:
    status: str = "pending"
    iteration: int = 0


@dataclass(frozen=True)
class Attempt:
    phase: str
    iteration: int
    agent: str
    harness: str
    model: str
    effort: str
    status: str = "launched"
    summary: str = "child launch persisted"

    @property
    def key(self) -> tuple[str, int]:
        return self.phase, self.iteration

    def row(self) -> str:
        values = (
            self.phase,
            str(self.iteration),
            self.agent,
            self.harness,
            self.model,
            self.effort,
            self.status,
            self.summary,
        )
        return "| " + " | ".join(values) + " |"


@dataclass
class History:
    states: dict[str, PhaseState] = field(
        default_factory=lambda: dict.fromkeys(PHASES, PhaseState())
    )
    attempts: list[Attempt] = field(default_factory=list)

    def status(self, phase: str) -> str:
        return self.states[phase].status

    def iteration(self, phase: str) -> int:
        return self.states[phase].iteration

    def repaired(self) -> bool:
        return (
            bool(self.attempts)
            and self.attempts[-1].phase == "rework"
            and self.status("rework") == "complete"
        )

    def advance(self, attempt: Attempt) -> None:
        status = "in_progress" if attempt.status == "launched" else attempt.status
        self.states[attempt.phase] = PhaseState(status, attempt.iteration)
        self.attempts.append(attempt)

    def dependency(self, phase: str, iteration: int) -> bool:
        rules: dict[str, Callable[[], bool]] = {
            "refine": lambda: (
                iteration == 1
                or (
                    self.status("challenge") == "needs_revision"
                    and self.iteration("challenge") == iteration - 1
                )
            ),
            "challenge": lambda: (
                self.status("refine") == "complete"
                and self.iteration("refine") == iteration
            ),
            "implement": lambda: (
                iteration == 1 and self.status("challenge") == "approved"
            ),
            "review": lambda: self.review_ready(iteration),
            "rework": self.rework_ready,
            "qa": lambda: self.qa_ready(iteration),
            "codify": lambda: (
                iteration == 1
                and self.status("review") == "approved"
                and self.status("qa") == "passed"
            ),
        }
        return iteration == self.iteration(phase) + 1 and rules[phase]()

    def review_ready(self, iteration: int) -> bool:
        if iteration == 1:
            return self.status("implement") == "complete"
        return (
            iteration == 2
            and self.status("review") == "changes_requested"
            and self.repaired()
        )

    def qa_ready(self, iteration: int) -> bool:
        if iteration == 1:
            return self.status("review") == "approved"
        return iteration == 2 and self.status("qa") == "failed" and self.repaired()

    def rework_ready(self) -> bool:
        if self.status("qa") == "failed":
            return self.iteration("qa") < 2
        return (
            self.status("review") == "changes_requested"
            and self.iteration("review") < 2
        )

    def terminal(self, *, launching: bool = False) -> bool:
        stopped = {"in_progress", "needs_human", "blocked", "failed"}
        if launching:
            stopped.remove("in_progress")
        return any(
            s.status in stopped
            for p, s in self.states.items()
            if not (launching and p == "qa" and s.status == "failed")
        )

    def next_phase(self) -> str:
        if self.terminal():
            return "finish"
        if (
            self.status("challenge") == "needs_revision"
            and self.iteration("challenge") >= 3
        ):
            return "finish"
        return self.next_pending()

    def next_pending(self) -> str:
        # Preserve the historical precedence: needs_revision still selects refine
        # after the new refinement, until an explicit challenge is recorded.
        rules = (
            (
                self.status("refine") == "pending"
                or self.status("challenge") == "needs_revision",
                "refine",
            ),
            (
                self.status("challenge") == "pending"
                or self.iteration("refine") > self.iteration("challenge"),
                "challenge",
            ),
            (self.status("implement") == "pending", "implement"),
            (self.status("review") == "pending", "review"),
            (self.status("review") == "changes_requested", self.review_next()),
            (self.status("qa") == "pending", "qa"),
            (self.status("codify") == "pending", "codify"),
        )
        return next((phase for selected, phase in rules if selected), "complete")

    def review_next(self) -> str:
        if self.iteration("review") >= 2:
            return "finish"
        return "review" if self.repaired() else "rework"

    def converged(self) -> bool:
        expected = {
            "challenge": {"approved"},
            "implement": {"complete"},
            "review": {"approved"},
            "qa": {"passed"},
            "codify": {"complete", "no_change"},
        }
        return all(
            self.status(p) in statuses for p, statuses in expected.items()
        ) and not any(a.status == "launched" for a in self.attempts)
