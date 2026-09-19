import os
import sys
from collections.abc import Sequence
from io import BytesIO, TextIOWrapper
from pathlib import Path

import pytest

from darrow_verification import assessment as renderer
from darrow_verification.assessment import main


def run(arguments: Sequence[str]) -> tuple[int, bytes, bytes]:
    stdout = BytesIO()
    stderr = BytesIO()
    status = main(arguments, stdout=stdout, stderr=stderr)
    return status, stdout.getvalue(), stderr.getvalue()


def valid_arguments(assessment: Path, report: Path) -> tuple[str, ...]:
    return (
        "--assessment",
        str(assessment),
        "--provider-report",
        str(report),
    )


def destination_bytes(path: Path) -> bytes:
    return os.fsencode(renderer.escape_destination(str(path)))


def test_renders_multiline_assessment_and_exact_report_link(tmp_path: Path) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(
        b"Conclusion: progress.\n\nF1 remains blocking; A1 is advisory.\n"
    )
    report.write_bytes(b"Complete provider report, unchanged.\n")

    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 0
    assert stderr == b""
    assert stdout == (
        assessment.read_bytes()
        + b"\n\nComplete provider result: [report](<"
        + destination_bytes(report)
        + b">)\n"
    )


def test_preserves_assessment_without_a_terminal_newline(tmp_path: Path) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Conclusion: clear.")
    report.write_bytes(b"Provider result.\n")

    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 0
    assert stderr == b""
    assert stdout == (
        b"Conclusion: clear.\n\nComplete provider result: [report](<"
        + destination_bytes(report)
        + b">)\n"
    )


def test_resolves_a_symlinked_parent_without_resolving_the_file_name(
    tmp_path: Path,
) -> None:
    actual = tmp_path / "actual"
    actual.mkdir()
    alias = tmp_path / "alias"
    try:
        alias.symlink_to(actual, target_is_directory=True)
    except OSError:
        pytest.skip("directory symlinks are unavailable")
    assessment = actual / "assessment.md"
    report = actual / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")

    status, stdout, stderr = run(valid_arguments(assessment, alias / report.name))

    assert status == 0
    assert stderr == b""
    assert stdout.endswith(
        b"Complete provider result: [report](<" + destination_bytes(report) + b">)\n"
    )


def test_escapes_only_markdown_uri_delimiters_in_order(tmp_path: Path) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report [one](two) #%.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")

    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 0
    assert stderr == b""
    escaped = str(report).replace("%", "%25").replace(" ", "%20")
    escaped = escaped.replace("#", "%23").replace("<", "%3C").replace(">", "%3E")
    escaped = escaped.replace("\\", "%5C")
    assert stdout.endswith(
        f"Complete provider result: [report](<{escaped}>)\n".encode()
    )


@pytest.mark.parametrize(
    "arguments",
    [
        (),
        ("--assessment",),
        ("--assessment", "a", "--provider-report"),
        ("--unknown", "a", "--provider-report", "b"),
        ("--provider-report", "b", "--assessment", "a"),
        ("--assessment=a", "--provider-report=b"),
        ("--assessment", "a", "--provider-report", "b", "extra"),
    ],
)
def test_refuses_malformed_arguments(arguments: Sequence[str]) -> None:
    status, stdout, stderr = run(arguments)

    assert status == 2
    assert stdout == b""
    assert stderr == (
        b"render-assessment: usage: render-assessment --assessment ABSOLUTE_FILE "
        b"--provider-report ABSOLUTE_FILE\n"
    )


def test_validates_assessment_before_provider_report(tmp_path: Path) -> None:
    status, stdout, stderr = run(
        ("--assessment", "relative.md", "--provider-report", "also-relative.md")
    )

    assert status == 2
    assert stdout == b""
    assert stderr == b"render-assessment: assessment requires an absolute path\n"

    assessment = tmp_path / "assessment.md"
    assessment.write_bytes(b"Assessment.\n")
    status, stdout, stderr = run(
        valid_arguments(assessment, Path("relative-report.md"))
    )

    assert status == 2
    assert stdout == b""
    assert stderr == b"render-assessment: provider-report requires an absolute path\n"


@pytest.mark.parametrize("label", ["assessment", "provider-report"])
@pytest.mark.parametrize("kind", ["missing", "empty", "directory"])
def test_refuses_unavailable_inputs(tmp_path: Path, label: str, kind: str) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")
    invalid = tmp_path / kind
    if kind == "empty":
        invalid.write_bytes(b"")
    elif kind == "directory":
        invalid.mkdir()
    arguments = list(valid_arguments(assessment, report))
    arguments[1 if label == "assessment" else 3] = str(invalid)

    status, stdout, stderr = run(arguments)

    assert status == 2
    assert stdout == b""
    assert stderr == (
        f"render-assessment: {label} is not a readable nonempty regular file: "
        f"{invalid}\n".encode()
    )


@pytest.mark.parametrize("label", ["assessment", "provider-report"])
@pytest.mark.parametrize("control", ["\n", "\t", "\r", "\x7f"])
def test_refuses_control_characters_in_paths(
    tmp_path: Path, label: str, control: str
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")
    arguments = list(valid_arguments(assessment, report))
    arguments[1 if label == "assessment" else 3] = str(tmp_path / f"bad{control}path")

    status, stdout, stderr = run(arguments)

    assert status == 2
    assert stdout == b""
    assert (
        stderr
        == f"render-assessment: {label} path contains a control character\n".encode()
    )


def test_treats_a_filesystem_probe_error_as_an_unavailable_input(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")

    def refuse_probe(_path: Path) -> bool:
        raise OSError("probe failed")

    monkeypatch.setattr(Path, "is_file", refuse_probe)
    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 2
    assert stdout == b""
    assert stderr == (
        b"render-assessment: assessment is not a readable nonempty regular file: "
        + str(assessment).encode()
        + b"\n"
    )


def test_treats_an_open_error_as_an_unavailable_input(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")

    def refuse_open(_path: Path, _mode: str) -> object:
        raise OSError("open failed")

    monkeypatch.setattr(Path, "open", refuse_open)
    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 2
    assert stdout == b""
    assert stderr == (
        b"render-assessment: assessment is not a readable nonempty regular file: "
        + str(assessment).encode()
        + b"\n"
    )


def test_translates_an_assessment_read_race_to_the_stable_refusal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")

    def refuse_read(_path: Path) -> bytes:
        raise OSError("read failed")

    monkeypatch.setattr(Path, "read_bytes", refuse_read)
    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 2
    assert stdout == b""
    assert stderr == (
        b"render-assessment: assessment is not a readable nonempty regular file: "
        + str(assessment).encode()
        + b"\n"
    )


def test_reports_an_unresolvable_input_parent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"

    monkeypatch.setattr(renderer, "_is_readable_nonempty_file", lambda _path: True)

    def refuse_resolution(_path: Path, *, strict: bool = False) -> Path:
        del strict
        raise OSError("resolution failed")

    monkeypatch.setattr(Path, "resolve", refuse_resolution)
    status, stdout, stderr = run(valid_arguments(assessment, report))

    assert status == 2
    assert stdout == b""
    assert stderr == (
        b"render-assessment: cannot resolve assessment parent: "
        + str(assessment).encode()
        + b"\n"
    )


def test_console_entrypoint_uses_binary_standard_streams(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assessment = tmp_path / "assessment.md"
    report = tmp_path / "report.md"
    assessment.write_bytes(b"Assessment.\n")
    report.write_bytes(b"Report.\n")
    stdout_bytes = BytesIO()
    stderr_bytes = BytesIO()
    stdout = TextIOWrapper(stdout_bytes, encoding="utf-8")
    stderr = TextIOWrapper(stderr_bytes, encoding="utf-8")
    monkeypatch.setattr(
        sys,
        "argv",
        ["darrow-render-assessment", *valid_arguments(assessment, report)],
    )
    monkeypatch.setattr(sys, "stdout", stdout)
    monkeypatch.setattr(sys, "stderr", stderr)

    with pytest.raises(SystemExit) as raised:
        renderer.entrypoint()

    assert raised.value.code == 0
    assert stderr_bytes.getvalue() == b""
    assert stdout_bytes.getvalue().startswith(b"Assessment.\n")
