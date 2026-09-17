"""Deterministic GitHub boundary shared by native and fresh-artifact fixtures."""

import subprocess
from collections.abc import Sequence
from pathlib import Path

from darrow_git import process
from darrow_git.process import git


class Forge:
    """Mock only gh; Git operations still use actual local repositories."""

    def __init__(self) -> None:
        self.original = process.invoke
        self.calls: list[list[str]] = []
        self.created = False
        self.base = "main"
        self.draft = "false"
        self.number = "42"
        self.cross = "false"
        self.comments = ""
        self.body = ""
        self.mode = ""
        self.pr_head = ""
        self.observations = 0

    def invoke(
        self,
        args: Sequence[str],
        *,
        cwd: Path | None = None,
        input_bytes: bytes | None = None,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[bytes]:
        if args[0] != "gh":
            return self.original(args, cwd=cwd, input_bytes=input_bytes, env=env)
        values = list(args[1:])
        self.calls.append(values)
        output, code = self.dispatch(values)
        return subprocess.CompletedProcess(
            args, code, output.encode(), b"fixture failure" if code else b""
        )

    def dispatch(self, args: list[str]) -> tuple[str, int]:
        routes = {
            ("repo", "view"): self.repo_view,
            ("pr", "list"): self.pr_list,
            ("pr", "create"): self.pr_create,
            ("pr", "comment"): self.comment,
        }
        if args[0] == "api":
            return ("{}" if args[1] == "meta" else self.comments), 0
        return routes[(args[0], args[1])](args)

    def repo_view(self, args: list[str]) -> tuple[str, int]:
        if "nameWithOwner,url" in args:
            return "fixture/repo\thttps://github.com/fixture/repo", 0
        return "fixture/repo", 0

    def pr_list(self, args: list[str]) -> tuple[str, int]:
        self.observations += 1
        if self.mode == "unavailable":
            return "", 1
        if not self.created:
            return "", 0
        return self.pr_row(args), 0

    def pr_row(self, args: list[str]) -> str:
        branch = git("symbolic-ref", "--short", "HEAD")
        head = self.pr_head or git("rev-parse", "HEAD")
        if self.mode == "propagating" and self.observations < 3:
            head = git("rev-parse", "main")
        url = f"https://github.com/fixture/repo/pull/{self.number}"
        if "--json" not in args:
            return f"{self.number}\tExisting PR\t{branch}"
        if "number,url,headRefOid,isCrossRepository" in args:
            return f"{self.number}\t{url}\t{head}\t{self.cross}"
        return f"{self.number}\t{url}\tOPEN\t{branch}\t{head}\t{self.base}\t{self.draft}\t{self.cross}"

    def pr_create(self, args: list[str]) -> tuple[str, int]:
        self.created = True
        self.base = args[args.index("--base") + 1]
        self.draft = str("--draft" in args).lower()
        self.body = Path(args[args.index("--body-file") + 1]).read_text()
        return (
            "https://github.com/fixture/repo/pull/42",
            1 if self.mode == "uncertain" else 0,
        )

    def comment(self, args: list[str]) -> tuple[str, int]:
        from darrow_git.evidence_identity import PLACEHOLDER, escape_tsv

        if "--help" in args:
            return "--attach file (maximum 50)", 0
        self.body = Path(args[args.index("--body-file") + 1]).read_bytes().decode()
        rendered = PLACEHOLDER.sub(
            lambda match: "https://github.com/user-attachments/assets/" + match[0],
            self.body,
        )
        self.comments = f"9\thttps://github.com/fixture/repo/pull/42#issuecomment-9\t{escape_tsv(rendered)}"
        return "", 0
