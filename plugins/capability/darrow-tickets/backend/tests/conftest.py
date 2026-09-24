"""A fail-closed scripted subprocess boundary; never invokes live GitHub."""

import json
import subprocess
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import pytest

from darrow_tickets.providers.github import provider


@dataclass
class Reply:
    args: list[str]
    output: str = ""
    error: str = ""
    status: int = 0
    payload: bytes | None = None


@dataclass
class Backend:
    repository: str = "github.test/o/r"
    replies: deque[Reply] = field(default_factory=deque)
    calls: list[list[str]] = field(default_factory=list)
    paths: list[Path] = field(default_factory=list)

    def expect(
        self, *args: str, data: object = None, **kwargs: str | int | bytes
    ) -> None:
        reply = Reply(list(args))
        reply.output = json.dumps(data)
        for key, value in kwargs.items():
            setattr(reply, key, value)
        self.replies.append(reply)

    def execute(
        self, args: list[str], env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        if args[0] == "git":
            out = (
                "true\n" if args[1] == "rev-parse" else "https://github.test/o/r.git\n"
            )
            return subprocess.CompletedProcess(args, 0, out, "")
        assert env is not None
        env = {key: env[key] for key in ("GH_HOST", "GH_REPO")}
        assert env["GH_HOST"] == "github.test"
        assert env["GH_REPO"] == self.repository
        self.calls.append(args[1:])
        assert self.replies, f"unexpected provider call: {args}"
        reply = self.replies.popleft()
        actual = args[1:]
        if reply.payload is not None:
            index = actual.index("--body-file") + 1
            path = Path(actual[index])
            assert path.read_bytes() == reply.payload
            self.paths.append(path)
            actual = [*actual[:index], "<body>", *actual[index + 1 :]]
        assert actual == reply.args
        return subprocess.CompletedProcess(
            args, reply.status, reply.output, reply.error
        )

    def verify(
        self, number: str = "12", state: str = "OPEN", title: str = "Ticket"
    ) -> None:
        self.expect(
            "issue",
            "view",
            number,
            "--json",
            "state,title",
            data={"state": state, "title": title},
        )

    def labels(self, *names: str) -> None:
        self.expect(
            "label",
            "list",
            "--json",
            "name",
            "--limit",
            "1000",
            data=[{"name": name} for name in names],
        )

    def parent(
        self, number: str = "12", parent: int | None = None, url: str = ""
    ) -> None:
        endpoint = f"repos/{{owner}}/{{repo}}/issues/{number}/parent"
        if parent is None:
            self.expect(
                "api",
                endpoint,
                status=1,
                error="gh: No parent issue found (HTTP 404)\n",
                output="",
            )
        else:
            self.expect(
                "api",
                endpoint,
                data={
                    "number": parent,
                    "html_url": url or f"https://github.test/o/r/issues/{parent}",
                },
            )
            self.expect(
                "repo", "view", "--json", "url", data={"url": "https://github.test/o/r"}
            )

    def deps(self, *pages: list[int], number: str = "12") -> None:
        self.expect(
            "api",
            f"repos/{{owner}}/{{repo}}/issues/{number}/dependencies/blocked_by",
            "--paginate",
            "--slurp",
            data=[[{"number": value} for value in page] for page in pages],
        )


@pytest.fixture
def backend(monkeypatch: pytest.MonkeyPatch) -> Backend:
    fake = Backend()
    monkeypatch.setattr(provider, "execute", fake.execute)
    monkeypatch.setattr(
        "darrow_tickets.providers.github.provider.shutil.which", lambda _: "gh"
    )
    monkeypatch.setenv("GH_HOST", "foreign.test")
    monkeypatch.setenv("GH_REPO", "foreign.test/other/repo")
    return fake


@pytest.fixture
def body_file(tmp_path: Path) -> Callable[[str], str]:
    def write(body: str) -> str:
        path = tmp_path / "body with spaces ü.md"
        path.write_bytes(body.encode("utf-8"))
        return str(path)

    return write
