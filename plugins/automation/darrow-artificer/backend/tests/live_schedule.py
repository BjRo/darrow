"""Opt-in launchd integration in a temporary fixture; admits no real issue."""

import json
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from darrow_artificer import scheduler, setup
from darrow_artificer.installation import Installation
from darrow_artificer.models import Grant


def await_activation(path: Path) -> dict[str, object]:
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if path.exists() and path.read_text().strip():
            return dict(json.loads(path.read_text()))
        time.sleep(0.1)
    raise TimeoutError(f"No scheduled activation result: {path}")


def main() -> None:
    root = Path(tempfile.mkdtemp(prefix="darrow-artificer-launchd-"))
    plugin = Path(__file__).resolve().parents[2]
    copy = root / "plugin"
    shutil.copytree(
        plugin,
        copy,
        ignore=shutil.ignore_patterns(
            ".venv", "__pycache__", ".coverage", "coverage.json"
        ),
    )
    backend = copy / "backend"
    uv = shutil.which("uv") or "uv"
    result = subprocess.run(
        [
            uv,
            "run",
            "--quiet",
            "--frozen",
            "--no-dev",
            "--project",
            str(backend),
            "darrow-artificer",
            "--help",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "darrow-artificer" in result.stdout
    fixture = root / "gh"
    fixture.write_text(
        f"#!{sys.executable}\n" + Path(__file__).with_name("forge_stub.py").read_text()
    )
    fixture.chmod(0o700)
    (root / "forge.json").write_text(
        json.dumps({"ready": [1], "claimed": [], "comments": []})
    )
    site = Installation(root / "installation")
    grant = Grant(
        id=str(uuid4()),
        repository="fixture/never-published",
        checkout=str(root),
        common_git=str(root / ".git"),
        grantor="fixture",
        gh=str(fixture),
        codex="/bin/false",
        git="/usr/bin/git",
        model="gpt-5.6-terra",
        effort="medium",
        credential_home=str(root / "unused"),
        subscription_only_confirmed=True,
        WORK_IN_PROGRESS_LIMIT=0,
        effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
    )
    setup.bind(site, grant)
    path = scheduler.install(site, backend)
    try:
        definition = plistlib.loads(path.read_bytes())
        assert definition["StartInterval"] == 900
        service = f"gui/{os.getuid()}/{scheduler.label(site)}"
        subprocess.run(
            ["/bin/launchctl", "kickstart", service], check=True, capture_output=True
        )
        assert await_activation(site.root / "scheduler.log") == {"admitted": []}
        await_exit(service)
        assert not site.claims()
        evidence = {
            "host": "macOS launchd",
            "default_interval_seconds": 900,
            "frozen_copied_artifact": str(copy),
            "scheduler_result": "admitted zero while paused",
            "launchctl_exit": 0,
            "evidence_directory": str(root),
        }
        print(json.dumps(evidence, indent=2))
    finally:
        scheduler.remove(site)


def await_exit(service: str) -> None:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        result = subprocess.run(
            ["/bin/launchctl", "print", service],
            check=True,
            capture_output=True,
            text=True,
        )
        if "last exit code = 0" in result.stdout:
            return
        time.sleep(0.1)
    raise TimeoutError("Scheduled invocation did not report a successful terminal exit")


if __name__ == "__main__":
    main()
