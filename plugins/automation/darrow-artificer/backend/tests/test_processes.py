import os
import signal
import subprocess
import sys

import pytest

from darrow_artificer import processes
from darrow_artificer.installation import Installation
from darrow_artificer.models import Process
from test_admission import existing


def test_cancel_only_selected_process_group() -> None:
    first = subprocess.Popen(
        [sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True
    )
    second = subprocess.Popen(
        [sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True
    )
    try:
        identity = processes.identity(first.pid)
        assert identity is not None and processes.alive(identity)
        processes.cancel_process(identity)
        assert first.wait(timeout=10) == -signal.SIGTERM
        assert second.poll() is None
        assert processes.identity(first.pid) is None
        processes.cancel_process(identity)
        processes.cancel_process(None)
    finally:
        first.terminate()
        second.terminate()
        first.wait(timeout=10)
        second.wait(timeout=10)


def test_process_identity_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess([], 2, "", ""),
    )
    with pytest.raises(RuntimeError, match="identity"):
        processes.identity(123)
    monkeypatch.setattr(processes, "alive", lambda value: True)
    monkeypatch.setattr(
        processes, "identity", lambda pid: Process(pid=pid, started="observed")
    )
    monkeypatch.setattr(os, "getpgid", lambda pid: pid + 1)
    with pytest.raises(RuntimeError, match="leader"):
        processes.cancel_process(Process(pid=123, started="observed"))


@pytest.mark.parametrize("visible", [True, False])
def test_worker_launch_records_identity(
    installation: Installation, monkeypatch: pytest.MonkeyPatch, visible: bool
) -> None:
    claim = existing(installation, 1)
    calls: list[object] = []

    class Child:
        pid = 123

        def __init__(self, command: list[str], **kwargs: object) -> None:
            calls.append(command)
            assert kwargs["start_new_session"] is True

    monkeypatch.setattr(subprocess, "Popen", Child)
    monkeypatch.setattr(
        processes,
        "identity",
        lambda pid: Process(pid=pid, started="now") if visible else None,
    )
    if visible:
        processes.launch(installation, claim)
        assert installation.claim(claim.id).status == "running"
    else:
        with pytest.raises(RuntimeError, match="before"):
            processes.launch(installation, claim)
    assert len(calls) == 1


def test_orphaned_native_group_prevents_false_completion() -> None:
    parent = subprocess.Popen(
        [
            sys.executable,
            "-c",
            "import subprocess,sys,time; subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)']); print('ready', flush=True); time.sleep(1)",
        ],
        start_new_session=True,
        stdout=subprocess.PIPE,
        text=True,
    )
    try:
        assert parent.stdout is not None
        assert parent.stdout.readline().strip() == "ready"
        observed = processes.identity(parent.pid)
        assert observed is not None
        parent.wait(timeout=5)
        assert processes.alive(observed)
        with pytest.raises(RuntimeError, match="surviving processes"):
            processes.cancel_process(observed)
    finally:
        os.killpg(parent.pid, signal.SIGTERM)
        parent.wait(timeout=5)


def test_reused_pid_cannot_authorize_cancellation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed = Process(pid=123, started="old")
    monkeypatch.setattr(
        processes, "identity", lambda pid: Process(pid=pid, started="new")
    )
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess([], 0, "123\n", ""),
    )
    assert processes.alive(observed)
    with pytest.raises(RuntimeError, match="reconcile"):
        processes.cancel_process(observed)
