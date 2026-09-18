"""Verified publication bound to one full commit and one same-repository PR."""

import re
import shutil
import time
from collections import deque
from dataclasses import dataclass

from .process import RefusalError, checked_command, emit, git, require
from .repository import current_branch, in_progress

FULL_COMMIT = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})\Z")
REPOSITORY = re.compile(r"[^/\s]+/[^/\s]+\Z")
PR_FIELDS = (
    "number,url,state,headRefName,headRefOid,baseRefName,isDraft,isCrossRepository"
)
PR_QUERY = ".[] | [.number,.url,.state,.headRefName,.headRefOid,.baseRefName,.isDraft,.isCrossRepository] | @tsv"


@dataclass
class Publication:
    expected: str = ""
    base: str = ""
    draft: str = "false"
    push: str = "none"
    create: str = "none"
    initial_url: str = ""
    url: str = ""
    number: str = ""
    origin: str = ""
    branch: str = ""
    repository: str = ""
    remote_commit: str = ""
    pr_commit: str = ""

    def fail(self, message: str) -> RefusalError:
        lines = []
        if self.push == "completed":
            lines.append("note: push completed; publication verification is incomplete")
        if self.create == "completed":
            lines.append("note: PR creation completed; do not create another PR")
        elif self.create == "uncertain":
            lines.append(
                "note: PR creation command had an uncertain effect; do not create another PR without fresh observation"
            )
        lines.extend(
            [
                f"push: {self.push}",
                f"pr-create: {self.create}",
                f"initial-url: {self.initial_url or 'unknown'}",
                f"observed-url: {self.url or 'unknown'}",
                f"error: {message}",
            ]
        )
        return RefusalError("\n".join(lines), 4)


def parse(args: list[str]) -> Publication:
    state = Publication()
    remaining = deque(args)
    while remaining:
        flag = remaining.popleft()
        if flag == "--draft":
            state.draft = "true"
        else:
            parse_value(remaining, flag, state)
    return state


def parse_value(args: deque[str], flag: str, state: Publication) -> None:
    if flag not in {"--expected-head", "--base"}:
        raise state.fail(f"unknown argument: {flag}")
    if not args or not args[0]:
        raise state.fail(f"{flag} needs a value")
    setattr(state, "expected" if flag == "--expected-head" else "base", args.popleft())


def preflight(state: Publication) -> None:
    require(
        FULL_COMMIT.fullmatch(state.expected),
        "--expected-head requires the intended full commit ID",
    )
    require(not in_progress(), "Git operation in progress")
    state.branch = current_branch()
    require(state.branch, "a feature branch is required")
    require(
        git("rev-parse", "HEAD") == state.expected,
        "local HEAD differs from the intended commit",
    )
    state.origin = checked_command(
        "origin is required", "git", "remote", "get-url", "origin"
    )
    require(
        git("remote", "get-url", "--all", "origin") == state.origin
        and git("remote", "get-url", "--push", "--all", "origin") == state.origin,
        "origin must have one identical fetch and push endpoint",
    )
    bind_base(state)
    require(shutil.which("gh"), "gh is required")
    state.repository = checked_command(
        "cannot identify the origin repository",
        "gh",
        "repo",
        "view",
        state.origin,
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner",
    )
    require(
        REPOSITORY.fullmatch(state.repository), "malformed origin repository identity"
    )


def bind_base(state: Publication) -> None:
    listing = checked_command(
        "repository default branch is unverified",
        "git",
        "ls-remote",
        "--symref",
        "origin",
        "HEAD",
    )
    refs = [
        line.split()[1]
        for line in listing.splitlines()
        if line.startswith("ref: ") and line.endswith("\tHEAD")
    ]
    require(
        len(refs) == 1 and refs[0].startswith("refs/heads/"),
        "repository default branch is unverified",
    )
    default = refs[0].removeprefix("refs/heads/")
    require(state.branch != default, "the default branch cannot be published as a PR")
    state.base = state.base or default
    require(state.base != state.branch, "base equals the current branch")


def observe(state: Publication) -> None:
    rows = checked_command(
        "cannot observe the open PR",
        "gh",
        "pr",
        "list",
        "--repo",
        state.origin,
        "--head",
        state.branch,
        "--state",
        "open",
        "--limit",
        "2",
        "--json",
        PR_FIELDS,
        "--jq",
        PR_QUERY,
    )
    lines = [line for line in rows.splitlines() if line.strip()]
    require(len(lines) == 1, "exactly one open PR is required")
    fields = lines[0].split("\t")
    require(len(fields) == 8, "malformed PR identity evidence")
    state.number, state.url, status, head, state.pr_commit, base, draft, cross = fields
    require(
        state.number.isdigit() and state.url.startswith("https://"),
        "malformed PR identity evidence",
    )
    require(
        status == "OPEN" and cross == "false" and head == state.branch,
        "PR is not open on the expected same-repository branch",
    )
    require(
        base == state.base and draft == state.draft,
        "PR base or draft state does not match the requested shape",
    )
    observe_remote(state)


def observe_remote(state: Publication) -> None:
    row = checked_command(
        "cannot observe the remote branch",
        "git",
        "ls-remote",
        "--exit-code",
        "origin",
        f"refs/heads/{state.branch}",
    )
    fields = row.split("\t")
    require(
        len(fields) == 2
        and "\n" not in row
        and fields[1] == f"refs/heads/{state.branch}",
        "ambiguous remote branch evidence",
    )
    state.remote_commit = fields[0]
    require(
        FULL_COMMIT.fullmatch(state.remote_commit), "malformed remote commit evidence"
    )
    require(FULL_COMMIT.fullmatch(state.pr_commit), "malformed forge commit evidence")


def observe_converged(state: Publication) -> None:
    observe(state)
    pinned = (state.url, state.number)
    for attempt in range(5):
        if state.pr_commit == state.remote_commit:
            return
        require(
            state.remote_commit == state.expected,
            "forge and remote branch commits do not agree",
        )
        require(
            attempt < 4,
            "forge and remote branch commits do not agree after bounded propagation observation",
        )
        time.sleep(1)
        check_local(state)
        observe(state)
        require(
            (state.url, state.number) == pinned,
            "PR identity changed during publication",
        )
        require(
            state.remote_commit == state.expected,
            "remote branch moved during publication observation",
        )


def check_local(state: Publication) -> None:
    require(
        git("rev-parse", "HEAD") == state.expected and current_branch() == state.branch,
        "local publication target changed",
    )


def publish_existing(state: Publication) -> None:
    if state.remote_commit == state.expected:
        return
    check_local(state)
    original = (state.url, state.number)
    checked_command(
        "non-force push failed; observe the remote before retrying",
        "git",
        "-c",
        "push.followTags=false",
        "-c",
        "remote.origin.mirror=false",
        "push",
        "origin",
        f"{state.expected}:refs/heads/{state.branch}",
    )
    state.push = "completed"
    observe_converged(state)
    require(
        (state.url, state.number) == original, "PR identity changed during publication"
    )


def verify(state: Publication, *, publish: bool = False) -> None:
    try:
        preflight(state)
        observe_converged(state)
        require(
            state.create != "completed"
            or not state.initial_url
            or state.url == state.initial_url,
            "created PR URL differs from the observed canonical PR",
        )
        if publish:
            publish_existing(state)
        require(
            state.remote_commit == state.expected and state.pr_commit == state.expected,
            "the intended commit is not the published PR head",
        )
        check_local(state)
    except RefusalError as error:
        raise state.fail(str(error).removeprefix("error: ")) from error
    report(state)


def report(state: Publication) -> None:
    if state.create == "uncertain":
        state.create = "observed-after-uncertain-command"
    print(
        "\n".join(
            [
                "publication: verified",
                f"url: {state.url}",
                f"repository: {state.repository}",
                f"head: {state.branch}",
                f"base: {state.base}",
                f"draft: {state.draft}",
                f"intended-commit: {state.expected}",
                f"remote-commit: {state.remote_commit}",
                f"pr-commit: {state.pr_commit}",
                f"push: {state.push}",
                f"pr-create: {state.create}",
            ]
        )
    )
    print("## working tree (excluded from publication)")
    emit(git("status", "--porcelain", "--untracked-files=all"))
