"""One non-force branch publication followed by exact forge verification."""

import shutil
import sys
import tempfile
from pathlib import Path

from . import pr_inspection, publication, templates
from .messages import validate_attribution, validate_subject
from .pr_options import PrOptions, parse
from .pr_repository import compare_ref, default_branch, validate_base
from .process import RefusalError, decode, git, invoke, probe, require, succeeds
from .repository import current_branch, in_progress, require_repository


def creation_context(options: PrOptions) -> tuple[str, str]:
    require(
        not in_progress(),
        "merge/rebase/cherry-pick in progress — resolve it first; do not open a PR",
        8,
    )
    require(
        succeeds("rev-parse", "-q", "--verify", "HEAD"),
        "repo has no commits yet — nothing to propose",
        3,
    )
    branch = current_branch()
    require(branch, "detached HEAD — a PR needs a branch (see create-branch)", 3)
    require(
        succeeds("remote", "get-url", "origin"),
        "no 'origin' remote — cannot create a PR",
        3,
    )
    require(shutil.which("gh"), "gh CLI not found — cannot create a PR", 3)
    default, _ = default_branch()
    require(
        branch != default,
        f"on the default branch ({branch}) — a PR needs a feature branch (see create-branch)",
        9,
    )
    base = options.base or default
    require(base != "(none)", "cannot determine the default branch — pass --base", 3)
    require(base != branch, f"base equals the current branch: {branch}", 2)
    if options.base:
        validate_base(base, branch)
    return branch, base


def validate_proposal(options: PrOptions, base: str) -> str:
    validate_subject(options.title, "title")
    body = "\n\n".join(options.bodies)
    template = templates.select(options.template)
    validate_attribution(options.title + "\n" + body, "PR titles or bodies")
    templates.validate(template, body)
    comparison = compare_ref(base)
    result = invoke(["git", "rev-list", "--count", f"{comparison}..HEAD"])
    require(
        result.returncode == 0,
        f"cannot compare against {comparison} — fetch origin first",
        3,
    )
    require(
        decode(result.stdout) != "0",
        f"no commits ahead of {comparison} — nothing to propose",
        3,
    )
    return body


def refuse_duplicate(branch: str) -> None:
    result = invoke(["gh", "pr", "list", "--head", branch, "--state", "open"])
    require(
        result.returncode == 0,
        "could not check for an existing open PR — fix gh before retrying:\n"
        + "\n".join(decode(result.stderr).splitlines()[:50]),
        4,
    )
    existing = decode(result.stdout)
    require(
        not existing,
        f"an open PR for {branch} already exists — report it; do not create another:\n"
        + "\n".join(existing.splitlines()[:50]),
        9,
    )


def create_remote_pr(
    options: PrOptions, branch: str, base: str, body: str
) -> tuple[str, str]:
    # Native temporary-file lifetime works on Windows too: close before gh reads.
    with tempfile.TemporaryDirectory(prefix="darrow-pr-") as directory:
        path = Path(directory) / "body.md"
        path.write_text(body, encoding="utf-8")
        args = [
            "gh",
            "pr",
            "create",
            "--title",
            options.title,
            "--body-file",
            str(path),
            "--base",
            base,
            "--head",
            branch,
        ]
        if options.draft:
            args.append("--draft")
        result = invoke(args)
    output = decode(result.stdout + result.stderr)
    if result.returncode:
        print(output, file=sys.stderr)
        return "uncertain", ""
    last = next((line for line in reversed(output.splitlines()) if line.strip()), "")
    return ("completed", last) if last.startswith("https://") else ("uncertain", "")


def create(options: PrOptions) -> None:
    branch, base = creation_context(options)
    body = validate_proposal(options, base)
    refuse_duplicate(branch)
    upstream = probe("rev-parse", "-q", "--verify", "--abbrev-ref", "@{u}")
    expected = git("rev-parse", "HEAD")
    git(
        "-c",
        "push.followTags=false",
        "-c",
        "remote.origin.mirror=false",
        "push",
        *([] if upstream else ["-u"]),
        "origin",
        f"refs/heads/{branch}:refs/heads/{branch}",
    )
    effect, url = create_remote_pr(options, branch, base, body)
    publication.verify(
        publication.Publication(
            expected=expected,
            base=base,
            draft=str(options.draft).lower(),
            push="completed",
            create=effect,
            initial_url=url,
        )
    )
    if upstream and upstream != f"origin/{branch}":
        print(
            f"note: upstream is {upstream}; pushed and opened the PR from origin/{branch}"
        )


def run(args: list[str]) -> None:
    require_repository()
    operation = args[0] if args else ""
    if operation in {"verify", "publish-existing"}:
        publication.verify(
            publication.parse(args[1:]), publish=operation == "publish-existing"
        )
    elif operation == "inspect":
        pr_inspection.inspect(parse(args[1:], creating=False))
    elif operation == "create":
        create(parse(args[1:], creating=True))
    else:
        raise RefusalError(
            "usage: pr.sh inspect [--base <branch>] [--template <filename>] | create --title <t> -b <body-section>... [--template <filename>] [--base <branch>] [--draft] | publish-existing|verify --expected-head <full-commit-id> [--base <branch>] [--draft]",
            64,
        )
