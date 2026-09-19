"""Exercise installed path records under the older Windows startup encoding."""

from __future__ import annotations

import csv
import hashlib
import io
import shutil
import subprocess
import sys
from base64 import urlsafe_b64encode
from pathlib import Path
from zipfile import ZipFile

import pytest

from darrow_adaptive_delivery._build_backend import build_editable
from darrow_adaptive_delivery.common import PLUGIN


def startup_records(artifact: Path) -> str:
    with ZipFile(artifact) as wheel:
        startup = "\n".join(
            wheel.read(name).decode("cp1252")
            for name in wheel.namelist()
            if name.endswith(".pth")
        )
        record = next(
            name for name in wheel.namelist() if name.endswith(".dist-info/RECORD")
        )
        for name, digest, size in csv.reader(io.StringIO(wheel.read(record).decode())):
            if name == record:
                continue
            data = wheel.read(name)
            assert (
                digest
                == "sha256="
                + urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
            )
            assert size == str(len(data))
    return startup


def test_editable_startup_with_legacy_path_decoding(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    backend = tmp_path / "package with spaces-é漢" / "backend"
    shutil.copytree(
        PLUGIN / "backend",
        backend,
        ignore=shutil.ignore_patterns(".venv", "__pycache__", ".*cache", "tests"),
    )
    monkeypatch.chdir(backend)
    wheels = tmp_path / "wheels"
    wheels.mkdir()
    artifact = wheels / build_editable(str(wheels))
    startup = startup_records(artifact)
    code = (
        "import sys, os\n"
        f"for line in {startup!r}.splitlines():\n"
        "    if line.startswith(('import ', 'import\\t')):\n"
        "        exec(line)\n"
        "    elif os.path.exists(line):\n"
        "        sys.path.append(line)\n"
        "from darrow_adaptive_delivery.cli import preflight\n"
        "raise SystemExit(preflight())\n"
    )
    result = subprocess.run(
        [sys.executable, "-S", "-c", code, "--help"], capture_output=True, check=False
    )
    assert result.returncode == 0, result.stderr
    assert b"adaptive-delivery-preflight prepare" in result.stdout
