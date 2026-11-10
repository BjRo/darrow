"""Two real CLI processes share repository admission and native-worker capacity."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from test_management_cli import initialize
from test_worker_cli import repository as repository
from test_worker_cli import services as services
from test_worker_cli import wait_stopped


def test_concurrent_workers_cannot_overfill_or_duplicate_work(
    repository: Path,
    services: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    site = initialize(repository, tmp_path / "state", monkeypatch, capsys)
    clone = tmp_path / "clone"
    subprocess.run(["git", "clone", "-q", str(repository), str(clone)], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(clone),
            "remote",
            "set-url",
            "origin",
            "https://github.com/o/r.git",
        ],
        check=True,
    )
    forge_path = services / "forge.json"
    forge = json.loads(forge_path.read_text())
    forge["ready"] = [1, 2]
    forge_path.write_text(json.dumps(forge))
    monkeypatch.setenv("ARTIFICER_HOLD", "1")
    command = str(Path(sys.executable).with_name("darrow-artificer"))
    children = [
        subprocess.Popen(
            [command, "tick"],
            cwd=checkout,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        for checkout in (repository, clone)
    ]
    try:
        results = []
        for child in children:
            output, errors = child.communicate(timeout=20)
            assert child.returncode == 0, errors
            results.append(json.loads(output))
        assert sum(len(result["admitted"]) for result in results) == 1
        observed = json.loads(forge_path.read_text())
        assert observed["ready"] == [2]
        assert observed["claimed"] == [1]
    finally:
        (services / "release-native").touch()
        for child in children:
            child.wait(timeout=20)
        if site.claims():
            wait_stopped(site)
