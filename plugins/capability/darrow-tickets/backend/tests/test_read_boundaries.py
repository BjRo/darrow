from collections.abc import Callable

import pytest

from darrow_tickets.cli import main

from .conftest import Backend


@pytest.mark.parametrize(("body", "status"), [(None, 0), (42, 4)])
def test_body_shape(
    body: object, status: int, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "issue",
        "view",
        "12",
        "--json",
        "number,state,title,url,labels",
        data={
            "number": 12,
            "state": "OPEN",
            "title": "T",
            "url": "https://github.test/o/r/issues/12",
            "labels": [],
        },
    )
    backend.expect("issue", "view", "12", "--json", "body", data={"body": body})
    if not status:
        backend.parent()
        backend.deps([])
    assert main(["get", "12"]) == status
    captured = capsys.readouterr()
    assert ("## body\n\n" in captured.out) == (status == 0)
    assert not backend.replies


def test_trailing_empty_section(
    backend: Backend, body_file: Callable[[str], str]
) -> None:
    assert (
        main(
            [
                "create",
                "--title",
                "T",
                "--type",
                "task",
                "--body-file",
                body_file("## Outcome\nx\n## Done criteria\n\n"),
            ]
        )
        == 7
    )
    assert not backend.calls


def test_relation_failure_emits_no_partial_ticket(
    backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "issue",
        "view",
        "12",
        "--json",
        "number,state,title,url,labels",
        data={
            "number": 12,
            "state": "OPEN",
            "title": "T",
            "url": "https://github.test/o/r/issues/12",
            "labels": [],
        },
    )
    backend.expect(
        "issue", "view", "12", "--json", "body", data={"body": "must not leak"}
    )
    backend.expect(
        "api", "repos/{owner}/{repo}/issues/12/parent", status=1, output="", error=""
    )
    assert main(["get", "12"]) == 4
    assert capsys.readouterr().out == ""
