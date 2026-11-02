"""Root metric evidence rejects fabricated numbers and missing reports."""

import json
import subprocess
from pathlib import Path

import pytest
from eval_root_metrics import verify


def test_root_metric_artifact_matches_git_and_files(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / "AGENTS.md").write_bytes(b"abcdefgh")
    (tmp_path / "CLAUDE.md").write_bytes(b"abcdefghijkl")
    subprocess.run(
        ["git", "-C", str(tmp_path), "add", "AGENTS.md", "CLAUDE.md"], check=True
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(tmp_path),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "-qm",
            "initial",
        ],
        check=True,
    )
    (tmp_path / "AGENTS.md").write_bytes(b"abcd")
    output = tmp_path / ".fixture-state/root-metrics.json"
    output.parent.mkdir()
    report = {
        "codex": {
            "before": {"bytes": 8, "tokens": 2},
            "after": {"bytes": 4, "tokens": 1},
        },
        "claude": {
            "before": {"bytes": 12, "tokens": 3},
            "after": {"bytes": 12, "tokens": 3},
        },
    }
    output.write_text(json.dumps(report), encoding="utf-8")
    verify(tmp_path)
    report["codex"]["after"]["bytes"] = 8
    output.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(AssertionError):
        verify(tmp_path)
    output.unlink()
    with pytest.raises(FileNotFoundError):
        verify(tmp_path)
