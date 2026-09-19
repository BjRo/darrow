"""Codex 0.154.0 invocation and observable native identity, without fallback."""

import json
import os
import shutil
import subprocess
from pathlib import Path

from .github import object_value, text_value
from .models import Grant, Native, Outcome
from .storage import write_bytes

VERSION = "codex-cli 0.154.0"


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
    if not grant.subscription_only_confirmed:
        raise ValueError("Subscription-only account setup has not been confirmed")
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
        shutil.copytree(
            source,
            home / "skills" / source.name,
            ignore=shutil.ignore_patterns(
                ".venv", "__pycache__", ".git", "evals", "tests"
            ),
        )


def command(grant: Grant, home: Path, output: Path, parent: str | None) -> list[str]:
    schema = home.parent / "outcome-schema.json"
    write_bytes(schema, json.dumps(Outcome.model_json_schema()).encode())
    args = [grant.codex, "exec"]
    if parent is not None:
        args += ["resume", parent]
    return [
        *args,
        "--ignore-user-config",
        "--json",
        "--output-schema",
        str(schema),
        "--output-last-message",
        str(output),
        "--dangerously-bypass-approvals-and-sandbox",
        *options(grant),
        "-",
    ]


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


def owner_thread(home: Path, parent: str, owner: str) -> str:
    matches: list[str] = []
    for path in (home / "sessions").rglob("*.jsonl"):
        with path.open() as source:
            row = object_value(json.loads(source.readline()))
        meta = object_value(row.get("payload"))
        if meta.get("parent_thread_id") == parent and meta.get("agent_path") == owner:
            matches.append(text_value(meta["id"]))
    if len(matches) != 1:
        raise ValueError("Original engineering owner is missing or ambiguous")
    return matches[0]


def correlate(home: Path, parent: str, owner: str, grant: Grant) -> Native:
    _, context = native_thread(home, parent)
    if (context.get("model"), context.get("effort")) != (grant.model, grant.effort):
        raise ValueError("Native parent model/effort changed")
    if not owner:
        return preflight_identity(home, parent, grant)
    child = owner_thread(home, parent, owner)
    _, child_context = native_thread(home, child)
    return Native(
        parent=parent,
        owner=owner,
        owner_thread=child,
        model=grant.model,
        effort=grant.effort,
        owner_model=text_value(child_context["model"]),
        owner_effort=text_value(child_context["effort"]),
    )


def preflight_identity(home: Path, parent: str, grant: Grant) -> Native:
    paths = list((home / "sessions").rglob("*.jsonl"))
    if len(paths) != 1:
        raise ValueError(
            "Owner identity omitted despite native children; human reconciliation required"
        )
    return Native(
        parent=parent,
        owner="",
        owner_thread="",
        model=grant.model,
        effort=grant.effort,
        owner_model="",
        owner_effort="",
    )


def preserves(previous: Native, observed: Native) -> bool:
    if previous.owner:
        return previous == observed
    return (previous.parent, previous.model, previous.effort) == (
        observed.parent,
        observed.model,
        observed.effort,
    )
