from collections.abc import Callable

import pytest

from darrow_tickets_github.cli import main

from .conftest import Backend

BUG_BODY = "## Observed\nx\n## Expected\ny\n## Reproduction\nz\n"


@pytest.mark.parametrize("mapped", [True, False])
def test_create_metadata(
    mapped: bool,
    backend: Backend,
    body_file: Callable[[str], str],
    capsys: pytest.CaptureFixture[str],
) -> None:
    backend.labels(*(["bug", "-triage"] if mapped else ["-triage"]))
    labels = ["-triage", "bug"] if mapped else ["-triage"]
    options = [value for label in labels for value in ("--label", label)]
    backend.expect(
        "issue",
        "create",
        "--title",
        "A title",
        "--body-file",
        "<body>",
        *options,
        "--milestone",
        "v1",
        "--assignee",
        "octocat",
        output="https://github.test/o/r/issues/99\n",
        payload=BUG_BODY.encode(),
    )
    assert (
        main(
            [
                "create",
                "--title",
                "A title",
                "--type",
                "bug",
                "--body-file",
                body_file(BUG_BODY + "\n"),
                "--label",
                "-triage",
                "--milestone",
                "v1",
                "--assignee",
                "octocat",
            ]
        )
        == 0
    )
    output = capsys.readouterr().out
    assert "created: #99 https://github.test/o/r/issues/99" in output
    assert ("no existing label" in output) != mapped
    assert all(not path.exists() for path in backend.paths)
    assert not backend.replies


def test_create_relations_partial_failure(
    backend: Backend,
    body_file: Callable[[str], str],
    capsys: pytest.CaptureFixture[str],
) -> None:
    backend.labels("bug")
    backend.verify("3")
    backend.verify("7")
    backend.expect(
        "issue",
        "create",
        "--title",
        "T",
        "--body-file",
        "<body>",
        "--label",
        "bug",
        output="https://github.test/o/r/issues/99\n",
        payload=BUG_BODY.encode(),
    )
    backend.expect("api", "repos/{owner}/{repo}/issues/3", data={"id": 10003})
    backend.expect(
        "api",
        "-X",
        "POST",
        "repos/{owner}/{repo}/issues/99/dependencies/blocked_by",
        "-F",
        "issue_id=10003",
        output="",
    )
    backend.expect("api", "repos/{owner}/{repo}/issues/99", data={"id": 10099})
    backend.expect(
        "api",
        "-X",
        "POST",
        "repos/{owner}/{repo}/issues/7/sub_issues",
        "-F",
        "sub_issue_id=10099",
        output="",
        error="gh: rejected parent\n",
        status=1,
    )
    assert (
        main(
            [
                "create",
                "--title",
                "T",
                "--type",
                "bug",
                "--label",
                "bug",
                "--body-file",
                body_file(BUG_BODY),
                "--depends-on",
                "3",
                "--parent",
                "7",
            ]
        )
        == 4
    )
    captured = capsys.readouterr()
    assert "created: #99" in captured.out
    assert "depends-on: #3 recorded" in captured.out
    assert "parent: #7 recorded" not in captured.out
    assert captured.err == "gh: rejected parent\n"
    assert not backend.replies


def test_create_parent(
    backend: Backend,
    body_file: Callable[[str], str],
    capsys: pytest.CaptureFixture[str],
) -> None:
    backend.labels("bug")
    backend.verify("7")
    backend.expect(
        "issue",
        "create",
        "--title",
        "T",
        "--body-file",
        "<body>",
        "--label",
        "bug",
        output="https://github.test/o/r/issues/99",
        payload=BUG_BODY.encode(),
    )
    backend.expect("api", "repos/{owner}/{repo}/issues/99", data={"id": 10099})
    backend.expect(
        "api",
        "-X",
        "POST",
        "repos/{owner}/{repo}/issues/7/sub_issues",
        "-F",
        "sub_issue_id=10099",
    )
    assert (
        main(
            [
                "create",
                "--title",
                "T",
                "--type",
                "bug",
                "--body-file",
                body_file(BUG_BODY),
                "--parent",
                "7",
            ]
        )
        == 0
    )
    assert "parent: #7 recorded" in capsys.readouterr().out


@pytest.mark.parametrize("command", ["comment", "describe"])
def test_body_mutation(
    command: str,
    backend: Backend,
    body_file: Callable[[str], str],
    capsys: pytest.CaptureFixture[str],
) -> None:
    payload = "Exact CRLF.\r\n\n"
    path = body_file(payload)
    backend.verify()
    operation = "comment" if command == "comment" else "edit"
    backend.expect(
        "issue",
        operation,
        "12",
        "--body-file",
        path,
        output="https://github.test/o/r/issues/12#issuecomment-1",
    )
    assert main([command, "#0012", "--body-file", path]) == 0
    assert (
        "commented" if command == "comment" else "description replaced"
    ) in capsys.readouterr().out
    assert not backend.replies


@pytest.mark.parametrize(
    ("command", "state", "status"),
    [
        ("close", "OPEN", 0),
        ("close", "CLOSED", 9),
        ("reopen", "CLOSED", 0),
        ("reopen", "OPEN", 9),
    ],
)
def test_transition(
    command: str,
    state: str,
    status: int,
    backend: Backend,
    capsys: pytest.CaptureFixture[str],
) -> None:
    backend.verify(state=state)
    if not status:
        backend.expect("issue", command, "12", output="")
    assert main([command, "12"]) == status
    captured = capsys.readouterr()
    assert ("already" in captured.err) == bool(status)
    assert not backend.replies


@pytest.mark.parametrize(
    ("operation", "value", "status"),
    [
        ("add", "-triage", 0),
        ("add", "bug", 9),
        ("add", "unknown", 8),
        ("remove", "bug", 0),
        ("remove", "unknown", 9),
        ("add", "a,b", 8),
        ("remove", "a,b", 8),
    ],
)
def test_label(operation: str, value: str, status: int, backend: Backend) -> None:
    backend.verify()
    backend.expect(
        "issue",
        "view",
        "12",
        "--json",
        "labels",
        data={"labels": [{"name": "bug"}, {"name": "a,b"}]},
    )
    if operation == "add" and "," not in value:
        backend.labels("bug", "-triage")
    if not status:
        backend.expect("issue", "edit", "12", f"--{operation}-label", value)
    assert main(["label", "12", f"--{operation}", value]) == status
    assert not backend.replies


@pytest.mark.parametrize("remove", [False, True])
def test_dependency_change(
    remove: bool, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.verify()
    if not remove:
        backend.verify("41")
    backend.deps(list(range(1, 31)), list(range(31, 42 if remove else 41)))
    backend.expect("api", "repos/{owner}/{repo}/issues/41", data={"id": 10041})
    endpoint = "repos/{owner}/{repo}/issues/12/dependencies/blocked_by"
    if remove:
        backend.expect("api", "-X", "DELETE", endpoint + "/10041")
    else:
        backend.expect("api", "-X", "POST", endpoint, "-F", "issue_id=10041")
    backend.parent()
    backend.deps(list(range(1, 41 if remove else 42)))
    flag = "--remove-depends-on" if remove else "--depends-on"
    assert main(["relate", "12", flag, "041"]) == 0
    captured = capsys.readouterr()
    assert ("removed" if remove else "recorded") in captured.out
    assert "depends-on: #1 #2" in captured.out
    assert not backend.replies


@pytest.mark.parametrize("remove", [False, True])
def test_parent_change(
    remove: bool, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.verify()
    backend.parent(parent=7 if remove else None)
    if not remove:
        backend.verify("7")
    backend.expect("api", "repos/{owner}/{repo}/issues/12", data={"id": 10012})
    method, suffix = ("DELETE", "sub_issue") if remove else ("POST", "sub_issues")
    backend.expect(
        "api",
        "-X",
        method,
        f"repos/{{owner}}/{{repo}}/issues/7/{suffix}",
        "-F",
        "sub_issue_id=10012",
    )
    backend.parent(parent=None if remove else 7)
    backend.deps([])
    flags = ["--remove-parent"] if remove else ["--parent", "7"]
    assert main(["relate", "12", *flags]) == 0
    assert ("removed" if remove else "recorded") in capsys.readouterr().out
    assert not backend.replies


@pytest.mark.parametrize(
    "operation", ["depends-on", "remove-depends-on", "parent", "remove-parent"]
)
def test_relation_noop(operation: str, backend: Backend) -> None:
    backend.verify()
    if operation.endswith("parent"):
        backend.parent(parent=7 if operation == "parent" else None)
    else:
        if operation == "depends-on":
            backend.verify("7")
        backend.deps([7] if operation == "depends-on" else [])
    flags = (
        ["--remove-parent"] if operation == "remove-parent" else [f"--{operation}", "7"]
    )
    assert main(["relate", "12", *flags]) == 9
    assert not backend.replies


@pytest.mark.parametrize("operation", ["--depends-on", "--remove-depends-on"])
def test_failed_second_page_stops_mutation(
    operation: str, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.verify()
    if operation == "--depends-on":
        backend.verify("41")
    backend.expect(
        "api",
        "repos/{owner}/{repo}/issues/12/dependencies/blocked_by",
        "--paginate",
        "--slurp",
        status=1,
        output='[{"number": 1}]\n',
        error="gh: page 2 failed\n",
    )
    assert main(["relate", "12", operation, "41"]) == 4
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "page 2 failed" in captured.err
    assert not backend.replies
