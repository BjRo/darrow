"""The shared fixture forwards the real collaborator and retains each snapshot."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from context_fixture import capture, prepare
from eval_context_usage import verify


@pytest.mark.parametrize("format_name", ["json", "grid"])
@pytest.mark.parametrize("status", [0, 7])
def test_capture_preserves_results(
    tmp_path: Path, format_name: str, status: int
) -> None:
    git = tmp_path / ".git"
    git.mkdir()
    (git / "context-uv").write_text(sys.executable, encoding="utf-8")
    output = (
        json.dumps(
            {
                "schema_version": 1,
                "rollout_path": str(tmp_path / "rollout-date-fixture.jsonl"),
                "categories": {"messages": 3},
                "exact_total_tokens": 20,
                "remainder_tokens": 17,
            }
        )
        if format_name == "json"
        else "Codex context\n20 / 1,000 tokens\nCategory\nRest: 980 tokens\n"
    )
    arguments = [
        "-c",
        'import sys; sys.stdout.buffer.write(sys.argv[1].encode()); sys.stderr.buffer.write(b"diagnostic"); sys.exit(int(sys.argv[2]))',
        output,
        str(status),
        "--no-project",
        "ia-context",
        "--format",
        format_name,
    ]
    result = capture(tmp_path, arguments)
    assert result.returncode == status
    assert result.stdout == output.encode()
    assert result.stderr == b"diagnostic"
    records = list((tmp_path / ".fixture-state/context-capture").iterdir())
    assert len(records) == 1
    assert (records[0] / "arguments").read_text().splitlines() == "\n".join(
        arguments
    ).splitlines()


def test_prepare_shares_tools_and_hides_oracle(tmp_path: Path) -> None:
    prepare(tmp_path)
    assert (tmp_path / ".git/fixture-bin/context_fixture.py").is_file()
    assert (tmp_path / ".git/eval-checks/ia/eval_context_usage.py").is_file()
    assert not (tmp_path / ".fixture-state/context-capture").exists()
    assert (tmp_path / ".git/ia-backend/src/darrow_ia/context.py").is_file()


def test_captured_snapshot_verifies(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git/context-uv").write_text(sys.executable, encoding="utf-8")
    monkeypatch.setenv("CODEX_THREAD_ID", "fixture")
    output = "Codex context\n20 / 1,000 tokens\nCategory\nRest: 980 tokens\n"
    result = capture(
        tmp_path,
        [
            "-c",
            "import sys; sys.stdout.buffer.write(sys.argv[1].encode())",
            output,
            "--no-project",
            "ia-context",
            "--format",
            "grid",
        ],
    )
    assert result.stdout.decode() == output
    verify(tmp_path, "grid")


def test_uncaptured_forwarding_preserves_process(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git/context-uv").write_text(sys.executable, encoding="utf-8")
    script = Path(__file__).with_name("context_fixture.py")
    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "capture",
            str(tmp_path),
            "-c",
            "import sys; sys.stdout.buffer.write(bytes([117, 110, 99, 104, 97, 110, 103, 101, 100, 10])); sys.exit(9)",
        ],
        capture_output=True,
        check=False,
        env=dict(os.environ),
    )
    assert result.returncode == 9 and result.stdout == b"unchanged\n"
    assert not (tmp_path / ".fixture-state/context-capture").exists()
