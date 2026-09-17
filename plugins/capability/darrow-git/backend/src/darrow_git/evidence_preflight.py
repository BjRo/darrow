"""Read-only GitHub identity and attachment support checks."""

import re
from dataclasses import dataclass
from pathlib import Path

from .process import RefusalError, command, git, require
from .publication import REPOSITORY
from .repository import current_branch, require_repository

FIELDS = "number,url,headRefOid,isCrossRepository"
QUERY = ".[] | [.number,.url,.headRefOid,.isCrossRepository] | @tsv"


@dataclass(frozen=True)
class Candidate:
    top: Path
    repository: str
    branch: str


@dataclass(frozen=True)
class PullRequest:
    number: str
    url: str
    head: str


def checked(message: str, *args: str) -> str:
    try:
        return command(*args)
    except RefusalError as error:
        raise RefusalError(f"error: {message}") from error


def candidate(expected: str) -> Candidate:
    require_repository()
    top = Path(git("rev-parse", "--show-toplevel"))
    require(
        git("rev-parse", "HEAD") == expected, "local HEAD differs from expected head"
    )
    branch = current_branch()
    require(branch, "a feature branch is required")
    row = checked(
        "cannot identify the repository",
        "gh",
        "repo",
        "view",
        "--json",
        "nameWithOwner,url",
        "--jq",
        "[.nameWithOwner,.url] | @tsv",
    )
    fields = row.split("\t")
    require(
        len(fields) == 2
        and REPOSITORY.fullmatch(fields[0])
        and fields[1].startswith("https://github.com/"),
        "active repository is not on a supported GitHub attachment host",
    )
    return Candidate(top, fields[0], branch)


def observe(candidate: Candidate) -> PullRequest:
    rows = checked(
        "cannot observe open pull requests",
        "gh",
        "pr",
        "list",
        "--repo",
        candidate.repository,
        "--head",
        candidate.branch,
        "--state",
        "open",
        "--limit",
        "2",
        "--json",
        FIELDS,
        "--jq",
        QUERY,
    )
    lines = [line for line in rows.splitlines() if line.strip()]
    require(len(lines) == 1, "exactly one open PR is required")
    fields = lines[0].split("\t")
    require(len(fields) == 4, "malformed or cross-repository PR identity")
    number, url, head, cross = fields
    require(
        number.isdigit() and url.startswith("https://") and cross == "false",
        "malformed or cross-repository PR identity",
    )
    return PullRequest(number, url, head)


def advertised_limit(help_text: str) -> int:
    active = False
    limits = [50]
    for line in help_text.lower().splitlines():
        active = attachment_help_active(line, active)
        if active:
            limits.extend(
                int(value)
                for value in re.findall(r"(?:maximum|max|up to)[^0-9]*([0-9]+)", line)
            )
        if not line.strip():
            active = False
    return min(limits)


def attachment_help_active(line: str, previous: bool) -> bool:
    if "--attach" in line:
        return True
    if re.match(r"^\s+--[a-z0-9-]+", line):
        return False
    return previous


def cli_support() -> None:
    help_text = checked(
        "cannot inspect gh pr comment support", "gh", "pr", "comment", "--help"
    )
    require(
        "--attach" in help_text,
        "installed gh lacks pr comment --attach; install a supported GitHub CLI before retrying",
    )
    limit = advertised_limit(help_text)
    require(
        limit >= 50, f"installed gh advertises a stricter attachment limit: {limit}"
    )
    checked(
        "active GitHub host does not confirm attachment publication support",
        "gh",
        "api",
        "meta",
    )


def comments(candidate: Candidate, pr: PullRequest) -> str:
    return checked(
        "cannot reconcile top-level PR comments",
        "gh",
        "api",
        f"repos/{candidate.repository}/issues/{pr.number}/comments",
        "--paginate",
        "--jq",
        ".[] | [.id,.html_url,.body] | @tsv",
    )
