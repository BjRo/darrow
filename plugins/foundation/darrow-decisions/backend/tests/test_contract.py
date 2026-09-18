"""Public CLI acceptance before replacing the Bash implementation."""

import subprocess
from pathlib import Path

from darrow_decisions.cli import main


def test_empty_repository(tmp_path: Path, capsys: object) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    assert main(["validate", "--repo", str(tmp_path)]) == 0
