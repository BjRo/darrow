"""Exercise all commands from a runtime-only copied package, without network."""

import json
import subprocess
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from darrow_tickets.cli import main
from darrow_tickets.providers.github import provider
from darrow_tickets.temporary import temporary_root

REAL_EXECUTE = provider.execute
ISSUE = {
    "number": 12,
    "id": 10012,
    "state": "OPEN",
    "title": "Fresh fixture",
    "url": "https://github.test/o/r/issues/12",
    "body": "Native runtime",
    "labels": [],
}


def response(args: list[str]) -> object:
    if "--paginate" in args:
        return [[]]
    if args[:2] == ["repo", "view"]:
        return {"hasIssuesEnabled": True, "url": "https://github.test/o/r"}
    if args[:2] in (["label", "list"], ["issue", "list"]):
        return []
    return ISSUE


def fake_gh(
    args: list[str], env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    if args[0] != "gh":
        return REAL_EXECUTE(args, env)
    assert env is not None
    assert (env["GH_HOST"], env["GH_REPO"]) == ("github.test", "github.test/o/r")
    if args[-1].endswith("/parent"):
        return subprocess.CompletedProcess(args, 1, "", "No parent issue found\n")
    output = json.dumps(response(args[1:]))
    if args[1:3] in (["issue", "create"], ["issue", "comment"]):
        output = "https://github.test/o/r/issues/12"
    if "--body-file" in args:
        assert Path(args[args.index("--body-file") + 1]).read_text(encoding="utf-8")
    return subprocess.CompletedProcess(args, 0, output, "")


def run() -> None:
    output = StringIO()
    with redirect_stdout(output):
        assert main(["temp-file"]) == 0
    body = Path(output.getvalue().strip())
    assert body.parent == temporary_root()
    body.write_text(
        "## Outcome\nVerified.\n## Done criteria\nAll commands.\n", encoding="utf-8"
    )
    commands = [
        ["inspect"],
        ["list"],
        ["get", "12"],
        ["create", "--title", "Fresh", "--type", "task", "--body-file", str(body)],
        ["comment", "12", "--body-file", str(body)],
        ["describe", "12", "--body-file", str(body)],
        ["close", "12"],
        ["reopen", "12"],
        ["label", "12", "--add", "missing"],
        ["relate", "12", "--depends-on", "7"],
    ]
    with patch.object(provider, "execute", fake_gh):
        for args, expected in zip(
            commands, [0, 0, 0, 0, 0, 0, 0, 9, 8, 0], strict=True
        ):
            assert main(args) == expected, args
    body.unlink()
    assert not list(temporary_root().glob("darrow-ticket-*/body.md"))
    print("fresh ticket probe: all eleven commands passed")


if __name__ == "__main__":
    run()
