import io
import json
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import pytest

from darrow_tickets_github import cli, provider, relations
from darrow_tickets_github.cli import main
from darrow_tickets_github.errors import TicketError
from darrow_tickets_github.provider import Provider, execute

from .conftest import Backend


@pytest.mark.parametrize(
    ("argv", "status"),
    [
        (["get", "abc"], 2),
        (["list", "--foo"], 2),
        (["create", "--depends-on"], 2),
        (["list", "--limit"], 2),
        (["create", "--depends-on", "01", "--depends-on", "#1"], 2),
    ],
)
def test_bad_arguments(argv: list[str], status: int, backend: Backend) -> None:
    assert main(argv) == status
    assert not backend.calls


@pytest.mark.parametrize(
    ("title", "body", "kind", "status"),
    [
        (" ", "body", "bug", 5),
        ("Title.", "body", "bug", 5),
        ("Two\nlines", "body", "bug", 5),
        ("Title", "body", "story", 2),
        ("Title", " ", "bug", 2),
        ("Title", "Parent: #7", "bug", 2),
        ("Title", "Generated with Claude", "bug", 6),
        ("Title", "body", "bug", 7),
        ("Title", "## Observed\n\n## Expected\ny\n## Reproduction\nz", "bug", 7),
        (
            "Title",
            "## Observed\nx\n## Expected\ny\n```\n## Reproduction\nz\n```",
            "bug",
            7,
        ),
    ],
)
def test_create_input(
    title: str,
    body: str,
    kind: str,
    status: int,
    backend: Backend,
    body_file: Callable[[str], str],
) -> None:
    assert (
        main(
            ["create", "--title", title, "--type", kind, "--body-file", body_file(body)]
        )
        == status
    )
    assert not backend.calls


@pytest.mark.parametrize("kind", ["bug", "feature", "task", "chore"])
def test_valid_nested_and_fenced_body(
    kind: str, backend: Backend, body_file: Callable[[str], str]
) -> None:
    headings = {
        "bug": ("Observed", "Expected", "Reproduction"),
        "feature": ("Motivation", "Acceptance criteria"),
        "task": ("Outcome", "Done criteria"),
        "chore": ("Outcome", "Done criteria"),
    }[kind]
    body = "\n".join(
        f"## {heading}   \n\n### Detail\n```\ncode\n```" for heading in headings
    )
    backend.labels()
    backend.expect(
        "issue",
        "create",
        "--title",
        "T",
        "--body-file",
        "<body>",
        output="https://github.test/o/r/issues/99",
        payload=(body + "\n").encode(),
    )
    assert (
        main(["create", "--title", "T", "--type", kind, "--body-file", body_file(body)])
        == 0
    )


@pytest.mark.parametrize("body", ["Parent: #3", "Co-authored-by: Claude <c@test>"])
def test_description_refuses_unrecorded_relations_and_attribution(
    body: str, body_file: Callable[[str], str], backend: Backend
) -> None:
    assert main(["describe", "12", "--body-file", body_file(body)]) in {2, 6}
    assert not backend.calls


@pytest.mark.parametrize("payload", [b"\xff", b"", b" \t\n"])
def test_body_decode_and_empty(
    payload: bytes, tmp_path: Path, backend: Backend
) -> None:
    path = tmp_path / "body.md"
    path.write_bytes(payload)
    assert main(["comment", "12", "--body-file", str(path)]) == 2
    assert not backend.calls


def test_missing_relation_prevents_create(
    backend: Backend, body_file: Callable[[str], str]
) -> None:
    backend.labels()
    backend.expect(
        "issue",
        "view",
        "404",
        "--json",
        "state,title",
        status=1,
        error="not found\n",
        output="",
    )
    assert (
        main(
            [
                "create",
                "--title",
                "T",
                "--type",
                "task",
                "--body-file",
                body_file("## Outcome\nx\n## Done criteria\ny"),
                "--parent",
                "404",
            ]
        )
        == 4
    )
    assert not backend.replies


@pytest.mark.parametrize("url", ["", "not-a-url", "https://github.test/o/r/issues/xx"])
def test_invalid_creation_result(
    url: str,
    backend: Backend,
    body_file: Callable[[str], str],
    capsys: pytest.CaptureFixture[str],
) -> None:
    body = "## Outcome\nx\n## Done criteria\ny"
    backend.labels()
    backend.expect(
        "issue",
        "create",
        "--title",
        "T",
        "--body-file",
        "<body>",
        output=url,
        payload=(body + "\n").encode(),
    )
    assert (
        main(
            ["create", "--title", "T", "--type", "task", "--body-file", body_file(body)]
        )
        == 4
    )
    assert capsys.readouterr().out == ""
    assert all(not path.exists() for path in backend.paths)


@pytest.mark.parametrize(
    ("payload", "status"), [("{", 4), ("[]", 4), ('{"hasIssuesEnabled":false}', 3)]
)
def test_bad_inspect(payload: str, status: int, backend: Backend) -> None:
    backend.expect("repo", "view", "--json", "hasIssuesEnabled", output=payload)
    assert main(["inspect"]) == status


def test_inspect_provider_failure(
    backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "repo",
        "view",
        "--json",
        "hasIssuesEnabled",
        status=1,
        error="Cannot resolve\n",
        output="",
    )
    assert main(["inspect"]) == 3
    assert "Cannot resolve" in capsys.readouterr().err


@pytest.mark.parametrize(
    "payload",
    [
        "{",
        "{}",
        "null",
        '[{"number":true}]',
        '[{"number":-1}]',
        '[{"number":1,"state":2}]',
        '[{"number":1,"state":"OPEN","title":"T","labels":false}]',
    ],
)
def test_malformed_json(
    payload: str, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "issue",
        "list",
        "--state",
        "open",
        "--limit",
        "21",
        "--json",
        "number,state,title,labels",
        output=payload,
    )
    assert main(["list"]) == 4
    assert capsys.readouterr().out == ""


@pytest.mark.parametrize("silent", [False, True])
def test_bounded_provider_error(
    silent: bool, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    diagnostic = "" if silent else "line\n" * 52
    backend.expect(
        "issue",
        "view",
        "12",
        "--json",
        "number,state,title,url,labels",
        status=8,
        error=diagnostic,
        output=diagnostic,
    )
    assert main(["get", "12"]) == 4
    captured = capsys.readouterr()
    assert captured.out == ""
    if silent:
        assert "failed with exit 8 and no diagnostic" in captured.err
    else:
        assert captured.err.count("line\n") == 100
        assert "stderr truncated at 50 lines (52 total)" in captured.err
        assert "stdout truncated at 50 lines (52 total)" in captured.err


@pytest.mark.parametrize(
    "payload",
    [
        "{",
        "{}",
        '{"number":7,"html_url":"null"}',
        '{"number":7,"html_url":"https://github.test/o/r/issues/8"}',
    ],
)
def test_bad_parent(payload: str, backend: Backend) -> None:
    backend.verify()
    backend.expect("api", "repos/{owner}/{repo}/issues/12/parent", output=payload)
    assert main(["relate", "12", "--remove-parent"]) == 4
    assert not backend.replies


@pytest.mark.parametrize(
    ("parent_url", "repo_url", "status"),
    [
        ("https://other.test/o/r/issues/7", "https://github.test/o/r", 9),
        ("https://github.test/other/r/issues/7", "https://github.test/o/r", 9),
        ("https://github.test/o/r/issues/7", "null", 4),
        ("https://github.test/o/r/issues/7", "https://other.test/o/r", 4),
    ],
)
def test_unusable_parent_identity(
    parent_url: str, repo_url: str, status: int, backend: Backend
) -> None:
    backend.verify()
    backend.expect(
        "api",
        "repos/{owner}/{repo}/issues/12/parent",
        data={"number": 7, "html_url": parent_url},
    )
    backend.expect("repo", "view", "--json", "url", data={"url": repo_url})
    assert main(["relate", "12", "--remove-parent"]) == status
    assert not backend.replies


@pytest.mark.parametrize(
    "url",
    [
        "https://GITHUB.TEST/O/R/issues/7",
        "https://github.test/new-owner/new-name/issues/7",
    ],
)
def test_qualified_parent_after_rename(url: str, backend: Backend) -> None:
    backend.repository = "github.test/old/name"
    backend.expect(
        "api",
        "repos/{owner}/{repo}/issues/12/parent",
        data={"number": 7, "html_url": url},
    )
    backend.expect(
        "repo", "view", "--json", "url", data={"url": url.rsplit("/issues/", 1)[0]}
    )
    assert relations.parent(Provider("github.test/old/name"), "12") == "7"


@pytest.mark.parametrize("payload", [[], [None], [[{"number": "bad"}]]])
def test_dependency_shape(payload: object, backend: Backend) -> None:
    backend.verify()
    backend.expect(
        "api",
        "repos/{owner}/{repo}/issues/12/dependencies/blocked_by",
        "--paginate",
        "--slurp",
        output=json.dumps(payload),
    )
    assert main(["relate", "12", "--remove-depends-on", "1"]) == (
        9 if payload == [] else 4
    )


def test_failed_parent_reread_retains_mutation(
    backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.verify()
    backend.parent(parent=7)
    backend.expect("api", "repos/{owner}/{repo}/issues/12", data={"id": 10012})
    backend.expect(
        "api",
        "-X",
        "DELETE",
        "repos/{owner}/{repo}/issues/7/sub_issue",
        "-F",
        "sub_issue_id=10012",
    )
    backend.expect(
        "api",
        "repos/{owner}/{repo}/issues/12/parent",
        status=1,
        error="network down\n",
        output="",
    )
    assert main(["relate", "12", "--remove-parent"]) == 4
    assert "removed: #12 parent #7" in capsys.readouterr().out


def test_invalid_state_refuses_transition(backend: Backend) -> None:
    backend.verify(state="unknown")
    assert main(["close", "12"]) == 4


@pytest.mark.parametrize(
    ("worktree", "remote_status", "gh", "message"),
    [
        ("false", 0, "gh", "not inside"),
        ("true", 1, "gh", "no 'origin'"),
        ("true", 0, None, "gh CLI not found"),
    ],
)
def test_backend_resolution(
    worktree: str,
    remote_status: int,
    gh: str | None,
    message: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def git(
        args: list[str], env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        assert args[0] == "git"
        return subprocess.CompletedProcess(
            args, 0 if args[1] == "rev-parse" else remote_status, worktree, ""
        )

    monkeypatch.setattr(provider, "execute", git)
    monkeypatch.setattr("darrow_tickets_github.provider.shutil.which", lambda _: gh)
    assert main(["inspect"]) == 3
    assert message in capsys.readouterr().err


def test_real_subprocess_literal_arguments() -> None:
    value = 'spaces; $(touch unsafe) "quotes" ü'
    result = execute([sys.executable, "-c", "import sys; print(sys.argv[1])", value])
    assert result.stdout.rstrip("\r\n") == value


def test_provider_diagnostic_line_endings_are_preserved() -> None:
    result = execute(
        [
            sys.executable,
            "-c",
            "import sys; sys.stderr.buffer.write(b'first\\r\\nlast\\r\\n')",
        ]
    )
    assert result.stderr == "first\r\nlast\r\n"


def test_missing_executable(tmp_path: Path) -> None:
    with pytest.raises(TicketError, match="cannot execute") as error:
        execute([str(tmp_path / "missing")])
    assert error.value.code == 3


def test_filesystem_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(args: object) -> None:
        raise OSError("disk full")

    monkeypatch.setitem(cli.COMMANDS, "inspect", fail)
    assert main(["inspect"]) == 2


def test_entrypoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["darrow-ticket"])
    monkeypatch.setattr(sys, "stdout", io.StringIO())
    monkeypatch.setattr(sys, "stderr", io.StringIO())
    with pytest.raises(SystemExit) as error:
        cli.entrypoint()
    assert error.value.code == 64


def test_entrypoint_utf8_on_non_utf8_host(monkeypatch: pytest.MonkeyPatch) -> None:
    output, errors = io.BytesIO(), io.BytesIO()
    stdout, stderr = (
        io.TextIOWrapper(output, encoding="ascii"),
        io.TextIOWrapper(errors, encoding="ascii"),
    )
    monkeypatch.setattr(sys, "stdout", stdout)
    monkeypatch.setattr(sys, "stderr", stderr)
    monkeypatch.setattr(sys, "argv", ["darrow-ticket", "list", "--state", "漢字"])
    with pytest.raises(SystemExit) as error:
        cli.entrypoint()
    assert error.value.code == 2
    stderr.flush()
    assert errors.getvalue().decode("utf-8").endswith("漢字\n")
