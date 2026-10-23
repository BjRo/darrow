"""Prepare one native Codex Verification call; never launch or assess work."""

from __future__ import annotations

import json
import re
from pathlib import Path

from .arguments import options, require
from .common import RefusalError


def parse(args: list[str]) -> dict[str, str]:
    values = options(args, {"--task-name", "--assignment-file"}, "verification input ")
    require(
        values,
        {"task-name", "assignment-file"},
        "task name and assignment file are required",
    )
    if len(args) != 2 * len(values):
        raise RefusalError("verification input options must not repeat")
    if not re.fullmatch(r"[a-z0-9_]+", values["task-name"]):
        raise RefusalError(
            "task name must contain only lowercase letters, digits and underscores"
        )
    return values


def assignment(value: str) -> str:
    path = Path(value)
    if not path.is_absolute():
        raise RefusalError("verification assignment file must be absolute")
    text = path.read_bytes().decode("utf-8")
    if not text.strip():
        raise RefusalError("verification assignment must not be empty")
    return text


def run(args: list[str]) -> str:
    values = parse(args)
    return (
        json.dumps(
            {
                "task_name": values["task-name"],
                "model": "gpt-6.1-sol",
                "reasoning_effort": "medium",
                "fork_turns": "none",
                "message": assignment(values["assignment-file"]),
            },
            ensure_ascii=False,
        )
        + "\n"
    )
