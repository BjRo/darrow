from __future__ import annotations

import ctypes
import os
import signal
import subprocess
import sys
from pathlib import Path
from typing import cast
from unittest.mock import Mock

import pytest

from darrow_review import common, windows_job


def libraries(monkeypatch: pytest.MonkeyPatch) -> tuple[Mock, Mock]:
    kernel, native = Mock(), Mock()
    kernel.CreateJobObjectW.return_value = 123
    kernel.AssignProcessToJobObject.return_value = 1
    native.NtResumeProcess.return_value = 0
    monkeypatch.setattr(
        ctypes,
        "WinDLL",
        lambda name, **_kwargs: kernel if name == "kernel32" else native,
        raising=False,
    )
    return kernel, native


def test_windows_job_attaches_before_resuming(monkeypatch: pytest.MonkeyPatch) -> None:
    kernel, native = libraries(monkeypatch)
    process = cast(subprocess.Popen[bytes], Mock(_handle=42))
    job = windows_job.WindowsJob()
    job.attach(process)
    kernel.AssignProcessToJobObject.assert_called_once_with(123, 42)
    native.NtResumeProcess.assert_called_once_with(42)
    job.close()
    kernel.TerminateJobObject.assert_called_once_with(123, 1)
    kernel.CloseHandle.assert_called_once_with(123)


@pytest.mark.parametrize("failure", ["create", "configure", "assign", "resume"])
def test_windows_job_failures_do_not_strand_suspended_process(
    monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    kernel, native = libraries(monkeypatch)
    process = Mock(_handle=42)
    operation, result = {
        "create": (kernel.CreateJobObjectW, 0),
        "configure": (kernel.SetInformationJobObject, 0),
        "assign": (kernel.AssignProcessToJobObject, 0),
        "resume": (native.NtResumeProcess, -1),
    }[failure]
    operation.return_value = result
    with pytest.raises(OSError):
        job = windows_job.WindowsJob()
        job.attach(cast(subprocess.Popen[bytes], process))
    if failure in ("assign", "resume"):
        process.kill.assert_called_once()
        process.wait.assert_called_once()


@pytest.mark.skipif(
    os.name == "nt",
    reason="POSIX group regression; native Windows job ownership is exercised separately",
)
def test_exited_parent_does_not_hide_live_descendant(tmp_path: Path) -> None:
    pidfile = tmp_path / "descendant.pid"
    process = subprocess.Popen(
        ["bash", "-c", 'sleep 60 & echo $! > "$1"', "fixture", str(pidfile)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    process.wait(timeout=10)
    descendant = int(pidfile.read_text())
    try:
        common.stop_process(process)
        process.communicate(timeout=5)
    except BaseException:
        if sys.platform != "win32":
            os.kill(descendant, signal.SIGKILL)
        raise


def test_cancellation_cleans_descendant_after_parent_exit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Real descendant ownership survives the direct parent's exit on every OS."""
    ready = tmp_path / "ready"
    child = "import time; time.sleep(60)"
    parent = f"import subprocess,sys; from pathlib import Path; subprocess.Popen([sys.executable, '-c', {child!r}]); Path({str(ready)!r}).write_text('ready')"
    original = subprocess.Popen.communicate
    observed: list[subprocess.Popen[bytes]] = []

    def cancelled(
        process: subprocess.Popen[bytes], *args: object, **kwargs: object
    ) -> tuple[bytes, bytes]:
        process.wait(timeout=10)
        assert ready.exists()
        observed.append(process)
        raise KeyboardInterrupt

    monkeypatch.setattr(subprocess.Popen, "communicate", cancelled)
    with pytest.raises(KeyboardInterrupt):
        common.run([sys.executable, "-c", parent])
    monkeypatch.setattr(subprocess.Popen, "communicate", original)
    # EOF proves the descendant no longer owns the inherited pipes.
    observed[0].communicate(timeout=5)
