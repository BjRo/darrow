from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


_WORK_ITEM = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_JIRA_TOKEN = re.compile(
    r"(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*[-_]\d+)(?![A-Za-z0-9])"
)
_ISSUE_TOKEN = re.compile(r"(?<![A-Za-z0-9])(issue[-_]\d+)(?![A-Za-z0-9])", re.I)
_NUMERIC_BRANCH_TOKEN = re.compile(r"(?:^|/)(\d+)(?=$|[-_/])")


@dataclass(frozen=True)
class Config:
    enabled: bool = False
    capture_content: bool = False
    dry_run: bool = False
    debug: bool = False
    strict: bool = False
    public_key: str | None = None
    secret_key: str | None = None
    base_url: str = "https://cloud.langfuse.com"
    work_item_id: str | None = None
    max_chars: int = 20_000


def _parse_bool(value: Any, name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off", ""}:
            return False
    raise ValueError(f"{name} must be a boolean")


def _read_config_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"configuration file is unreadable or invalid: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"configuration file must contain an object: {path}")
    return value


def _nonempty(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _validate_work_item(value: Any) -> str | None:
    normalized = _nonempty(value)
    if normalized is None:
        return None
    if not _WORK_ITEM.fullmatch(normalized):
        raise ValueError("work_item_id contains unsupported characters or is too long")
    return normalized


def load_config(
    cwd: str,
    *,
    env: Mapping[str, str] | None = None,
    home: str | None = None,
) -> Config:
    environment = dict(os.environ if env is None else env)
    home_dir = Path(home or environment.get("HOME") or Path.home())
    merged: dict[str, Any] = {}
    merged.update(_read_config_file(home_dir / ".codex" / "darrow-langfuse.json"))
    merged.update(_read_config_file(Path(cwd) / ".codex" / "darrow-langfuse.json"))

    env_names = {
        "enabled": "DARROW_LANGFUSE_ENABLED",
        "capture_content": "DARROW_LANGFUSE_CAPTURE_CONTENT",
        "dry_run": "DARROW_LANGFUSE_DRY_RUN",
        "debug": "DARROW_LANGFUSE_DEBUG",
        "strict": "DARROW_LANGFUSE_STRICT",
        "public_key": "LANGFUSE_PUBLIC_KEY",
        "secret_key": "LANGFUSE_SECRET_KEY",
        "base_url": "LANGFUSE_BASE_URL",
        "work_item_id": "DARROW_LANGFUSE_WORK_ITEM_ID",
        "max_chars": "DARROW_LANGFUSE_MAX_CHARS",
    }
    for key, variable in env_names.items():
        if variable in environment:
            merged[key] = environment[variable]

    bool_fields = {name: _parse_bool(merged[name], name) for name in (
        "enabled",
        "capture_content",
        "dry_run",
        "debug",
        "strict",
    ) if name in merged}
    max_chars = merged.get("max_chars", 20_000)
    try:
        max_chars = int(max_chars)
    except (TypeError, ValueError) as error:
        raise ValueError("max_chars must be an integer") from error
    if max_chars < 0 or max_chars > 1_000_000:
        raise ValueError("max_chars must be between 0 and 1000000")

    return Config(
        **bool_fields,
        public_key=_nonempty(merged.get("public_key")),
        secret_key=_nonempty(merged.get("secret_key")),
        base_url=_nonempty(merged.get("base_url")) or "https://cloud.langfuse.com",
        work_item_id=_validate_work_item(merged.get("work_item_id")),
        max_chars=max_chars,
    )


def infer_work_item_id(cwd: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", "-C", cwd, "symbolic-ref", "--quiet", "--short", "HEAD"],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    branch = completed.stdout.strip()
    for pattern in (_ISSUE_TOKEN, _JIRA_TOKEN, _NUMERIC_BRANCH_TOKEN):
        match = pattern.search(branch)
        if match:
            return match.group(1)
    return None


def resolve_work_item_id(config: Config, cwd: str) -> str | None:
    return config.work_item_id or infer_work_item_id(cwd)
