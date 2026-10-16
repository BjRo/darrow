"""Compare the selected implementation route with the main thread's route."""

from __future__ import annotations

import json
from collections.abc import Iterator, Mapping
from pathlib import Path

from .common import record
from .routes import EFFORT_ORDER, EFFORTS, SAFE_VALUE, Route

RouteTuple = tuple[str, str, str, str]
PROVIDERS = {"codex": "openai", "claude": "anthropic"}
PROFILE_ORDER = ("routine", "routine-plus", "scaled", "repo-wide", "judgment")


def json_records(path: Path) -> Iterator[dict[str, object]]:
    """Yield JSON objects from a host session file, skipping foreign lines."""
    try:
        with path.open(encoding="utf-8") as lines:
            for line in lines:
                try:
                    value = json.loads(line)
                except ValueError:
                    continue
                if isinstance(value, dict):
                    yield value
    except (OSError, UnicodeError):
        return


def session_file(root: Path, pattern: str) -> Path | None:
    try:
        matches = sorted(root.glob(pattern)) if root.is_dir() else []
    except OSError:
        return None
    return matches[0] if len(matches) == 1 else None


def home(env: Mapping[str, str], variable: str, default: str) -> Path:
    return Path(env[variable]) if env.get(variable) else Path.home() / default


def codex_route(env: Mapping[str, str]) -> tuple[str, str]:
    thread = env.get("CODEX_THREAD_ID", "")
    root = home(env, "CODEX_HOME", ".codex") / "sessions"
    path = session_file(root, f"**/rollout-*-{thread}.jsonl") if thread else None
    route = ("", "")
    for item in json_records(path) if path else ():
        payload = item.get("payload")
        if item.get("type") == "turn_context" and isinstance(payload, dict):
            route = (str(payload.get("model", "")), str(payload.get("effort", "")))
    return route


def claude_route(env: Mapping[str, str]) -> tuple[str, str]:
    session = env.get("CLAUDE_CODE_SESSION_ID", "")
    root = home(env, "CLAUDE_CONFIG_DIR", ".claude") / "projects"
    path = session_file(root, f"*/{session}.jsonl") if session else None
    model = ""
    for item in json_records(path) if path else ():
        message = item.get("message")
        if item.get("type") == "assistant" and isinstance(message, dict):
            model = str(message.get("model", ""))
    return model, env.get("CLAUDE_EFFORT", "")


def observed(host: str, env: Mapping[str, str]) -> RouteTuple | None:
    model, effort = (codex_route if host == "codex" else claude_route)(env)
    if not SAFE_VALUE.fullmatch(model) or model == "none" or effort not in EFFORTS:
        return None
    return host, PROVIDERS[host], model, effort


def model_rank(model: str, routes: list[Route]) -> int | None:
    ranks = [
        PROFILE_ORDER.index(r.profile)
        for r in routes
        if r.model == model and r.profile in PROFILE_ORDER
    ]
    return min(ranks, default=None)


def compare(lower: bool, higher: bool) -> str:
    if lower == higher:
        return "unknown"
    return "lower" if lower else "higher"


def relation(main: RouteTuple, selected: RouteTuple, routes: list[Route]) -> str:
    if main == selected:
        return "same"
    main_effort = EFFORT_ORDER.index(main[3])
    effort = EFFORT_ORDER.index(selected[3])
    if main[2] == selected[2]:
        return compare(effort < main_effort, effort > main_effort)
    main_rank, rank = model_rank(main[2], routes), model_rank(selected[2], routes)
    if main_rank is None or rank is None:
        return "unknown"
    return compare(
        rank < main_rank and effort <= main_effort,
        rank > main_rank and effort >= main_effort,
    )


def report(
    selected: RouteTuple,
    main: RouteTuple | None,
    source: str,
    routes: list[Route],
) -> str:
    ranked = [route for route in routes if route.host == selected[0]]
    result = record("format", "darrow-native-goal-placement-v1")
    result += record("selected_route", *selected)
    if main is None:
        return (
            result
            + record("main_route", "unknown")
            + record("main_route_source", "unknown")
            + record("route_relation", "unknown")
        )
    return (
        result
        + record("main_route", *main)
        + record("main_route_source", source)
        + record("route_relation", relation(main, selected, ranked))
    )
