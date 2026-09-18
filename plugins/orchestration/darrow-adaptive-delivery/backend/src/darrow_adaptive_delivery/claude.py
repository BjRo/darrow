"""Bind a direct-Anthropic route to its shipped native Claude Agent."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from pathlib import Path

from .arguments import options, require
from .common import PLUGIN, RefusalError, read_text, record

USAGE = "usage: claude-agent-route --provider <id> --model <id> --effort <level>\n"
SELECTORS = (
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_MANTLE",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_USE_ANTHROPIC_AWS",
)


def direct_provider(env: Mapping[str, str]) -> None:
    for selector in SELECTORS:
        if env.get(selector):
            raise RefusalError(
                f"Claude provider is not observably direct Anthropic: {selector} is set"
            )
    if env.get("ANTHROPIC_BASE_URL", "") not in {
        "",
        "https://api.anthropic.com",
        "https://api.anthropic.com/",
    }:
        raise RefusalError(
            "Claude provider is not observably direct Anthropic: ANTHROPIC_BASE_URL is custom"
        )


def model_suffix(model: str) -> str:
    if not model.startswith("claude-"):
        raise RefusalError(f"model must be a concrete Claude model ID: {model}")
    suffix = model.removeprefix("claude-")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", suffix):
        raise RefusalError(f"unsafe model ID: {model}")
    return suffix


def overrides(env: Mapping[str, str], model: str, effort: str) -> None:
    for key, selected, label in (
        ("CLAUDE_CODE_SUBAGENT_MODEL", model, "model"),
        ("CLAUDE_CODE_EFFORT_LEVEL", effort, "effort"),
    ):
        value = env.get(key, "")
        if value and value != selected:
            raise RefusalError(f"{key} overrides selected {label}: {value}")


def resolve(model: str, effort: str, plugin: Path, env: Mapping[str, str]) -> str:
    suffix = model_suffix(model)
    if effort not in {"low", "medium", "high", "xhigh", "max"}:
        raise RefusalError(f"unsupported effort: {effort}")
    name = f"adaptive-delivery-{suffix}-{effort}"
    path = plugin / "agents" / f"{name}.md"
    try:
        lines = read_text(path, "runner is unreadable").splitlines()
    except RefusalError as error:
        raise RefusalError(f"no bundled runner for {model}/{effort}") from error
    for field, value in (("name", name), ("model", model), ("effort", effort)):
        if f"{field}: {value}" not in lines:
            raise RefusalError(f"runner {field} does not match route: {path}")
    overrides(env, model, effort)
    return (
        record("format", "darrow-claude-agent-route-v1")
        + record("selected_route", "claude", "anthropic", model, effort)
        + record("subagent_type", f"darrow-adaptive-delivery:{name}")
        + record("agent_file", str(path))
    )


def run(args: list[str], plugin: Path = PLUGIN) -> str:
    if any(arg in {"-h", "--help"} for arg in args):
        return USAGE
    values = options(args, {"--provider", "--model", "--effort"}, "")
    require(
        values,
        {"provider", "model", "effort"},
        "--provider, --model, and --effort are required",
    )
    if values["provider"] != "anthropic":
        raise RefusalError(f"unsupported provider: {values['provider']}")
    direct_provider(os.environ)
    return resolve(values["model"], values["effort"], plugin, os.environ)
