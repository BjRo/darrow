"""Identify local process groups before observing or stopping one delivery."""

import os
import signal
import subprocess
import sys

from .installation import Installation
from .models import Claim, Process


def identity(pid: int) -> Process | None:
    result = subprocess.run(
        ["/bin/ps", "-p", str(pid), "-o", "lstart="],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode == 1:
        return None
    if result.returncode or not result.stdout.strip():
        raise RuntimeError(f"Cannot establish execution identity for PID {pid}")
    return Process(pid=pid, started=result.stdout.strip())


def alive(process: Process | None) -> bool:
    if process is None:
        return False
    if identity(process.pid) == process:
        return True
    # A killed worker can leave its Codex descendant in the original process group.
    # A reused group is ambiguous too: neither case proves execution has ended.
    result = subprocess.run(
        ["/bin/ps", "-axo", "pgid="], text=True, capture_output=True, check=True
    )
    return str(process.pid) in result.stdout.split()


def cancel_process(process: Process | None) -> None:
    if process is None or not alive(process):
        return
    if identity(process.pid) != process:
        raise RuntimeError(
            "Delivery leader is unavailable; reconcile surviving processes"
        )
    if os.getpgid(process.pid) != process.pid:
        raise RuntimeError("Delivery process is not its own process-group leader")
    os.killpg(process.pid, signal.SIGTERM)


def launch(site: Installation, claim: Claim) -> None:
    directory = site.delivery_dir(claim.id)
    with (directory / "worker.log").open("ab") as log:
        process = subprocess.Popen(
            [sys.executable, "-m", "darrow_artificer.worker", str(site.root), claim.id],
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=log,
            start_new_session=True,
        )
    claim.process = identity(process.pid)
    if claim.process is None:
        raise RuntimeError("Worker exited before its identity could be observed")
    claim.status = "running"
    site.save(claim)
