from collections.abc import Sequence

import pytest

from darrow_discovery.frontier import PROGRAM_NAME, main

VALID_ARGUMENTS = (
    "--evidence",
    "The repository stores records in one region today.",
    "--question",
    "Data region: Should storage be single-region or multi-region?",
    "--option",
    "single-region",
    "--option",
    "multi-region",
    "--choice",
    "single-region",
    "--rationale",
    "it satisfies the stated residency boundary with less operational coupling",
    "--deferred",
    "storage vendor and migration path",
)


def run(
    arguments: Sequence[str], capsys: pytest.CaptureFixture[str]
) -> tuple[int, str, str]:
    status = main(arguments)
    captured = capsys.readouterr()
    return status, captured.out, captured.err


def replace(arguments: Sequence[str], flag: str, value: str) -> tuple[str, ...]:
    updated = list(arguments)
    updated[updated.index(flag) + 1] = value
    return tuple(updated)


def test_renders_the_exact_frontier(capsys: pytest.CaptureFixture[str]) -> None:
    status, stdout, stderr = run(VALID_ARGUMENTS, capsys)

    assert status == 0
    assert stderr == ""
    assert stdout == (
        "Evidence: The repository stores records in one region today.\n\n"
        "Q1 — Data region: Should storage be single-region or multi-region?\n\n"
        "Recommendation: Choose single-region because it satisfies the stated "
        "residency boundary with less operational coupling.\n\n"
        "Deferred: storage vendor and migration path. After your answer, I will "
        "recompute the next frontier.\n"
    )


def test_removes_one_existing_period_from_rendered_fields(
    capsys: pytest.CaptureFixture[str],
) -> None:
    arguments = replace(VALID_ARGUMENTS, "--evidence", "Evidence..")
    arguments = replace(arguments, "--rationale", "Rationale.")
    arguments = replace(arguments, "--deferred", "Deferred.")

    status, stdout, stderr = run(arguments, capsys)

    assert status == 0
    assert stderr == ""
    assert stdout.startswith("Evidence: Evidence..\n\n")
    assert "because Rationale.\n\n" in stdout
    assert stdout.endswith(
        "Deferred: Deferred. After your answer, I will recompute the next frontier.\n"
    )


@pytest.mark.parametrize(
    ("arguments", "diagnostic"),
    [
        ((), "every frontier field must be non-empty"),
        (("--evidence",), None),
        (("--unknown", "value"), None),
        (
            replace(VALID_ARGUMENTS, "--choice", "global"),
            "the recommended choice must equal one declared root option",
        ),
        (
            replace(
                VALID_ARGUMENTS,
                "--question",
                "Scope: single-region? Another question?",
            ),
            "the root question must contain exactly one question mark",
        ),
        (
            replace(
                VALID_ARGUMENTS,
                "--question",
                "Scope: single-region or multi-region",
            ),
            "the root question must contain exactly one question mark",
        ),
        (
            replace(VALID_ARGUMENTS, "--question", "Scope: single-region only?"),
            "root option 'multi-region' is absent from the question",
        ),
        (
            replace(
                VALID_ARGUMENTS,
                "--question",
                "Scope: single-region (local) or multi-region?",
            ),
            "the root question must use short option labels without parenthesized mechanics",
        ),
        (
            replace(VALID_ARGUMENTS, "--rationale", "Which interface?"),
            "only the root question may ask a question",
        ),
        (
            replace(VALID_ARGUMENTS, "--deferred", "Which migration?"),
            "only the root question may ask a question",
        ),
        (
            replace(VALID_ARGUMENTS, "--deferred", "parameter vs setter"),
            "deferred decisions must be category names without child-option examples",
        ),
        (
            replace(VALID_ARGUMENTS, "--deferred", "parameter versus setter"),
            "deferred decisions must be category names without child-option examples",
        ),
        (
            replace(VALID_ARGUMENTS, "--deferred", "interface (parameter)"),
            "deferred decisions must be category names without child-option examples",
        ),
    ],
)
def test_refuses_invalid_invocations(
    arguments: Sequence[str],
    diagnostic: str | None,
    capsys: pytest.CaptureFixture[str],
) -> None:
    status, stdout, stderr = run(arguments, capsys)

    assert status == 2
    assert stdout == ""
    if diagnostic is None:
        assert stderr == (
            f"usage: {PROGRAM_NAME} --evidence TEXT --question TEXT --option LABEL "
            "--option LABEL [--option LABEL ...] --choice LABEL "
            "--rationale TEXT --deferred TEXT\n"
        )
    else:
        assert stderr == f"{diagnostic}\n"


@pytest.mark.parametrize(
    "flag", ["--evidence", "--question", "--choice", "--rationale", "--deferred"]
)
@pytest.mark.parametrize("value", ["", "first line\nsecond line"])
def test_refuses_empty_and_multiline_fields(
    flag: str,
    value: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    status, stdout, stderr = run(replace(VALID_ARGUMENTS, flag, value), capsys)

    assert status == 2
    assert stdout == ""
    expected = (
        "every frontier field must be non-empty"
        if value == ""
        else "frontier fields must each be one line"
    )
    assert stderr == f"{expected}\n"


@pytest.mark.parametrize("value", ["", "first line\nsecond line"])
def test_refuses_empty_and_multiline_options(
    value: str, capsys: pytest.CaptureFixture[str]
) -> None:
    arguments = replace(VALID_ARGUMENTS, "--option", value)
    status, stdout, stderr = run(arguments, capsys)

    assert status == 2
    assert stdout == ""
    expected = (
        "root option labels must be non-empty"
        if value == ""
        else "root option labels must each be one line"
    )
    assert stderr == f"{expected}\n"


def test_requires_two_option_labels(capsys: pytest.CaptureFixture[str]) -> None:
    arguments = list(VALID_ARGUMENTS)
    second = arguments.index("--option", arguments.index("--option") + 1)
    del arguments[second : second + 2]

    status, stdout, stderr = run(arguments, capsys)

    assert status == 2
    assert stdout == ""
    assert stderr == "the root question must declare at least two option labels\n"


def test_matches_options_and_choice_without_case_sensitivity(
    capsys: pytest.CaptureFixture[str],
) -> None:
    arguments = replace(VALID_ARGUMENTS, "--question", "Scope: LOCAL or SHARED?")
    arguments = replace(arguments, "--option", "local")
    second = arguments.index("--option", arguments.index("--option") + 1)
    mutable = list(arguments)
    mutable[second + 1] = "shared"
    arguments = replace(mutable, "--choice", "LOCAL")

    status, stdout, stderr = run(arguments, capsys)

    assert status == 0
    assert stderr == ""
    assert "Recommendation: Choose LOCAL" in stdout


def test_matches_non_ascii_options_and_choice_without_case_sensitivity(
    capsys: pytest.CaptureFixture[str],
) -> None:
    arguments = replace(VALID_ARGUMENTS, "--question", "Mode: ä or b?")
    arguments = replace(arguments, "--option", "Ä")
    second = arguments.index("--option", arguments.index("--option") + 1)
    mutable = list(arguments)
    mutable[second + 1] = "b"
    arguments = replace(mutable, "--choice", "ä")

    status, stdout, stderr = run(arguments, capsys)

    assert status == 0
    assert stderr == ""
    assert "Recommendation: Choose ä" in stdout


def test_last_repeated_scalar_value_wins(capsys: pytest.CaptureFixture[str]) -> None:
    arguments = ("--evidence", "Ignored evidence", *VALID_ARGUMENTS)

    status, stdout, stderr = run(arguments, capsys)

    assert status == 0
    assert stderr == ""
    assert stdout.startswith(
        "Evidence: The repository stores records in one region today.\n"
    )
