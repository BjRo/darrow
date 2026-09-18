import pytest

from darrow_tickets_github.cli import main

from .conftest import Backend


@pytest.mark.parametrize(
    "reference", ["12", "#0012", "https://github.test/o/r/issues/12"]
)
def test_complete_read(
    reference: str, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    if "://" in reference:
        backend.expect(
            "repo", "view", "--json", "url", data={"url": "https://github.test/o/r"}
        )
    backend.expect(
        "issue",
        "view",
        "12",
        "--json",
        "number,state,title,url,labels",
        data={
            "number": 12,
            "state": "OPEN",
            "title": "Exact \\ text",
            "url": "https://github.test/o/r/issues/12",
            "labels": [{"name": "bug"}],
        },
    )
    backend.expect(
        "issue", "view", "12", "--json", "body", data={"body": "Line.\r\n\r\nLast.\r\n"}
    )
    backend.parent(parent=7)
    backend.deps([3], [40])
    assert main(["get", reference]) == 0
    assert (
        capsys.readouterr().out
        == "backend: github\nticket-token: 12\n#12 open — Exact \\ text\nhttps://github.test/o/r/issues/12\nlabels: bug\nparent: #7\ndepends-on: #3 #40\n## body\nLine.\n\nLast.\n"
    )
    assert not backend.replies


@pytest.mark.parametrize(
    ("reference", "message"),
    [
        ("https://foreign.test/o/r/issues/12", "does not belong"),
        ("https://github.test/o/r/issues/12?x=1", "not canonical"),
        ("https://github.test/o/r/issues/#12", "not canonical"),
    ],
)
def test_url_refusal(
    reference: str, message: str, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "repo", "view", "--json", "url", data={"url": "https://github.test/o/r"}
    )
    assert main(["get", reference]) == 2
    out = capsys.readouterr()
    assert out.out == ""
    assert message in out.err


@pytest.mark.parametrize("count", [0, 2, 3])
def test_list_cap(
    count: int, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = [
        {"number": n, "state": "OPEN", "title": f"Item {n}", "labels": []}
        for n in range(1, count + 1)
    ]
    backend.expect(
        "issue",
        "list",
        "--state",
        "open",
        "--limit",
        "3",
        "--json",
        "number,state,title,labels",
        data=rows,
    )
    assert main(["list", "--limit", "2"]) == 0
    output = capsys.readouterr().out
    expected = {
        0: "no matches (state=open)",
        2: "total: 2 (state=open)",
        3: "total: more than 2 (state=open)",
    }
    assert expected[count] in output
    assert "#3 " not in output


def test_literal_filters(backend: Backend, capsys: pytest.CaptureFixture[str]) -> None:
    backend.labels("enhancement")
    backend.expect(
        "issue",
        "list",
        "--state",
        "all",
        "--limit",
        "21",
        "--label",
        "-area",
        "--label",
        "enhancement",
        "--search",
        "$(touch nope); `x`",
        "--milestone",
        "v1",
        "--json",
        "number,state,title,labels",
        data=[
            {
                "number": 1,
                "state": "CLOSED",
                "title": "T",
                "labels": [{"name": "enhancement"}],
            }
        ],
    )
    assert (
        main(
            [
                "list",
                "--state",
                "all",
                "--type",
                "feature",
                "--label",
                "-area",
                "--search",
                "$(touch nope); `x`",
                "--milestone",
                "v1",
            ]
        )
        == 0
    )
    assert "#1 closed  T (enhancement)" in capsys.readouterr().out


@pytest.mark.parametrize("count", [0, 2, 51])
def test_inspect(
    count: int, backend: Backend, capsys: pytest.CaptureFixture[str]
) -> None:
    backend.expect(
        "repo", "view", "--json", "hasIssuesEnabled", data={"hasIssuesEnabled": True}
    )
    backend.labels(*(str(n) for n in range(count)))
    assert main(["inspect"]) == 0
    output = capsys.readouterr().out
    assert "## backend: github" in output
    assert ("truncated" in output) == (count > 50)


@pytest.mark.parametrize("kind", ["unknown", "task"])
def test_unmapped_type(kind: str, backend: Backend) -> None:
    if kind == "task":
        backend.labels("bug")
    assert main(["list", "--type", kind]) == (8 if kind == "task" else 2)
