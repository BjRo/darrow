"""Persist only grants, admission correlation and native continuation pointers."""

import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Grant(Record):
    id: str
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    checkout: str
    common_git: str
    grantor: str
    recipe: str = "ticket-to-pr"
    enabled: bool = True
    issue_scope: list[int] = Field(default_factory=list)
    codex: str
    gh: str
    git: str
    model: str
    effort: str
    credential_home: str
    plugins: list[str] = Field(default_factory=list)
    subscription_only_confirmed: bool
    effects: Literal["claims,questions,worktrees,recipe,commits,push,pr,archives"]
    WORK_IN_PROGRESS_LIMIT: int = Field(default=1, ge=0)
    MAX_STARTS_PER_ACTIVATION: int = Field(default=1, ge=1)
    SESSION_RETENTION_DAYS: int = Field(default=5, ge=1)
    SCHEDULE_SECONDS: int = Field(default=900, ge=1)


class Process(Record):
    pid: int
    started: str


class Native(Record):
    parent: str
    owner: str
    owner_thread: str
    model: str
    effort: str
    owner_model: str
    owner_effort: str


class Claim(Record):
    id: str
    issue: int = Field(gt=0)
    activation: str
    grant: str
    worktree: str
    branch: str
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
    native: Native | None = None
    question: str | None = None
    question_text: str | None = None
    question_comment: int | None = None
    consumed_comments: list[int] = Field(default_factory=list)
    pending_answer: str | None = None
    pr: int | None = None
    saved_at: float | None = None
    created_at: float
    attention_since: float | None = None

    def needs_attention(self, detail: str) -> None:
        self.status = "needs-attention"
        self.detail = detail
        self.attention_since = time.time()


class Outcome(Record):
    status: Literal["question", "pr-open", "needs-attention"]
    detail: str
    question: str | None
    pr: int | None
    owner: str | None
