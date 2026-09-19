"""Replay pre-migration public command observations without a Bash dependency."""

import hashlib
import json
from pathlib import Path
from typing import TypedDict, cast

import pytest

from darrow_ticket_pipeline.cli import main


class Case(TypedDict):
    args: list[str]
    inputs: dict[str, str]
    code: int
    stdout: str
    output: str | None


class Reference(TypedDict):
    source: str
    files: dict[str, str]
    cases: list[Case]


REFERENCE = cast(
    Reference,
    json.loads(Path(__file__).with_name("reference.json").read_text(encoding="utf-8")),
)


@pytest.mark.parametrize("case", REFERENCE["cases"])
def test_reference(
    case: Case, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = str(tmp_path)
    for name, digest in case["inputs"].items():
        path = Path(name.replace("<ROOT>", root))
        path.write_bytes(
            REFERENCE["files"][digest].replace("<ROOT>", root).encode("utf-8")
        )
    args = [a.replace("<ROOT>", root) for a in case["args"]]
    assert main(args) == case["code"]
    captured = capsys.readouterr()
    assert (
        captured.out.replace(root, "<ROOT>").replace("<ROOT>\\", "<ROOT>/")
        == case["stdout"]
    )
    assert bool(captured.err) == (case["code"] != 0)
    if "--output" in args:
        output = Path(args[args.index("--output") + 1])
        assert output.exists() == (case["output"] is not None)
        if output.exists():
            normalized = output.read_bytes().decode("utf-8").replace(root, "<ROOT>")
            assert (
                hashlib.sha256(normalized.encode("utf-8")).hexdigest() == case["output"]
            )
