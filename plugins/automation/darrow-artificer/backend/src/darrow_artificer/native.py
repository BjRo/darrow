"""Codex 0.159.2 invocation and observable native identity, without fallback."""

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from .github import object_value, text_value
from .models import Grant, Native

VERSION = "codex-cli 0.159.2"


def environment(home: Path) -> dict[str, str]:
    allowed = (
        "HOME",
        "PATH",
        "LANG",
        "TMPDIR",
        "USER",
        "LOGNAME",
        "SSH_AUTH_SOCK",
        "GH_TOKEN",
        "GITHUB_TOKEN",
    )
    result = {key: os.environ[key] for key in allowed if key in os.environ}
    result["CODEX_HOME"] = str(home)
    return result


def options(grant: Grant) -> list[str]:
    values = {
        "forced_login_method": "chatgpt",
        "model_provider": "openai",
        "model": grant.model,
        "model_reasoning_effort": grant.effort,
        "cli_auth_credentials_store": "file",
    }
    return [
        item
        for key, value in values.items()
        for item in ("-c", f"{key}={json.dumps(value)}")
    ]


def check_login(grant: Grant, home: Path) -> None:
    version = subprocess.run(
        [grant.codex, "--version"], capture_output=True, text=True, check=True
    ).stdout.strip()
    if version != VERSION:
        raise ValueError(f"Native restoration requires {VERSION}; found {version}")
    if not grant.account_usage_accepted:
        raise ValueError(
            "ChatGPT account usage, including available credits, has not been accepted"
        )
    result = subprocess.run(
        [grant.codex, "login", "status", *options(grant)],
        env=environment(home),
        capture_output=True,
        text=True,
        check=True,
    )
    if "Logged in using ChatGPT" not in result.stdout + result.stderr:
        raise ValueError("Persistent ChatGPT login needs attention; no API fallback")


def prepare_home(home: Path, grant: Grant) -> None:
    home.mkdir(mode=0o700, parents=True)
    credentials = Path(grant.credential_home) / "auth.json"
    if not credentials.is_file():
        raise ValueError(f"Run normal Codex ChatGPT login in {grant.credential_home}")
    (home / "auth.json").symlink_to(credentials)
    for plugin in grant.plugins:
        source = Path(plugin).resolve(strict=True)
        name = plugin_name(source)
        shutil.copytree(
            source,
            home / "skills" / name,
            ignore=shutil.ignore_patterns(
                ".venv", "__pycache__", ".git", "evals", "tests"
            ),
        )


def plugin_name(source: Path) -> str:
    manifest = object_value(
        json.loads((source / ".codex-plugin/plugin.json").read_text())
    )
    name = text_value(manifest["name"])
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) is None:
        raise ValueError("Invalid native plugin name")
    return name


def command(grant: Grant) -> list[str]:
    return [grant.codex, "app-server", "--stdio", *options(grant)]


def records(path: Path) -> list[dict[str, object]]:
    return [
        object_value(json.loads(line)) for line in path.read_text().splitlines() if line
    ]


def thread_id(events: Path) -> str:
    identifiers = {
        text_value(event["thread_id"])
        for event in records(events)
        if event.get("type") == "thread.started"
    }
    if len(identifiers) != 1:
        raise ValueError("Native launch has no unambiguous parent identity")
    return identifiers.pop()


def require_completion(events: Path, thread: str) -> None:
    settled = [
        event for event in records(events) if event.get("type") == "artificer.settled"
    ]
    if len(settled) != 1 or settled[0].get("thread_id") != thread:
        raise ValueError("Missing unambiguous main-thread completion evidence")
    if settled[0].get("goal_status") != "complete":
        raise ValueError("PR completion requires observed native goal completion")


def native_thread(
    home: Path, thread: str
) -> tuple[dict[str, object], dict[str, object]]:
    matches = list((home / "sessions").rglob(f"*{thread}.jsonl"))
    if len(matches) != 1:
        raise ValueError(f"Native thread is missing or ambiguous: {thread}")
    rows = records(matches[0])
    metadata = [
        object_value(row["payload"])
        for row in rows
        if row.get("type") == "session_meta"
        and object_value(row["payload"]).get("id") == thread
    ]
    contexts = [
        object_value(row["payload"])
        for row in rows
        if row.get("type") == "turn_context"
    ]
    if len(metadata) != 1 or not contexts:
        raise ValueError(f"Native thread has incomplete history: {thread}")
    return metadata[0], contexts[-1]


def correlate(home: Path, thread: str, grant: Grant) -> Native:
    metadata, context = native_thread(home, thread)
    if metadata.get("parent_thread_id"):
        raise ValueError("Delivery identity must be the original main thread")
    if (context.get("model"), context.get("effort")) != (grant.model, grant.effort):
        raise ValueError("Native main-thread model/effort changed")
    return Native(thread=thread, model=grant.model, effort=grant.effort)
