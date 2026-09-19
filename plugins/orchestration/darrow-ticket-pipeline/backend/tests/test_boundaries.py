"""Public malformed input, filesystem, and native path contracts."""

import sys
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_ticket_pipeline import cli, operations
from darrow_ticket_pipeline.artifacts import parse_artifact
from darrow_ticket_pipeline.model import ARTIFACT_FORMAT, HEADERS, PipelineError


def artifact(**changes: str) -> str:
    values = dict(
        zip(
            HEADERS,
            (ARTIFACT_FORMAT, "test-run", "refine", "1", "worker", "complete", "Done"),
            strict=True,
        )
    )
    values.update(changes)
    return (
        "".join(f"{key}\t{values[key]}\n" for key in HEADERS)
        + "---\n### Evidence\n\nPassed.\n"
    )


@pytest.mark.parametrize(
    "args,code",
    [
        ([], 64),
        (["unknown"], 64),
        (["init"], 2),
        (["init", "--unknown", "x"], 2),
        (["launch", "--phase"], 2),
        (["summary"], 2),
        (["summary", "--body-file", "missing"], 2),
        (["summary", "--body-file", "missing", "--body-file", "missing"], 2),
    ],
)
def test_cli_refusals(
    args: list[str], code: int, capsys: pytest.CaptureFixture[str]
) -> None:
    assert cli.main(args) == code
    captured = capsys.readouterr()
    assert not captured.out
    assert captured.err


@pytest.mark.parametrize(
    "field,value",
    [
        ("format", "other"),
        ("run_id", "bad id"),
        ("run_id", "x" * 129),
        ("phase", "other"),
        ("iteration", "0"),
        ("iteration", "-1"),
        ("iteration", "4"),
        ("agent", "pipe|value"),
        ("agent", "x" * 129),
        ("status", "approved"),
        ("summary", "x" * 501),
        ("summary", "two\tvalues"),
        ("summary", ""),
    ],
)
def test_artifact_invalid(field: str, value: str) -> None:
    with pytest.raises(PipelineError):
        parse_artifact(artifact(**{field: value}))


@pytest.mark.parametrize(
    "text",
    [
        "",
        "format\tx\n",
        artifact().replace("---", "bad"),
        artifact().split("---")[0] + "---\n",
        artifact() + "## Ticket Pipeline Phase State\n",
    ],
)
def test_artifact_shape(text: str) -> None:
    with pytest.raises(PipelineError):
        parse_artifact(text)


@settings(derandomize=True, max_examples=80)
@given(
    st.text(
        alphabet=st.characters(
            blacklist_categories=("Cs", "Cc"), blacklist_characters="|\r\n\t"
        ),
        min_size=1,
        max_size=128,
    )
)
def test_artifact_unicode_round_trip(summary: str) -> None:
    text = artifact(summary=summary)
    parsed = parse_artifact(text)
    assert parsed.summary == summary
    assert parsed.text == text


@pytest.mark.parametrize(
    "changes,code",
    [
        ({"phase": "unknown"}, 2),
        ({"iteration": "0"}, 2),
        ({"iteration": "four"}, 2),
        ({"iteration": "4"}, 4),
        ({"agent": "a|b"}, 4),
        ({"phase": "implement"}, 4),
    ],
)
def test_launch_refusals(initialized: Path, changes: dict[str, str], code: int) -> None:
    args = {
        "body-file": str(initialized),
        "phase": "refine",
        "iteration": "1",
        "agent": "worker",
        "harness": "codex",
        "model": "test-model",
        "effort": "medium",
        "output": str(initialized.parent / "candidate"),
    }
    args.update(changes)
    with pytest.raises(PipelineError) as error:
        operations.launch(args)
    assert error.value.code == code
    assert not Path(args["output"]).exists()


@pytest.mark.parametrize(
    "status", ["blocked", "failed", "budget_exhausted", "needs_human"]
)
def test_terminal_outcomes(initialized: Path, status: str) -> None:
    output = initialized.parent / "terminal.md"
    reason = initialized.parent / "reason.md"
    reason.write_bytes("A decision is required: café\n".encode())
    args = {"body-file": str(initialized), "output": str(output), "status": status}
    if status == "needs_human":
        args["reason-file"] = str(reason)
    assert f"status\t{status}\n" in operations.finish(args)
    assert "next_phase\tnone\n" in operations.summary({"body-file": str(output)})
    with pytest.raises(PipelineError):
        operations.finish(
            {
                **args,
                "body-file": str(output),
                "output": str(output.with_suffix(".next")),
            }
        )


@pytest.mark.parametrize(
    "status,reason",
    [
        ("wrong", None),
        ("needs_human", None),
        ("needs_human", ""),
        ("needs_human", "## Ticket Pipeline bad"),
        ("failed", "reason"),
    ],
)
def test_finish_refusals(initialized: Path, status: str, reason: str | None) -> None:
    args = {
        "body-file": str(initialized),
        "output": str(initialized.parent / "finish"),
        "status": status,
    }
    if reason is not None:
        path = initialized.parent / "reason"
        path.write_bytes(reason.encode())
        args["reason-file"] = str(path)
    with pytest.raises(PipelineError) as error:
        operations.finish(args)
    assert error.value.code == 2


@pytest.mark.parametrize(
    "mutation", ["duplicate", "heading", "state", "ledger", "field"]
)
def test_ticket_corruption(initialized: Path, mutation: str) -> None:
    text = initialized.read_text(encoding="utf-8")
    changes = {
        "duplicate": text + "\n## Ticket Pipeline Run\n",
        "heading": text + "\n## Ticket Pipeline Unknown\n",
        "state": text.replace("| refine | pending | 0 |", "| refine | pending | bad |"),
        "ledger": text
        + "| refine | 1 | worker | codex | model | medium | bogus | summary |\n",
        "field": text.replace("state\tactive", "state\tactive\nstate\tactive"),
    }
    initialized.write_bytes(changes[mutation].encode())
    with pytest.raises(PipelineError):
        operations.summary({"body-file": str(initialized)})


def test_process_entrypoint(
    initialized: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        ["darrow-ticket-pipeline", "summary", "--body-file", str(initialized)],
    )
    with pytest.raises(SystemExit) as exit_info:
        cli.entrypoint()
    assert exit_info.value.code == 0
    assert "next_phase\trefine\n" in capsys.readouterr().out


def test_filesystem_failure(initialized: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(args: dict[str, str]) -> str:
        raise OSError("disk failure")

    monkeypatch.setitem(cli.COMMANDS, "summary", fail)
    assert cli.main(["summary", "--body-file", str(initialized)]) == 2


def test_output_refusals_preserve_files(initialized: Path) -> None:
    before = initialized.read_bytes()
    for target in (initialized, initialized.parent / "absent" / "output"):
        with pytest.raises(PipelineError):
            operations.finish(
                {
                    "body-file": str(initialized),
                    "status": "blocked",
                    "output": str(target),
                }
            )
    assert initialized.read_bytes() == before


def test_concurrent_output_is_not_overwritten(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from darrow_ticket_pipeline import storage

    def raced_link(source: str, path: Path) -> None:
        path.write_bytes(b"other publisher")
        raise FileExistsError(path)

    monkeypatch.setattr("darrow_ticket_pipeline.storage.os.link", raced_link)
    output = tmp_path / "raced.md"
    with pytest.raises(PipelineError, match="refusing to overwrite"):
        storage.write(str(output), "ours")
    assert output.read_bytes() == b"other publisher"
    assert list(tmp_path.iterdir()) == [output]
