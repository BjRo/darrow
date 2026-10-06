"""Cross-platform output contracts for copied-plugin validation."""

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

import fresh_install


@pytest.mark.parametrize("ending", [b"\n", b"\r\n"])
def test_valid_inspection_accepts_native_line_endings(
    tmp_path: Path, ending: bytes
) -> None:
    inspection = ending.join(
        [b"format\tdarrow-skill-inspection-v1", b"status\tvalid", b""]
    )
    matrix = "format\tdarrow-shell-test-matrix-v1\n" + "".join(
        f"test_result\tbash-5\t{name}\tpassed\n"
        for name in (
            "inspect-skill.test.sh",
            "verify-shell-tests.test.sh",
            "interpreter-routing.test.sh",
        )
    )
    result = subprocess.CompletedProcess(
        ["verify-shell-tests"], 3, stdout=matrix, stderr=""
    )
    with (
        patch.object(fresh_install, "command", return_value=inspection),
        patch.object(subprocess, "run", return_value=result),
    ):
        fresh_install.validate(tmp_path / "backend", tmp_path)


@pytest.mark.parametrize(
    "inspection",
    [b"status\tinvalid\r\n", b"status\tvalid-extra\r\n", b"name\tvalid\r\n"],
)
def test_invalid_inspection_stops_validation(tmp_path: Path, inspection: bytes) -> None:
    with (
        patch.object(fresh_install, "command", return_value=inspection),
        patch.object(subprocess, "run") as run,
        pytest.raises(AssertionError),
    ):
        fresh_install.validate(tmp_path / "backend", tmp_path)
    run.assert_not_called()
