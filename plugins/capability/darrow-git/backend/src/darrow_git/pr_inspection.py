"""Read-only PR readiness and template context."""

import shutil
from pathlib import Path

from . import templates
from .pr_options import PrOptions
from .pr_repository import compare_ref, default_branch, validate_base
from .process import decode, emit, git, invoke, probe, require, succeeds
from .publication import FULL_COMMIT
from .repository import current_ref, in_progress


def stopped() -> bool:
    if in_progress():
        print(
            "## mode: conflict (merge/rebase/cherry-pick in progress — do not open a PR; inform the user)\n## unmerged files"
        )
        emit(git("diff", "--name-only", "--diff-filter=U"), 50)
    elif not succeeds("rev-parse", "-q", "--verify", "HEAD"):
        print("## mode: empty (no commits yet — nothing to propose)")
    elif not succeeds("remote", "get-url", "origin"):
        print(
            "## mode: no-remote (no 'origin' remote — cannot create a PR; inform the user)"
        )
    else:
        return False
    return True


def wrong_branch(branch: str, default: str) -> bool:
    if branch.startswith("(detached"):
        print(
            f"## mode: wrong-branch (detached HEAD — a PR needs a branch; suggest create-branch)\n## cur: {branch}"
        )
    elif branch == default:
        print(
            f"## mode: wrong-branch (on the default branch — a PR needs a feature branch; suggest create-branch)\n## cur branch: {branch}"
        )
    else:
        return False
    return True


def existing_pr(branch: str) -> tuple[str, str]:
    if not shutil.which("gh"):
        return "", "## note: gh CLI not found — create will fail until it is installed"
    result = invoke(["gh", "pr", "list", "--head", branch, "--state", "open"])
    if result.returncode:
        return (
            "",
            "## note: could not check for an existing open PR (gh error) — create re-checks",
        )
    return decode(result.stdout), ""


def inspect(options: PrOptions) -> None:
    if stopped():
        return
    branch = current_ref()
    default, source = default_branch()
    if wrong_branch(branch, default):
        return
    if options.base:
        validate_base(options.base, branch)
    base = options.base or default
    base_source = "selected" if options.base else "default"
    existing, note = existing_pr(branch)
    comparison = compare_ref(base) if base != "(none)" else ""
    ahead = probe("rev-list", "--count", f"{comparison}..HEAD") if comparison else ""
    report_readiness(
        options, branch, base, base_source, source, existing, note, comparison, ahead
    )


def report_readiness(
    options: PrOptions,
    branch: str,
    base: str,
    base_source: str,
    source: str,
    existing: str,
    note: str,
    comparison: str,
    ahead: str,
) -> None:
    if existing:
        print(
            f"## mode: exists (open PR for this branch — report it; do not create another)\n## intended commit: {git('rev-parse', 'HEAD')}"
        )
        emit(existing, 50)
    elif ahead == "0":
        print(
            f"## mode: no-commits (no commits ahead of {comparison} — nothing to propose; report and stop)\n## cur branch: {branch}\n## base branch ({base_source}): {base}"
        )
    else:
        head = git("rev-parse", "HEAD")
        print(
            f"## mode: ready\n## intended commit: {head}\n## cur branch: {branch}\n## base branch ({base_source}): {base}"
        )
        if source == "guess":
            print(
                "## note: default branch guessed from local branches (origin/HEAD unset, remote unreachable)"
            )
        emit(note)
        context(comparison, ahead, head, options.template)


def context(comparison: str, ahead: str, head: str, template: str) -> None:
    upstream = probe("rev-parse", "-q", "--verify", "--abbrev-ref", "@{u}")
    if upstream:
        print(
            f"## upstream: {upstream} (ahead {git('rev-list', '--count', '@{u}..HEAD')}, behind {git('rev-list', '--count', 'HEAD..@{u}')})"
        )
    else:
        print("## upstream: none (create will push with -u)")
    comparison_commit = probe(
        "rev-parse", "--verify", "--end-of-options", f"{comparison}^{{commit}}"
    )
    if comparison_commit and ahead:
        print(f"## comparison commit: {comparison_commit}")
        print(f"## commits to include ({comparison}..HEAD)")
        emit(probe("log", "--format=%h %s", f"{comparison_commit}..{head}"), 50)
        print("## diffstat")
        emit(probe("diff", "--stat", f"{comparison_commit}...{head}"), 50)
    selected = templates.select(template, inspecting=True)
    if selected:
        templates.show(selected)
    print("## working tree (uncommitted changes will NOT be in the PR)")
    emit(git("status", "--porcelain") or "clean", 50)


def diff(args: list[str]) -> None:
    require(
        len(args) >= 2 and all(FULL_COMMIT.fullmatch(value) for value in args[:2]),
        "diff requires the full comparison and intended commit IDs from inspection",
        2,
    )
    comparison, head, *paths = args
    patch = git(
        "--literal-pathspecs",
        "diff",
        "--patch",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        f"{comparison}...{head}",
        "--",
        *paths,
        cwd=Path(git("rev-parse", "--show-toplevel")),
    )
    lines = patch[:16_000].splitlines()
    emit("\n".join(lines[:200]))
    if len(patch) > 16_000 or len(lines) > 200:
        print("## note: diff truncated — request specific paths for more detail")
