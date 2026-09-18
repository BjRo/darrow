"""Conventional subjects and attribution guards shared by commits and PRs."""

import re

from .names import TYPES
from .process import require

TOOLS = r"claude|gpt|chatgpt|codex|copilot|cursor|gemini"
ATTRIBUTION = re.compile(
    rf"co-authored-by:.*\b({TOOLS}|ai)\b|co[- ]?authored[- ]by +({TOOLS})\b|"
    rf"(generated|built|written|created|made|assisted)[- ](with|by|using) +\[?({TOOLS}|an? ai\b|ai\b)|🤖",
    re.IGNORECASE,
)


def validate_subject(subject: str, label: str) -> None:
    require(
        re.match(rf"^({TYPES})(\([^)]+\))?!?: \S", subject),
        f"{label} not Conventional Commits format: {subject}",
        5,
    )
    require(len(subject) <= 72, f"{label} exceeds 72 chars ({len(subject)})", 5)
    require(not subject.endswith("."), f"{label} has trailing period", 5)


def validate_attribution(text: str, label: str) -> None:
    require(
        not ATTRIBUTION.search(text), f"AI attribution is not allowed in {label}", 6
    )
