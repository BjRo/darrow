"""Run installed console functions against Git with only gh mocked, without pytest."""

import importlib
import sys
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from darrow_git import cli, process
from forge import Forge


def main() -> None:
    fixture = Forge()
    with ExitStack() as stack:
        for path in Path(process.__file__).parent.glob("*.py"):
            module = importlib.import_module(f"darrow_git.{path.stem}")
            if hasattr(module, "invoke"):
                stack.enter_context(patch.object(module, "invoke", fixture.invoke))
        stack.enter_context(patch("shutil.which", lambda name: f"fixture-{name}"))
        invoke_publication(fixture)


def invoke_publication(fixture: Forge) -> None:
    sys.argv = [
        "darrow-create-pr",
        "create",
        "--title",
        "fix: fresh installation",
        "-b",
        "Verified copied plugin.",
    ]
    cli.create_pr()
    assert fixture.created and fixture.body == "Verified copied plugin."
    head = process.git("rev-parse", "HEAD")
    sys.argv = ["darrow-create-pr", "verify", "--expected-head", head]
    cli.create_pr()
    publish_evidence(head)
    assert sum(call[:2] == ["pr", "create"] for call in fixture.calls) == 1


def publish_evidence(head: str) -> None:
    body = Path.cwd().parent / "evidence.md"
    body.write_text("Fresh installation passed.\n", encoding="utf-8")
    sys.argv = [
        "darrow-publish-pr-evidence",
        "publish",
        "--expected-head",
        head,
        "--body-file",
        str(body),
    ]
    for _ in range(2):
        try:
            cli.publish_evidence()
        except SystemExit as result:
            assert result.code == 0


if __name__ == "__main__":
    main()
