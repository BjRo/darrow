"""Persist only grants, admission correlation and native continuation pointers."""

import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Grant(Record):
    schema_version: Literal[2] = 2
    host: Literal["codex", "claude"] = "codex"
    id: str
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    checkout: str
    common_git: str
    grantor: str
    recipe: Literal["ticket-to-pr"] = "ticket-to-pr"
    enabled: bool = True
    issue_scope: list[int] = Field(default_factory=list)
    executable: str
    gh: str
    git: str
    effects: Literal["claims,reports,worktrees,recipe,commits,push,pr"]
    WORK_IN_PROGRESS_LIMIT: int = Field(default=1, ge=0)
    SCHEDULE_SECONDS: int = Field(default=900, ge=1)


class Process(Record):
    pid: int
    started: str


class Shared(Record):
    repository: str
    host: Literal["codex", "claude"]
    WORK_IN_PROGRESS_LIMIT: int = Field(default=1, ge=0)


class Native(Record):
    thread: str
    model: str
    effort: str


class Claim(Record):
    id: str
    issue: int = Field(gt=0)
    activation: str
    grant: str
    worktree: str
    branch: str
    base_branch: str | None = None
    base_commit: str | None = None
    status: Literal[
        "reserved",
        "running",
        "question",
        "pr-open",
        "needs-attention",
        "cancelled",
        "released",
    ] = "reserved"
    detail: str = ""
    process: Process | None = None
    execution_ended: bool = False
    recovery_attempts: int = Field(default=0, ge=0, le=2)
    total_recovery_attempts: int = Field(default=0, ge=0)
    native: Native | None = None
    goal_objective: str | None = None
    pr: int | None = None
    created_at: float
    attention_since: float | None = None
    report_state: Literal["none", "pending", "posted", "uncertain"] = "none"
    report_comment: int | None = None
    report_error: str = ""
    next_action: str = ""

    def needs_attention(self, detail: str) -> None:
        self.status = "needs-attention"
        self.detail = detail
        self.attention_since = time.time()


class Outcome(Record):
    status: Literal["question", "pr-open", "needs-attention", "goal-required"]
    detail: str
    question: str | None
    pr: int | None
    goal: str | None = Field(default=None, min_length=1, max_length=4000)
