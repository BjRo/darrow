"""Opt-in real Artificer -> Ticket-to-PR -> Verification/Review, with feedback."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from assurance_control import REPLY, git
from assurance_evidence import goal_identity, retained_evidence
from assurance_fixture import installation
from assurance_judge import judge
from darrow_artificer import native, operations, processes
from darrow_artificer.github import array_value
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim
from darrow_artificer.storage import read_object, write_object
from live_native import observations


def ended(site: Installation, delivery: str, expected: str) -> Claim:
    deadline = time.monotonic() + 1800
    while time.monotonic() < deadline:
        claim = site.claim(delivery)
        if not processes.alive(claim.process):
            if claim.status != expected:
                raise RuntimeError(claim.model_dump_json())
            return claim
        time.sleep(0.2)
    raise TimeoutError(
        f"Native integration probe exceeded its test-only limit: {delivery}"
    )


def reply(root: Path, claim: Claim) -> None:
    state = read_object(root / "forge.json")
    comments = array_value(state["comments"])
    comments.append(
        {
            "id": 99,
            "issue": claim.issue,
            "body": f"/artificer reply {claim.id} {claim.question}\n{REPLY}",
            "user": {"login": "writer", "type": "User"},
        }
    )
    write_object(root / "forge.json", state)


def transcript_view(root: Path, home: Path, thread: str) -> Path:
    """Index actual ended native rollouts for the independent Review oracle."""
    view = root / "oracle-transcripts"
    entries = []
    for source in sorted((home / "sessions").rglob("*.jsonl")):
        relative = source.relative_to(home / "sessions")
        target = view / "codex" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        entries.append(
            {
                "path": str(relative),
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            }
        )
    assert entries
    write_object(
        view / "index.json",
        {
            "format": "sevro.native-transcripts.v2",
            "host": "codex",
            "role": "candidate",
            "completeness": "complete",
            "issues": [],
            "rootSessionId": thread,
            "files": entries,
        },
    )
    return view


def verify_assurance(root: Path, site: Installation, claim: Claim) -> dict[str, object]:
    assert claim.native is not None
    home = site.delivery_dir(claim.id) / "native"
    view = transcript_view(root, home, claim.native.thread)
    source = Path(__file__).resolve().parents[5]
    oracle = (
        source / "plugins/capability/darrow-review/backend/tests/evals/eval_routes.py"
    )
    environment = {
        **os.environ,
        "DARROW_REVIEW_STATE_DIR": str(root / "reviews"),
        "SEVRO_CANDIDATE_TRANSCRIPTS": str(view),
    }
    subprocess.run(
        [
            sys.executable,
            str(oracle),
            "--host",
            "codex",
            "--profile",
            "default",
            "--placement",
            "fallback",
            "--axes",
            "standards",
            "spec",
        ],
        cwd=claim.worktree,
        env=environment,
        check=True,
    )
    return observations(home, claim.native.thread)


def verify_publication(root: Path, claim: Claim) -> str:
    repo = Path(claim.worktree)
    commit = git(repo, "rev-parse", "HEAD")
    assert git(repo, "status", "--porcelain") == ""
    assert (
        git(repo, "ls-remote", "origin", f"refs/heads/{claim.branch}").split()[0]
        == commit
    )
    proposal = read_object(root / "proposal.json")
    assert proposal == {"head": commit, "branch": claim.branch, "number": 9}
    assert read_object(root / "ci.json") == {"commit": commit, "status": "success"}
    assert json.loads(git(repo, "show", f"{commit}:config.json")) == {
        "timeoutMs": 2500,
        "retries": 3,
    }
    return commit


def exercise(root: Path, site: Installation) -> dict[str, object]:
    started = time.monotonic()
    deliveries = operations.tick(site)
    assert len(deliveries) == 1
    reserved = site.claim(deliveries[0])
    write_object(
        root / "target.json", {"worktree": reserved.worktree, "branch": reserved.branch}
    )
    first = ended(site, reserved.id, "question")
    assert first.native is not None and first.goal_objective
    original_goal = goal_identity(site.delivery_dir(first.id), first, "active")
    assert (site.delivery_dir(first.id) / "session.enc").is_file()
    assert not (root / "proposal.json").exists()
    assert not (root / "release.txt").exists()
    subprocess.run(["bash", "check.sh"], cwd=first.worktree, check=True)
    grant = site.grant
    grant.WORK_IN_PROGRESS_LIMIT = 0
    site.save_grant(grant)
    reply(root, first)
    assert operations.tick(site) == []
    final = ended(site, first.id, "pr-open")
    assert final.native == first.native and final.goal_objective == first.goal_objective
    assert (
        goal_identity(site.delivery_dir(final.id), final, "complete") == original_goal
    )
    assert final.pr == 9 and final.consumed_comments == [99] and len(site.claims()) == 1
    commit = verify_publication(root, final)
    delivery_seconds = time.monotonic() - started
    assurance = verify_assurance(root, site, final)
    evidence = retained_evidence(root, site, final, commit)
    semantic = judge(root, site, evidence)
    return {
        "format": "darrow-artificer-assurance-probe-v1",
        "codex": native.VERSION,
        "real_engineering_recipe": True,
        "real_github_effects": False,
        "same_native_owner_and_goal": True,
        "native_goal_identity": original_goal,
        "reply_at_wip_zero": True,
        "admission_and_claim": final.id,
        "commit": commit,
        "required_ci": "success",
        "wall_seconds": delivery_seconds,
        "oracle_wall_seconds": time.monotonic() - started - delivery_seconds,
        "evidence_directory": str(root),
        "complete_candidate_bound_assurance": True,
        "semantic_grader": semantic,
        **assurance,
    }


def stop_probe(site: Installation) -> None:
    for claim in site.claims():
        if processes.alive(claim.process):
            operations.cancel(site, claim.id)


def trial(root: Path, codex: Path) -> dict[str, object]:
    site = installation(root, codex)
    try:
        return exercise(root, site)
    finally:
        stop_probe(site)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codex", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    root = Path(tempfile.mkdtemp(prefix="darrow-artificer-assurance-"))
    print(f"Evidence directory: {root}", flush=True)
    result = trial(root, args.codex)
    write_object(args.out.resolve(), result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
