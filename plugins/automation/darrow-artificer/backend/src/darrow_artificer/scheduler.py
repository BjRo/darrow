"""A launchd interval invokes the bounded tick; no resident Darrow daemon."""

import os
import plistlib
import shutil
import subprocess
from pathlib import Path

from .installation import Installation
from .storage import write_bytes


def label(site: Installation) -> str:
    return f"com.darrow.artificer.{site.grant.id}"


def definition(site: Installation, uv: str, backend: Path) -> bytes:
    return plistlib.dumps(
        {
            "Label": label(site),
            "ProgramArguments": [
                uv,
                "run",
                "--quiet",
                "--frozen",
                "--no-dev",
                "--project",
                str(backend.resolve()),
                "darrow-artificer",
                "--state",
                str(site.root),
                "tick",
            ],
            "WorkingDirectory": site.grant.checkout,
            "StartInterval": site.grant.SCHEDULE_SECONDS,
            "RunAtLoad": False,
            "ProcessType": "Background",
            "EnvironmentVariables": {"PATH": os.environ.get("PATH", "/usr/bin:/bin")},
            "StandardOutPath": str(site.root / "scheduler.log"),
            "StandardErrorPath": str(site.root / "scheduler.stderr"),
        }
    )


def install(site: Installation, backend: Path) -> Path:
    uv = shutil.which("uv")
    if uv is None:
        raise ValueError("UV is required for the frozen scheduler entrypoint")
    destination = Path.home() / "Library" / "LaunchAgents" / f"{label(site)}.plist"
    if destination.exists():
        raise FileExistsError(f"Scheduler already exists: {destination}")
    write_bytes(destination, definition(site, str(Path(uv).resolve()), backend))
    subprocess.run(
        ["/bin/launchctl", "bootstrap", f"gui/{os.getuid()}", str(destination)],
        check=True,
        capture_output=True,
        text=True,
    )
    return destination


def remove(site: Installation) -> None:
    subprocess.run(
        ["/bin/launchctl", "bootout", f"gui/{os.getuid()}/{label(site)}"],
        check=True,
        capture_output=True,
        text=True,
    )
    destination = Path.home() / "Library" / "LaunchAgents" / f"{label(site)}.plist"
    destination.unlink(missing_ok=True)
