"""Native filesystem fixtures shared by command and property tests."""

from pathlib import Path

import pytest

from darrow_ticket_pipeline import operations


@pytest.fixture
def initialized(tmp_path: Path) -> Path:
    body = tmp_path / "ticket.md"
    baseline = tmp_path / "baseline.txt"
    output = tmp_path / "initialized.md"
    body.write_bytes(b"## Outcome\n\nKeep user content.\n")
    baseline.write_bytes(b"")
    operations.init(
        {
            "body-file": str(body),
            "baseline-file": str(baseline),
            "run-id": "test-run",
            "repo": str(tmp_path),
            "base-revision": "abc123",
            "output": str(output),
        }
    )
    return output
