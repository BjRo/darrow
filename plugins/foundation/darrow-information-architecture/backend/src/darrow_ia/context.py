"""Read-only context snapshot at the ia-context command boundary."""

import json
import os
import re
import sys
from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from darrow_ia.cli import Parser, run
from darrow_ia.context_categories import CATEGORIES, add_item, without_base_echo
from darrow_ia.context_config import compact_limit
from darrow_ia.context_display import (
    NEGATIVE_REMAINDER_WARNING,
    SNAPSHOT_NOTE,
    render,
    terminal_options,
)
from darrow_ia.context_log import base_text, decode, mapping, read_records, token_info


def active_history(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    for record in records:
        if record["type"] == "compacted":
            history = list(record["payload"]["replacement_history"])
        elif record["type"] == "response_item":
            history.append(record["payload"])
    return history


def find_rollout(home: Path, thread: str) -> Path:
    paths = sorted(home.glob(f"sessions/**/rollout-*-{thread}.jsonl"))
    if not paths:
        raise ValueError(
            f"{home.resolve()}: missing rollout for CODEX_THREAD_ID={thread}"
        )
    if len(paths) != 1:
        version = known_version(paths[0])
        raise ValueError(
            f"{home.resolve()}: duplicate rollout for {thread}; cli_version={version}"
        )
    return paths[0]


def known_version(path: Path) -> str:
    try:
        with path.open(encoding="utf-8") as stream:
            record = decode(next(stream))
            value = mapping(record.get("payload")).get("cli_version")
            return value if isinstance(value, str) else "unknown"
    except (OSError, ValueError, KeyError, StopIteration):
        return "unknown"


def snapshot() -> dict[str, Any]:
    home = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    thread = os.environ.get("CODEX_THREAD_ID", "")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", thread):
        raise ValueError(
            "CODEX_THREAD_ID is missing or invalid; refusing another session"
        )
    path = find_rollout(home, thread)
    records = read_records(path)
    meta = records[0]["payload"]
    limit, config_warnings = configured_limit(home)
    sizes: dict[str, int] = defaultdict(int)
    base = base_text(meta)
    sizes["system_prompt"] = len(base.encode("utf-8"))
    for item in active_history(records):
        add_item(sizes, without_base_echo(item, base))
    estimates = {
        key: (sizes[key] + 3) // 4
        for key in (*CATEGORIES, *sorted(set(sizes) - set(CATEGORIES)))
    }
    result = accounting(path, meta, estimates, records, limit)
    result["warnings"].extend(config_warnings)
    return result


def configured_limit(home: Path) -> tuple[int | None, list[str]]:
    """The buffer is optional, so configuration problems never block the report."""
    try:
        return compact_limit(home), []
    except (OSError, ValueError) as error:
        return None, [f"Autocompact buffer omitted: {error}"]


def accounting(
    path: Path,
    meta: dict[str, Any],
    estimates: dict[str, int],
    records: list[dict[str, Any]],
    limit: int | None,
) -> dict[str, Any]:
    infos = [
        info
        for r in records
        if r["type"] == "event_msg" and (info := token_info(r["payload"])) is not None
    ]
    info = infos[-1] if infos else None
    total = info["last_token_usage"]["total_tokens"] if info else None
    window = info["model_context_window"] if info else None
    warnings = ["No token_count yet; estimates only."] if not info else []
    remainder = total - sum(estimates.values()) if total is not None else None
    if remainder is not None and remainder < 0:
        warnings.append(NEGATIVE_REMAINDER_WARNING)
    result = {
        "schema_version": 1,
        "rollout_path": str(path.resolve()),
        "cli_version": meta.get("cli_version"),
        "categories": estimates,
        "exact_total_tokens": total,
        "model_context_window": window,
        "free_tokens": window - total
        if window is not None and total is not None
        else None,
        "remainder_tokens": remainder,
        "warnings": warnings,
        "snapshot_note": SNAPSHOT_NOTE,
    }

    add_buffer(result, window, limit)
    return result


def add_buffer(result: dict[str, Any], window: int | None, limit: int | None) -> None:
    if limit is None:
        return
    if window is not None and limit > window:
        result["warnings"].append(
            "Configured compaction limit exceeds the model context window."
        )
    result["model_auto_compact_token_limit"] = limit
    result["autocompact_buffer_tokens"] = window - limit if window is not None else None


def command(arguments: Sequence[str]) -> int:
    parser = Parser(add_help=False, usage="ia-context --format json|grid")
    parser.add_argument("--format", choices=("json", "grid"), default="grid")
    args = parser.parse_args(arguments)
    data = snapshot()
    width, color = terminal_options()
    print(
        json.dumps(data, ensure_ascii=False, sort_keys=True)
        if args.format == "json"
        else render(data, width=width, color=color)
    )
    return 0


def entrypoint() -> None:
    sys.exit(run(command, sys.argv[1:]))
