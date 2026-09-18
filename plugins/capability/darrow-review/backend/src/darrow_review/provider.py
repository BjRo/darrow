"""Observe native provider and transcript evidence without invoking a reviewer."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .common import ReviewError, new_record, read_text, require, serialize

SELECTORS = (
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_MANTLE",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_USE_ANTHROPIC_AWS",
)


def direct() -> str:
    for selector in SELECTORS:
        require(
            not os.environ.get(selector),
            f"Claude provider is not observably direct Anthropic: {selector} is set",
        )
    require(
        os.environ.get("ANTHROPIC_BASE_URL", "")
        in ("", "https://api.anthropic.com", "https://api.anthropic.com/"),
        "Claude provider is not observably direct Anthropic: ANTHROPIC_BASE_URL is custom",
    )
    return "provider\tclaude\tanthropic\nprovider_evidence\tcurrent-host-environment-default\n"


def object_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        require(key not in result, f"duplicate JSON field: {key}")
        result[key] = value
    return result


def invalid_constant(value: str) -> object:
    raise ReviewError(f"invalid JSON constant: {value}")


def json_object(text: str) -> dict[str, object]:
    try:
        value: object = json.loads(
            text, object_pairs_hook=object_pairs, parse_constant=invalid_constant
        )
    except (ValueError, RecursionError) as exc:
        raise ReviewError(f"invalid JSON: {exc}") from exc
    require(isinstance(value, dict), "JSON root must be an object")
    assert isinstance(value, dict)
    return {str(key): item for key, item in value.items()}


def assistant_observation(
    row: dict[str, object], agent: str, line: int
) -> tuple[str, str]:
    require(
        row.get("agentId") == agent,
        f"assistant record has unexpected agentId on line {line}",
    )
    message = row.get("message")
    require(isinstance(message, dict), f"assistant record lacks message on line {line}")
    assert isinstance(message, dict)
    require(
        message.get("role") == "assistant",
        f"assistant record has unexpected message.role on line {line}",
    )
    model, effort = message.get("model"), row.get("effort")
    require(
        isinstance(model, str) and isinstance(effort, str) and model and effort,
        f"assistant record lacks model or effort on line {line}",
    )
    return str(model), str(effort)


def observe_transcript(path: Path, agent: str) -> tuple[str, str]:
    observations = []
    for number, line in enumerate(read_text(path, "transcript").splitlines(), 1):
        row = json_object(line)
        if row.get("type") == "assistant":
            observations.append(assistant_observation(row, agent, number))
    require(observations, "no assistant observations")
    models = {model for model, _ in observations}
    efforts = {effort for _, effort in observations}
    require(
        len(models) == 1,
        f"expected exactly one model across {len(models)} observed value(s) for agent {agent}",
    )
    require(
        len(efforts) == 1,
        f"expected exactly one effort across {len(efforts)} observed value(s) for agent {agent}",
    )
    return models.pop(), efforts.pop()


def session_directory(repo: str, projects: str) -> Path:
    root = Path(repo).resolve(strict=True)
    require(root.is_dir(), f"unreadable repo: {repo}")
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
    projects_dir = Path(projects) if projects else config / "projects"
    require(projects_dir.is_dir(), f"no Claude projects directory: {projects_dir}")
    slug = str(root).replace("/", "-")
    if os.name == "nt":
        slug = re.sub(r"[^A-Za-z0-9]", "-", str(root))
    session = projects_dir.resolve() / slug
    require(session.is_dir(), f"no session transcripts for repo: {session}")
    return session


def verify(repo: str, agent: str, projects: str = "", record: str = "") -> str:
    direct()
    require(re.fullmatch("[A-Za-z0-9]+", agent), f"unsafe agent id: {agent}")
    session = session_directory(repo, projects)
    candidates = list(session.rglob(f"agent-{agent}.jsonl"))
    require(
        len(candidates) == 1,
        f"expected exactly one assistant transcript for agent {agent}; found {len(candidates)}",
    )
    transcript = candidates[0]
    model, effort = observe_transcript(transcript, agent)
    require(
        re.fullmatch("[A-Za-z0-9._-]+", model), f"unsafe reviewer model ID: {model}"
    )
    require(
        effort in ("low", "medium", "high", "xhigh", "max"),
        f"unsupported reviewer effort: {effort}",
    )
    body = serialize(
        [
            ["format", "darrow-review-claude-route-v1"],
            ["agent_id", agent],
            ["transcript", str(transcript)],
            ["provider_evidence", "current-host-environment-default"],
            ["observed_route", "claude", "anthropic", model, effort],
        ]
    )
    if not record:
        return body
    path = new_record(record, body)
    return serialize(
        [["format", "darrow-reviewer-record-location-v1"], ["record", str(path)]]
    )
