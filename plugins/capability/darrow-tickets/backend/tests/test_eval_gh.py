"""Public fixture responses and effects used by ticket evals."""

import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from tests.eval_gh import dispatch


def test_queries_and_field_selection(tmp_path: Path) -> None:
    assert dispatch(tmp_path, ["issue", "list"]) == []
    assert dispatch(tmp_path, ["label", "list"]) == []
    assert dispatch(tmp_path, ["repo", "view"]) == {"hasIssuesEnabled": True}
    assert dispatch(tmp_path, ["repo", "view", "--json", "url"]) == {
        "url": "https://github.test/o/r"
    }
    (tmp_path / "labels").write_text("bug\nmaintenance\n")
    (tmp_path / "list").write_text(
        "#12 open  A title (bug, maintenance)\n#13 closed  Plain\n"
    )
    assert dispatch(tmp_path, ["label", "list"]) == [
        {"name": "bug"},
        {"name": "maintenance"},
    ]
    assert dispatch(tmp_path, ["issue", "list"]) == [
        {
            "number": 12,
            "state": "OPEN",
            "title": "A title",
            "labels": [{"name": "bug"}, {"name": "maintenance"}],
        },
        {"number": 13, "state": "CLOSED", "title": "Plain", "labels": []},
    ]
    assert [
        item["number"]
        for item in dispatch(
            tmp_path,
            ["issue", "list", "--state", "open", "--search", "title", "--limit", "1"],
        )
    ] == [12]
    assert [
        item["number"]
        for item in dispatch(
            tmp_path, ["issue", "list", "--state", "closed", "--limit", "1"]
        )
    ] == [13]
    (tmp_path / "issue-12-state").write_text("open")
    (tmp_path / "issue-12-title").write_text('Quoted "title"')
    assert dispatch(
        tmp_path, ["issue", "view", "12", "--json", "number,title,state"]
    ) == {
        "number": 12,
        "title": 'Quoted "title"',
        "state": "OPEN",
    }


def test_issue_view_accepts_unassigned_metadata_fields(tmp_path: Path) -> None:
    (tmp_path / "issue-7-state").write_text("open")
    (tmp_path / "issue-7-title").write_text("Reporting epic")
    assert dispatch(
        tmp_path,
        [
            "issue",
            "view",
            "7",
            "--json",
            "number,title,body,state,url,labels,milestone,assignees",
        ],
    ) == {
        "number": 7,
        "title": "Reporting epic",
        "body": "",
        "state": "OPEN",
        "url": "https://github.test/o/r/issues/7",
        "labels": [],
        "milestone": None,
        "assignees": [],
    }


def test_issue_view_preserves_assigned_metadata(tmp_path: Path) -> None:
    (tmp_path / "issue-7-state").write_text("open")
    (tmp_path / "issue-7-assignees").write_text('[{"login": "sam"}]')
    (tmp_path / "issue-7-milestone").write_text('{"title": "Reporting v2"}')
    assert dispatch(
        tmp_path, ["issue", "view", "7", "--json", "assignees,milestone"]
    ) == {"assignees": [{"login": "sam"}], "milestone": {"title": "Reporting v2"}}


def test_cli_rejects_unknown_json_fields_without_traceback(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    state = tmp_path / ".fixture-state/gh"
    state.mkdir(parents=True)
    (state / "issue-7-state").write_text("open")
    result = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).with_name("eval_gh.py")),
            "issue",
            "view",
            "7",
            "--json",
            "number,invented",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr == "mock gh: unsupported issue JSON field: invented\n"


def test_creation_comments_edits_and_transitions(tmp_path: Path) -> None:
    body = tmp_path / "body with spaces"
    body.write_bytes(b"body\nwith newline\n")
    assert (
        dispatch(
            tmp_path,
            [
                "issue",
                "create",
                "--title",
                "Unicode ä",
                "--body-file",
                str(body),
                "--label",
                "bug",
                "--label",
                "maintenance",
            ],
        )
        == "https://github.test/o/r/issues/99"
    )
    assert (tmp_path / "issue-99-title").read_text(encoding="utf-8") == "Unicode ä"
    assert (tmp_path / "issue-99-body").read_bytes() == body.read_bytes()
    assert (tmp_path / "created-labels").read_text() == "bug\nmaintenance\n"
    assert (
        dispatch(
            tmp_path,
            [
                "issue",
                "comment",
                "99",
                "--body-file",
                str(body),
            ],
        )
        == "https://github.test/o/r/issues/99#issuecomment-1"
    )
    assert (tmp_path / "comment-body-99").read_bytes() == body.read_bytes()
    body.write_text("replacement")
    dispatch(tmp_path, ["issue", "edit", "99", "--body-file", str(body)])
    assert (tmp_path / "edited-body-99").read_text() == "replacement"
    assert (tmp_path / "issue-99-body").read_text() == "replacement"
    for action in ("close", "reopen"):
        dispatch(tmp_path, ["issue", action, "99"])
    assert (tmp_path / "transitions").read_text() == "close 99\nreopen 99\n"


def test_distinct_created_issues_are_listed_and_readable(tmp_path: Path) -> None:
    body = tmp_path / "body.md"
    body.write_text("First body", encoding="utf-8")
    first = dispatch(
        tmp_path,
        [
            "issue",
            "create",
            "--title",
            "First",
            "--body-file",
            str(body),
            "--label",
            "task",
        ],
    )
    body.write_text("Second body", encoding="utf-8")
    second = dispatch(
        tmp_path,
        [
            "issue",
            "create",
            "--title",
            "Second",
            "--body-file",
            str(body),
            "--label",
            "bug",
        ],
    )
    assert first == "https://github.test/o/r/issues/99"
    assert second == "https://github.test/o/r/issues/100"
    assert (tmp_path / "created-ids").read_text() == "99\n100\n"
    assert [record["title"] for record in dispatch(tmp_path, ["issue", "list"])] == [
        "First",
        "Second",
    ]
    assert dispatch(tmp_path, ["issue", "view", "99", "--json", "body,labels"]) == {
        "body": "First body",
        "labels": [{"name": "task"}],
    }
    assert dispatch(tmp_path, ["issue", "view", "100", "--json", "body,labels"]) == {
        "body": "Second body",
        "labels": [{"name": "bug"}],
    }


@pytest.mark.parametrize("body_flag", ["--body", "-b"])
def test_inline_bodies_survive_creation_and_edits(
    tmp_path: Path, body_flag: str
) -> None:
    body = "## Observed\n\nLiteral `command` and Unicode ä.\n"
    assert (
        dispatch(
            tmp_path,
            ["issue", "create", "--title", "Import crash", body_flag, body],
        )
        == "https://github.test/o/r/issues/99"
    )
    assert dispatch(tmp_path, ["issue", "view", "99", "--json", "body"]) == {
        "body": body
    }
    dispatch(tmp_path, ["issue", "edit", "99", body_flag, ""])
    assert dispatch(tmp_path, ["issue", "view", "99", "--json", "body"]) == {"body": ""}


@pytest.mark.parametrize(
    "body", ["--body", "-b", "--body-file", "--title", "--label", "--help", "-h"]
)
def test_option_names_remain_literal_body_values(tmp_path: Path, body: str) -> None:
    assert (
        dispatch(
            tmp_path,
            ["issue", "create", "--title", "Example", "-b", body, "--label", "bug"],
        )
        == "https://github.test/o/r/issues/99"
    )
    assert (tmp_path / "issue-99-body").read_bytes() == body.encode("utf-8")
    assert (tmp_path / "created-labels").read_text() == "bug\n"
    dispatch(tmp_path, ["issue", "edit", "99", "-b", body, "--label", "bug"])
    assert (tmp_path / "edited-body-99").read_bytes() == body.encode("utf-8")
    assert (tmp_path / "issue-99-body").read_bytes() == body.encode("utf-8")


def test_authentication_probe_is_successful_and_read_only(tmp_path: Path) -> None:
    result = dispatch(tmp_path, ["auth", "status"])
    assert "github.test" in result
    assert "Logged in" in result
    assert list(tmp_path.iterdir()) == []


@settings(derandomize=True, max_examples=30)
@given(
    st.sampled_from(["--body", "-b"]),
    st.text(
        st.characters(exclude_categories=["Cs"], exclude_characters="\0"), max_size=128
    ),
)
def test_inline_body_preserves_stored_bytes(body_flag: str, body: str) -> None:
    with TemporaryDirectory() as temporary:
        directory = Path(temporary)
        dispatch(directory, ["issue", "create", "--title", "Example", body_flag, body])
        assert (directory / "issue-99-body").read_bytes() == body.encode("utf-8")


def test_relationships(tmp_path: Path) -> None:
    (tmp_path / "issue-7-state").write_text("open")
    endpoint = "repos/o/r/issues/7"
    assert dispatch(tmp_path, ["api", endpoint]) == {"id": 10007}
    assert dispatch(tmp_path, ["api", endpoint + "/dependencies/blocked_by"]) == [[]]
    dispatch(
        tmp_path,
        [
            "api",
            "-X",
            "POST",
            endpoint + "/dependencies/blocked_by",
            "-F",
            "issue_id=10009",
        ],
    )
    assert dispatch(
        tmp_path,
        ["api", "--paginate", "--slurp", endpoint + "/dependencies/blocked_by"],
    ) == [[{"number": 9}]]
    dispatch(
        tmp_path, ["api", "-X", "DELETE", endpoint + "/dependencies/blocked_by/10009"]
    )
    assert (tmp_path / "issue-7-blockedby").read_text() == ""
    dispatch(
        tmp_path,
        ["api", "-X", "POST", endpoint + "/sub_issues", "-F", "sub_issue_id=10099"],
    )
    assert dispatch(tmp_path, ["api", "repos/o/r/issues/99/parent"]) == {
        "number": 7,
        "html_url": "https://github.test/o/r/issues/7",
    }
    dispatch(
        tmp_path,
        ["api", "-X", "DELETE", endpoint + "/sub_issue", "-F", "sub_issue_id=10099"],
    )
    assert not (tmp_path / "issue-99-parent").exists()


def test_parent_write_refusal_does_not_record_relation(tmp_path: Path) -> None:
    (tmp_path / "reject-parent-for").write_text("99\n", encoding="utf-8")
    with pytest.raises(ValueError, match="rejected parent write"):
        dispatch(
            tmp_path,
            [
                "api",
                "-X",
                "POST",
                "repos/o/r/issues/7/sub_issues",
                "-F",
                "sub_issue_id=10099",
            ],
        )
    assert not (tmp_path / "issue-99-parent").exists()


@pytest.mark.parametrize(
    "arguments,diagnostic",
    [
        (["api", "repos/o/r/issues/8"], "Not Found"),
        (["api", "repos/o/r/issues/8/parent"], "No parent issue"),
        (["issue", "view", "8", "--json", "title"], "Could not resolve"),
        (["api", "bad"], "unsupported api call"),
        (["api", "-X", "PATCH", "repos/o/r/issues/8"], "unsupported api call"),
        (["release", "delete"], "unsupported"),
    ],
)
def test_refusals(tmp_path: Path, arguments: list[str], diagnostic: str) -> None:
    with pytest.raises(ValueError, match=diagnostic):
        dispatch(tmp_path, arguments)


def test_cli_records_calls_and_reports_failure(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    script = Path(__file__).with_name("eval_gh.py")
    command = [sys.executable, str(script)]
    result = subprocess.run(
        [*command, "issue", "list"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(result.stdout) == []
    result = subprocess.run(
        [*command, "issue", "view", "9"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "Could not resolve" in result.stderr
    assert (
        tmp_path / ".fixture-state/gh/calls"
    ).read_text() == "issue list\nissue view 9\n"
    assert not (tmp_path / ".git/fixture-gh").exists()


@pytest.mark.parametrize("help_flag", ["--help", "-h"])
@pytest.mark.parametrize(
    "command", [["issue"], ["issue", "create"], ["issue", "edit", "99"], ["api"]]
)
def test_cli_help_never_mutates(
    tmp_path: Path, help_flag: str, command: list[str]
) -> None:
    assert "Usage:" in dispatch(tmp_path, [*command, help_flag])
    assert list(tmp_path.iterdir()) == []


def test_transitions_are_visible_to_later_reads(tmp_path: Path) -> None:
    dispatch(tmp_path, ["issue", "create", "--title", "Example", "--body", "body"])
    for action, expected in [("close", "CLOSED"), ("reopen", "OPEN")]:
        dispatch(tmp_path, ["issue", action, "99"])
        assert dispatch(tmp_path, ["issue", "view", "99", "--json", "state"]) == {
            "state": expected
        }


@pytest.mark.parametrize("method_flag", ["-X", "--method"])
@pytest.mark.parametrize("field_flag", ["-F", "--field", "-f", "--raw-field"])
def test_api_aliases_preserve_parent_operations(
    tmp_path: Path, method_flag: str, field_flag: str
) -> None:
    dispatch(
        tmp_path,
        [
            "api",
            method_flag,
            "POST",
            "repos/o/r/issues/7/sub_issues",
            field_flag,
            "sub_issue_id=10099",
        ],
    )
    assert dispatch(tmp_path, ["api", "repos/o/r/issues/99/parent"]) == {
        "number": 7,
        "html_url": "https://github.test/o/r/issues/7",
    }


def test_api_fields_default_to_post(tmp_path: Path) -> None:
    dispatch(
        tmp_path, ["api", "repos/o/r/issues/7/sub_issues", "-F", "sub_issue_id=10099"]
    )
    assert dispatch(tmp_path, ["api", "repos/o/r/issues/99/parent"])["number"] == 7


def test_sub_issue_listing_reflects_parent_relations(tmp_path: Path) -> None:
    endpoint = "repos/o/r/issues/7/sub_issues"
    assert dispatch(tmp_path, ["api", endpoint]) == []
    dispatch(tmp_path, ["api", endpoint, "-X", "POST", "-F", "sub_issue_id=10099"])
    assert dispatch(tmp_path, ["api", endpoint]) == [{"number": 99}]
