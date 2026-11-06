"""Decide whether this session may coordinate a review inline."""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping
from pathlib import Path

from .common import require, serialize
from .routing import running_host

FLOORS = {"codex": "gpt-6.1-sol", "claude": "claude-sonnet-5-5"}
EFFORTS = ("medium", "high", "xhigh", "max")


def transcript_records(path: Path) -> Iterator[dict[str, object] | None]:
    """Yield transcript objects; unreadable or malformed input yields None."""
    try:
        with path.open(encoding="utf-8") as lines:
            for line in lines:
                try:
                    value = json.loads(line)
                except ValueError:
                    yield None
                    continue
                if isinstance(value, dict):
                    yield value
    except (OSError, UnicodeError):
        yield None


def only_match(root: Path, pattern: str) -> Path | None:
    try:
        matches = sorted(root.glob(pattern)) if root.is_dir() else []
    except OSError:
        return None
    return matches[0] if len(matches) == 1 else None


def directory(env: Mapping[str, str], variable: str, default: str) -> Path:
    return Path(env[variable]) if env.get(variable) else Path.home() / default


def text(value: object, name: str) -> str:
    field = value.get(name) if isinstance(value, dict) else None
    return field if isinstance(field, str) else ""


def codex_route(env: Mapping[str, str]) -> tuple[str, str]:
    thread = env.get("CODEX_THREAD_ID", "")
    root = directory(env, "CODEX_HOME", ".codex") / "sessions"
    path = only_match(root, f"**/rollout-*-{thread}.jsonl") if thread else None
    route = ("", "")
    for item in transcript_records(path) if path else ():
        if item is None:
            route = ("", "")
        elif item.get("type") == "turn_context":
            payload = item.get("payload")
            route = (text(payload, "model"), text(payload, "effort"))
    return route


def claude_route(env: Mapping[str, str]) -> tuple[str, str]:
    session = env.get("CLAUDE_CODE_SESSION_ID", "")
    root = directory(env, "CLAUDE_CONFIG_DIR", ".claude") / "projects"
    path = only_match(root, f"*/{session}.jsonl") if session else None
    model = ""
    for item in transcript_records(path) if path else ():
        if item is None:
            model = ""
        elif item.get("type") == "assistant":
            model = text(item.get("message"), "model")
    return model, env.get("CLAUDE_EFFORT", "")


def basis(host: str, route: tuple[str, str], pinned_fallback_agent: bool) -> str:
    if pinned_fallback_agent:
        return "pinned-fallback-agent"
    if not all(route):
        return "unobserved"
    supported = route[0] == FLOORS[host] and route[1] in EFFORTS
    return "observed-supported-route" if supported else "observed-below-floor"


def place(host: str, pinned_fallback_agent: bool, env: Mapping[str, str]) -> str:
    require(host in FLOORS, f"unsupported host: {host}")
    require(
        not pinned_fallback_agent or host == "claude",
        "--pinned-fallback-agent is Claude-only; Codex observes its own route",
    )
    running = running_host()
    require(
        not running or running == host,
        f"--host {host} contradicts the running {running} host; use --host {running}",
    )
    route = (codex_route if host == "codex" else claude_route)(env)
    reason = basis(host, route, pinned_fallback_agent)
    inline = reason in ("pinned-fallback-agent", "observed-supported-route")
    return serialize(
        {
            "format": "darrow-review-placement-v1",
            "host": host,
            "observed_route": (
                {"model": route[0], "effort": route[1]} if all(route) else None
            ),
            "basis": reason,
            "placement": "inline" if inline else "fallback",
        }
    )
