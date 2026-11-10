"""Dependency-free host plugin discovery for the installed command."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import cast

PROFILE_VARIABLES = {"codex": "CODEX_HOME", "claude": "CLAUDE_CONFIG_DIR"}


def plugin_entries(
    executable: str, host: str, profile: str, checkout: Path
) -> list[dict[str, object]]:
    environment = dict(os.environ)
    environment.pop("CLAUDECODE", None)
    environment[PROFILE_VARIABLES[host]] = profile
    result = subprocess.run(
        [executable, "plugin", "list", "--json"],
        cwd=checkout,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode or result.stderr.strip():
        raise ValueError(
            f"{host} plugin listing failed: {result.stderr.strip() or result.stdout.strip()}"
        )
    value = json.loads(result.stdout)
    if isinstance(value, dict):
        if value.get("errors"):
            raise ValueError(f"{host} plugin listing failed: {value['errors']}")
        value = value.get("installed")
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{host} plugin listing returned an invalid installed list")
    return cast(list[dict[str, object]], value)


def plugin_name(entry: dict[str, object], host: str) -> str:
    name = entry.get("id" if host == "claude" else "pluginId")
    if not isinstance(name, str):
        raise ValueError("Plugin listing has no plugin identity")
    return name.split("@", 1)[0]


def repository_at(checkout: Path) -> str:
    result = subprocess.run(
        ["git", "-C", str(checkout), "config", "--get", "remote.origin.url"],
        check=True,
        capture_output=True,
        text=True,
    )
    match = re.fullmatch(
        r"(?:https://github.com/|git@github.com:)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?",
        result.stdout.strip(),
    )
    if match is None:
        raise ValueError("Origin must name a GitHub owner/repository")
    return match[1]


def default_state(repository: str) -> Path:
    if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) is None:
        raise ValueError("Repository must be GitHub owner/repository")
    if any(part in {".", ".."} for part in repository.split("/")):
        raise ValueError("Repository cannot contain path traversal")
    return Path.home() / ".darrow" / "artificer" / repository.lower()


def read_object(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return cast(dict[str, object], value)


def installation_state(repository: str) -> Path:
    directory = default_state(repository)
    binding = directory / "location.json"
    if not binding.exists():
        return directory
    value = read_object(binding)["state"]
    if not isinstance(value, str) or not Path(value).is_absolute():
        raise ValueError(f"Invalid installation location: {binding}")
    return Path(value)


def bootstrap_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--state", type=Path)
    parser.add_argument("--host", choices=("codex", "claude"))
    parser.add_argument("--repository")
    parser.add_argument("--checkout", type=Path, default=Path.cwd())
    parser.add_argument("operation", nargs="?", default="status")
    return parser.parse_known_args()[0]


def selected_host(args: argparse.Namespace) -> str:
    state = args.state or installation_state(
        args.repository or repository_at(args.checkout)
    )
    if (state / "grant.json").exists():
        host = read_object(state / "grant.json")["host"]
        if host not in {"codex", "claude"}:
            raise ValueError("Invalid saved Artificer host")
        return str(host)
    return initialization_host(args)


def initialization_host(args: argparse.Namespace) -> str:
    if args.operation != "init":
        raise ValueError("Installation is not initialized; run darrow-artificer init")
    if args.host is None and sys.stdin.isatty():
        args.host = input("Host (codex/claude): ").strip()
        sys.argv.extend(["--host", args.host])
    if args.host not in {"codex", "claude"}:
        raise ValueError(
            "darrow-artificer init needs --host (codex or claude); scripted setup also requires --repository and --checkout"
        )
    return str(args.host)


def installed_backend(entries: list[dict[str, object]], host: str) -> Path:
    matches = [
        entry
        for entry in entries
        if plugin_name(entry, host) == "darrow-artificer"
        and entry.get("enabled") is True
        and (host != "claude" or entry.get("scope") == "user")
    ]
    if len(matches) != 1:
        raise ValueError(
            "Artificer must be installed and enabled once in the host default profile"
        )
    entry = matches[0]
    source = entry.get("source")
    path = (
        entry.get("installPath")
        if host == "claude"
        else source.get("path")
        if isinstance(source, dict)
        else None
    )
    if not isinstance(path, str) or not Path(path).is_absolute():
        raise ValueError("Artificer plugin listing has no absolute installation path")
    backend = Path(path) / "backend" / "scripts" / "run_locked.py"
    if not backend.is_file():
        raise ValueError(f"Artificer installation is unavailable: {backend}")
    return backend.parent.parent


def refuse_legacy(checkout: Path) -> None:
    result = subprocess.run(
        [
            "git",
            "-C",
            str(checkout),
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        return
    legacy = Path(result.stdout.strip()) / "artificer"
    if legacy.exists():
        raise ValueError(
            f"Legacy Artificer state exists. Remove {legacy} after reconciling its work, then run darrow-artificer init"
        )


def main() -> None:
    try:
        args = bootstrap_arguments()
        refuse_legacy(args.checkout)
        host = selected_host(args)
        executable = shutil.which(host)
        uv = shutil.which("uv")
        if executable is None or uv is None:
            raise ValueError(f"Artificer requires {host} and uv on PATH")
        entries = plugin_entries(
            executable, host, str(Path.home() / f".{host}"), args.checkout
        )
        backend = installed_backend(entries, host)
        os.execv(
            uv,
            [
                uv,
                "run",
                "--quiet",
                "--no-project",
                str(backend / "scripts/run_locked.py"),
                "darrow-artificer",
                *sys.argv[1:],
            ],
        )
    except Exception as error:
        # Installed process boundary: refuse stale/missing plugins without a fallback.
        print(f"Artificer needs attention: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
