from pathlib import Path

import pytest

from darrow_tickets_github.cli import main


@pytest.mark.parametrize(
    ("args", "status", "diagnostic"),
    [
        ([], 64, "usage: ticket"),
        (["unknown"], 64, "usage: ticket"),
        (["get"], 2, "get needs a ticket id or canonical URL"),
        (["get", "1", "2"], 2, "get accepts exactly one ticket reference"),
        (["close", "1", "2"], 2, "unknown close argument: 2"),
        (["list", "--limit", "0"], 2, "--limit must be a positive number"),
        (["list", "--state", "invalid"], 2, "--state must be open, closed or all"),
        (["create"], 2, "--title, --type and --body-file are required"),
        (["comment", "1"], 2, "--body-file required"),
        (["label", "1"], 2, "exactly one of --add or --remove"),
        (["relate", "1"], 2, "exactly one relation change per invocation"),
        (["relate", "1", "--parent", "01"], 2, "cannot relate to itself"),
    ],
)
def test_input_contract(
    args: list[str], status: int, diagnostic: str, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(args) == status
    captured = capsys.readouterr()
    assert diagnostic in captured.err
    assert captured.out == ""


def test_unreadable_body(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["comment", "1", "--body-file", str(tmp_path)]) == 2
    assert "body file is not a readable file" in capsys.readouterr().err
