"""Byte estimates of validated visible response content."""

import json
import re
from typing import Any

CATEGORIES = (
    "system_prompt",
    "other_developer_instructions",
    "skills",
    "plugins",
    "agents_md",
    "environment",
    "messages",
    "tool_output",
)
BLOCKS = re.compile(
    r"<(skills_instructions|plugins_instructions|environment_context)>.*?</\1>",
    re.DOTALL,
)
TAGS = {
    "skills_instructions": "skills",
    "plugins_instructions": "plugins",
    "environment_context": "environment",
}


def category(role: str, text: str) -> str:
    if role == "developer":
        return "other_developer_instructions"
    if role == "user" and text.startswith("# AGENTS.md instructions for "):
        return "agents_md"
    return "messages"


def instruction_blocks(role: str, text: str) -> list[re.Match[str]]:
    allowed = {
        "developer": {"skills_instructions", "plugins_instructions"},
        "user": {"environment_context"},
    }
    return [
        match for match in BLOCKS.finditer(text) if match[1] in allowed.get(role, set())
    ]


def add_text(sizes: dict[str, int], role: str, text: str) -> None:
    cursor = 0
    remaining = []
    for match in instruction_blocks(role, text):
        remaining.append(text[cursor : match.start()])
        sizes[TAGS[match[1]]] += len(match[0].encode("utf-8"))
        cursor = match.end()
    remaining.append(text[cursor:])
    content = "".join(remaining)
    sizes[category(role, content)] += len(content.encode("utf-8"))


def message(sizes: dict[str, int], item: dict[str, Any]) -> None:
    for part in item["content"]:
        add_text(sizes, item["role"], part["text"])


def agent_message(sizes: dict[str, int], item: dict[str, Any]) -> None:
    for part in item["content"]:
        sizes["messages"] += len(part["text"].encode("utf-8"))


def output(sizes: dict[str, int], item: dict[str, Any]) -> None:
    value = item["output"]
    output_text = (
        value if isinstance(value, str) else "".join(part["text"] for part in value)
    )
    sizes["tool_output"] += len(output_text.encode("utf-8"))


def call(sizes: dict[str, int], item: dict[str, Any]) -> None:
    content = item["name"] + item.get("arguments", item.get("input", ""))
    sizes["messages"] += len(content.encode("utf-8"))


def reasoning(sizes: dict[str, int], item: dict[str, Any]) -> None:
    for part in item.get("summary", []) + item.get("content", []):
        sizes["messages"] += len(part["text"].encode("utf-8"))


def tools(sizes: dict[str, int], item: dict[str, Any]) -> None:
    content = json.dumps(item["tools"], ensure_ascii=False, separators=(",", ":"))
    sizes["logged_tool_definitions"] += len(content.encode("utf-8"))


def encrypted_compaction(sizes: dict[str, int], item: dict[str, Any]) -> None:
    """Encrypted summaries are unavailable; their usage stays in the remainder."""


MEASURERS = {
    "message": message,
    "agent_message": agent_message,
    "function_call": call,
    "custom_tool_call": call,
    "function_call_output": output,
    "custom_tool_call_output": output,
    "reasoning": reasoning,
    "additional_tools": tools,
    "compaction": encrypted_compaction,
}


def add_item(sizes: dict[str, int], item: dict[str, Any]) -> None:
    MEASURERS[item["type"]](sizes, item)


def without_base_echo(item: dict[str, Any], base: str) -> dict[str, Any]:
    if item["type"] != "message" or item["role"] not in {"developer", "system"}:
        return item
    return {
        **item,
        "content": [part for part in item["content"] if part["text"] != base],
    }
