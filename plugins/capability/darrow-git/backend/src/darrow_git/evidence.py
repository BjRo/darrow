"""One candidate-bound evidence publication, with no mutation retry."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import NoReturn

from . import evidence_preflight as preflight
from .evidence_files import Snapshot, prepared_file, snapshot
from .evidence_identity import Identity, Reconciliation, build, classify
from .evidence_options import EvidenceOptions, parse
from .process import RefusalError, git, invoke, probe, require
from .repository import current_branch


@dataclass
class Evidence:
    options: EvidenceOptions
    candidate: preflight.Candidate
    pr: preflight.PullRequest
    files: Snapshot
    identity: Identity
    prepared: Path
    prepared_hash: str
    head_snapshot: str
    index_snapshot: str
    stage: str = "reconciliation"
    observation: Reconciliation = field(default_factory=Reconciliation)
    observed_head: str = ""


def report(state: Evidence, outcome: str, effects: str, uncertainty: str) -> None:
    fields = [
        ("outcome", outcome),
        ("stage", state.stage),
        ("repository", state.candidate.repository),
        ("pr-url", state.pr.url),
        ("expected-head", state.options.expected),
        ("observed-head", state.observed_head),
        ("identity", state.identity.value),
        ("comment-url", state.observation.url or "unknown"),
        ("attachment-count", str(len(state.files.attachments))),
    ]
    fields.extend(
        (f"attachment-{index}", item.identity)
        for index, item in enumerate(state.files.attachments, 1)
    )
    fields.extend(
        (f"observed-attachment-{index}", asset)
        for index, asset in enumerate(state.observation.assets, 1)
    )
    fields.extend(
        [
            ("prepared-body", str(state.prepared)),
            ("attachment-snapshot", str(state.files.directory)),
            ("effects", effects),
            ("uncertainty", uncertainty),
            (
                "head-preserved",
                str(git("rev-parse", "HEAD") == state.head_snapshot).lower(),
            ),
            ("index-preserved", str(git("write-tree") == state.index_snapshot).lower()),
            (
                "files-preserved",
                str(
                    all(item.original.is_file() for item in state.files.attachments)
                ).lower(),
            ),
        ]
    )
    print("\n".join(f"{name}: {value}" for name, value in fields))


def finish(
    state: Evidence, outcome: str, effects: str, uncertainty: str, code: int
) -> NoReturn:
    report(state, outcome, effects, uncertainty)
    raise SystemExit(code)


def refuse(stage: str, error: Exception) -> NoReturn:
    print(
        f"outcome: refused\nstage: {stage}\neffects: none\nuncertainty: none\nerror: {str(error).removeprefix('error: ')}"
    )
    raise SystemExit(4) from error


def prepare(args: list[str]) -> Evidence:
    stage = "arguments"
    try:
        options = parse(args)
        candidate = preflight.candidate(options.expected)
        stage = "pr-preflight"
        pr = preflight.observe(candidate)
        require(
            pr.head == options.expected, "current PR head differs from expected head"
        )
        stage = "cli-preflight"
        preflight.cli_support()
        stage = "attachment-preflight"
        files = snapshot(options, candidate.top)
        identity = build(candidate.repository, pr.number, options.expected, files)
        prepared = prepared_file(identity.prepared, candidate.top)
        return Evidence(
            options,
            candidate,
            pr,
            files,
            identity,
            prepared,
            git("hash-object", str(prepared)),
            git("rev-parse", "HEAD"),
            git("write-tree"),
            observed_head=pr.head,
        )
    except (RefusalError, OSError) as error:
        refuse(stage, error)


def reconcile(state: Evidence) -> None:
    try:
        rows = preflight.comments(state.candidate, state.pr)
    except RefusalError as error:
        refuse(state.stage, error)
    state.observation = classify(rows, state.identity, len(state.files.attachments))
    outcomes = {
        "complete": ("existing", "none", 0),
        "partial": ("partial", "one incomplete candidate-bound comment exists", 5),
        "ambiguous": ("ambiguous", "conflicting candidate-bound comments exist", 5),
    }
    if state.observation.outcome in outcomes:
        outcome, uncertainty, code = outcomes[state.observation.outcome]
        finish(state, outcome, "none", uncertainty, code)


def recheck_files(state: Evidence) -> None:
    state.stage = "publication"
    state.observed_head = git("rev-parse", "HEAD")
    if state.observed_head != state.options.expected:
        finish(state, "refused", "none", "local head changed before publication", 4)
    if probe("hash-object", str(state.prepared)) != state.prepared_hash:
        finish(state, "refused", "none", "prepared body changed before publication", 4)
    if any(
        probe("hash-object", str(item.snapshot)) != item.content
        for item in state.files.attachments
    ):
        finish(
            state,
            "refused",
            "none",
            "attachment snapshot changed before publication",
            4,
        )


def publish(state: Evidence) -> int:
    args = ["gh", "pr", "comment", state.pr.url, "--body-file", str(state.prepared)]
    for item in state.files.attachments:
        value = item.snapshot.name + (f"#{item.text}" if item.kind == "image" else "")
        args.extend(["--attach", value])
    env = dict(os.environ, DARROW_EVIDENCE_REPOSITORY=str(state.candidate.top))
    result = invoke(args, cwd=state.files.directory, env=env)
    (state.files.directory / "comment-command.stdout").write_bytes(result.stdout)
    (state.files.directory / "comment-command.stderr").write_bytes(result.stderr)
    return result.returncode


def post_observation(state: Evidence) -> bool:
    same_candidate = False
    try:
        observed = preflight.observe(state.candidate)
        state.observed_head = observed.head
        same_candidate = observed == state.pr
    except RefusalError:
        state.observed_head = ""
    try:
        rows = preflight.comments(state.candidate, state.pr)
    except RefusalError:
        rows = ""
    state.observation = classify(rows, state.identity, len(state.files.attachments))
    return (
        same_candidate
        and current_branch() == state.candidate.branch
        and probe("rev-parse", "HEAD") == state.options.expected
    )


def complete(state: Evidence, returncode: int) -> None:
    state.stage = "post-publication"
    attempted = "one gh pr comment invocation attempted"
    if not post_observation(state):
        finish(state, "partial", attempted, "candidate head or PR identity changed", 5)
    if state.observation.outcome == "complete":
        finish(state, "published", "one gh pr comment invocation completed", "none", 0)
    if state.observation.outcome == "partial":
        finish(
            state,
            "partial",
            attempted,
            "incomplete candidate-bound comment observed",
            5,
        )
    finish(
        state,
        "ambiguous",
        attempted,
        f"publication result unclassifiable (command exit {returncode})",
        5,
    )


def run(args: list[str]) -> None:
    if not args or args[0] != "publish":
        raise RefusalError(
            "usage: publish.sh publish --expected-head <full-id> --body-file <path> [--image <path> --alt <text> | --video <path> --explanation <text>]...",
            64,
        )
    state = prepare(args[1:])
    reconcile(state)
    recheck_files(state)
    complete(state, publish(state))
