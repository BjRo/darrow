"""Responsive terminal report; accounting and JSON stay presentation-independent."""

import os
import shutil
import sys
from itertools import zip_longest
from textwrap import wrap
from typing import Any

SNAPSHOT_NOTE = "Estimates include recorded items after the last token_count; byte estimates are not tokenizer counts."
NEGATIVE_REMAINDER_WARNING = (
    "Negative remainder: byte estimates exceed the last exact total."
)
LABELS = {
    "system_prompt": "System prompt",
    "other_developer_instructions": "Developer instructions",
    "skills": "Skills",
    "plugins": "Plugins",
    "agents_md": "AGENTS.md",
    "environment": "Environment",
    "messages": "Messages",
    "tool_output": "Tool output",
    "logged_tool_definitions": "Tool definitions",
}


def style(text: str, code: str, color: bool) -> str:
    return f"\033[{code}m{text}\033[0m" if color else text


def terminal_options() -> tuple[int, bool]:
    color = (
        sys.stdout.isatty()
        and not os.environ.get("NO_COLOR")
        and os.environ.get("TERM") != "dumb"
    )
    return max(40, shutil.get_terminal_size((80, 24)).columns), color


def percentage(count: int, window: int | None) -> str:
    return f"{count / window:.1%}" if window else "—"


def summary(data: dict[str, Any]) -> list[str]:
    total, window = data["exact_total_tokens"], data["model_context_window"]
    if total is None:
        return [
            "Usage not recorded yet",
            "Codex logs the first token count after the first model response.",
        ]
    return [
        f"{total:,} / {window:,} tokens · {percentage(total, window)} used",
        "Last recorded token count",
    ]


def capacity_cell(token: float, data: dict[str, Any], color: bool) -> str:
    if token < data["exact_total_tokens"]:
        return style("■", "36", color)
    limit = data.get("model_auto_compact_token_limit")
    if limit is not None and token >= limit:
        return style("░", "33", color)
    return style("·", "2", color)


def grid(data: dict[str, Any], color: bool) -> list[str]:
    window = data["model_context_window"]
    if window is None:
        return ["Capacity grid unavailable"]
    cells = [
        capacity_cell((index + 0.5) * window / 100, data, color) for index in range(100)
    ]
    return [" ".join(cells[start : start + 10]) for start in range(0, 100, 10)]


def category_rows(data: dict[str, Any]) -> list[tuple[str, int]]:
    return [(LABELS[key], value) for key, value in data["categories"].items()]


def bar(count: int, window: int) -> str:
    units = min(64, max(0, round(count / window * 64)))
    full, partial = divmod(units, 8)
    fraction = "▏▎▍▌▋▊▉"[partial - 1] if partial else ""
    return ("█" * full + fraction).ljust(8, "─")


def breakdown(data: dict[str, Any], width: int, color: bool) -> list[str]:
    rows = category_rows(data)
    count_width = max(6, *(len(f"{count:,}") for _, count in rows))
    label_width = min(max(len(label) for label, _ in rows), width - count_width - 11)
    header = f"{'Category':<{label_width}}  {'Tokens':>{count_width}}  {'Window':>7}"
    lines = [style(header, "2", color)]
    for label, count in rows:
        window = data["model_context_window"]
        share = percentage(count, window)
        first, *rest = wrap(label, label_width)
        line = f"{first:<{label_width}}  {count:>{count_width},}  {share:>7}"
        if window and width >= len(line) + 10:
            line += "  " + style(bar(count, window), "36", color)
        lines.append(line)
        lines.extend(rest)
    return lines


def layout(data: dict[str, Any], width: int, color: bool) -> list[str]:
    cells = grid(data, color)
    # The grid is 19 visible columns. ANSI bytes must not affect alignment.
    if width >= 80:
        table = breakdown(data, width - 24, color)
        return [
            f"{left}{' ' * (19 if not left else 0)}     {right}".rstrip()
            for left, right in zip_longest(cells, table, fillvalue="")
        ]
    return [*cells, "", *breakdown(data, width, color)]


def notes(data: dict[str, Any]) -> list[str]:
    lines = ["■ Used  · Free  · Each cell = 1% of the window"]
    if "autocompact_buffer_tokens" in data:
        buffer = data["autocompact_buffer_tokens"]
        value = f"{buffer:,} tokens" if buffer is not None else "unknown until recorded"
        lines.append(f"░ Autocompact buffer: {value} (configured buffer)")
        lines.append("Free capacity includes the buffer; used cells take precedence.")
    lines.append(
        "Categories ≈ UTF-8 bytes / 4, including items after the last token count."
    )
    return lines


def rest(data: dict[str, Any]) -> str:
    free = data["free_tokens"]
    if free is None:
        return "Rest: unavailable until the first recorded token count"
    return f"Rest: {free:,} tokens · {percentage(free, data['model_context_window'])} of window"


def wrapped(lines: list[str], width: int) -> list[str]:
    return [part for line in lines for part in wrap(line, width=width)]


def render(data: dict[str, Any], *, width: int = 80, color: bool = False) -> str:
    heading, *detail = summary(data)
    lines = [
        style("Codex context", "1", color),
        "",
        *(style(line, "1", color) for line in wrapped([heading], width)),
        *(style(line, "2", color) for line in wrapped(detail, width)),
        "",
        style("Breakdown · estimated tokens", "1", color),
        "",
        *layout(data, width, color),
        "",
        *(style(line, "2", color) for line in wrapped(notes(data), width)),
    ]
    for warning in data["warnings"]:
        if warning == NEGATIVE_REMAINDER_WARNING:
            continue
        lines.extend(
            style(line, "33", color) for line in wrap(f"Warning: {warning}", width)
        )
    lines.extend(
        [
            "",
            style(f"Codex CLI {data['cli_version']}", "2", color),
            *(
                style(line, "2", color)
                for line in wrap(f"Session: {data['rollout_path']}", width)
            ),
        ]
    )
    lines.extend(
        ["", *(style(line, "1;36", color) for line in wrap(rest(data), width))]
    )
    return "\n".join(lines)
