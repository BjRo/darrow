"""Human-readable bounded grid; signed accounting remains in the table."""

from typing import Any

SNAPSHOT_NOTE = "Estimates include recorded items after the last token_count; byte estimates are not tokenizer counts."
SYMBOLS = ["S", "D", "K", "P", "A", "E", "M", "O", "T"]


def legend(data: dict[str, Any]) -> list[tuple[str, str, int]]:
    rows = [
        (symbol, key, value)
        for symbol, (key, value) in zip(
            SYMBOLS, data["categories"].items(), strict=False
        )
    ]
    remainder = data["remainder_tokens"]
    if remainder is not None:
        rows.append(("R", "remainder (unlogged / estimation difference)", remainder))
    return rows


def cell(token: float, rows: list[tuple[str, str, int]], limit: int | None) -> str:
    end = 0
    for symbol, _, count in rows:
        end += max(0, count)
        if token < end:
            return symbol
    return "B" if limit is not None and token >= limit else "."


def grid(data: dict[str, Any], rows: list[tuple[str, str, int]]) -> list[str]:
    window = data["model_context_window"]
    if window is None:
        return ["[grid unavailable before first token_count]"]
    cells = [
        cell(
            (index + 0.5) * window / 100,
            rows,
            data.get("model_auto_compact_token_limit"),
        )
        for index in range(100)
    ]
    return [
        "[" + "".join(cells[start : start + 10]) + "]" for start in range(0, 100, 10)
    ]


def render(data: dict[str, Any]) -> str:
    rows = legend(data)
    lines = [
        f"Codex context — {data['rollout_path']}",
        f"cli_version: {data['cli_version']}",
    ]
    total, window = data["exact_total_tokens"], data["model_context_window"]
    lines.append(f"Context used (last token_count): {total} / {window}")
    lines.extend(grid(data, rows))
    lines.extend(
        [
            "Estimated grid; each cell is 1% of the window. . free"
            + (
                "; B configured buffer." if "autocompact_buffer_tokens" in data else "."
            ),
            "Category                                         Tokens (estimated)",
        ]
    )
    lines.extend(f"{symbol} {name:<48} {value:>10}" for symbol, name, value in rows)
    lines.append(f"Free tokens (window minus exact total): {data['free_tokens']}")
    if "autocompact_buffer_tokens" in data:
        lines.append(
            f"Autocompact buffer (window minus configured limit): {data['autocompact_buffer_tokens']}"
        )
    lines.append(SNAPSHOT_NOTE)
    lines.extend(f"Warning: {warning}" for warning in data["warnings"])
    return "\n".join(lines)
