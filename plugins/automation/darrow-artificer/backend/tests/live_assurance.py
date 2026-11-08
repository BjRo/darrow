"""Opt-in real Artificer -> Ticket-to-PR -> Verification/Review, with native resume."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

from assurance_control import FIXTURE_PR, git
from assurance_evidence import observations, retained_evidence, settled_goal
from assurance_fixture import codex_home, fixture_plugins, installation
from assurance_judge import judge
from darrow_artificer import operations, processes
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim
from darrow_artificer.storage import read_object, write_object

PROBE_SECONDS = 1800


def observe(site: Installation, delivery: str, ready: Callable[[Claim], bool]) -> Claim:
    deadline = time.monotonic() + PROBE_SECONDS
    while time.monotonic() < deadline:
        claim = site.claim(delivery)
        if ready(claim):
            return claim
        time.sleep(0.2)
    raise TimeoutError(
        f"Native integration probe exceeded its test-only limit: {delivery}"
    )


def ended(site: Installation, delivery: str, expected: str) -> Claim:
    claim = observe(site, delivery, lambda value: not processes.alive(value.process))
    if claim.status != expected:
        raise RuntimeError(claim.model_dump_json())
    return claim


def goal_started(site: Installation, delivery: str) -> Claim:
    def ready(claim: Claim) -> bool:
        if not processes.alive(claim.process):
            raise RuntimeError(
                f"Delivery ended before its goal: {claim.model_dump_json()}"
            )
        return claim.native is not None and claim.goal_objective is not None

    return observe(site, delivery, ready)


def interrupt_app_server(claim: Claim) -> int:
    """End the host process, never the worker, to force same-session resume."""
    assert claim.process is not None
    rows = subprocess.run(
        ["/bin/ps", "-axo", "pid=,ppid=,command="],
        text=True,
        capture_output=True,
        check=True,
    ).stdout.splitlines()
    servers = [
        int(fields[0])
        for fields in (row.split(None, 2) for row in rows)
        if len(fields) == 3
        and int(fields[1]) == claim.process.pid
        and "app-server" in fields[2]
    ]
    assert len(servers) == 1, "expected one app-server under the delivery worker"
    os.kill(servers[0], signal.SIGTERM)
    return servers[0]


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


def verify_assurance(root: Path, home: Path, claim: Claim) -> dict[str, object]:
    assert claim.native is not None
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
    assert proposal == {"head": commit, "branch": claim.branch, "number": FIXTURE_PR}
    assert read_object(root / "ci.json") == {"commit": commit, "status": "success"}
    assert json.loads(git(repo, "show", f"{commit}:config.json")) == {
        "timeoutMs": 2500,
        "retries": 3,
    }
    return commit


def deliver(root: Path, site: Installation) -> Claim:
    deliveries = operations.tick(site)
    assert len(deliveries) == 1
    reserved = site.claim(deliveries[0])
    write_object(
        root / "target.json", {"worktree": reserved.worktree, "branch": reserved.branch}
    )
    first = goal_started(site, reserved.id)
    interrupt_app_server(first)
    final = ended(site, first.id, "pr-open")
    assert final.native == first.native and final.goal_objective == first.goal_objective
    assert final.total_recovery_attempts == 1 and final.pr == FIXTURE_PR
    assert operations.tick(site) == []
    assert site.claim(final.id).status == "pr-open", "open PR must retain ownership"
    return final


def exercise(
    root: Path, site: Installation, home: Path, codex: Path, credentials: Path
) -> dict[str, object]:
    started = time.monotonic()
    final = deliver(root, site)
    goal = settled_goal(site.delivery_dir(final.id), final)
    assert goal["app_server_processes"] == 2
    commit = verify_publication(root, final)
    delivery_seconds = time.monotonic() - started
    assurance = verify_assurance(root, home, final)
    evidence = retained_evidence(root, home, final, commit)
    semantic = judge(root, codex, credentials, evidence)
    return {
        "format": "darrow-artificer-assurance-probe-v2",
        "codex": subprocess.run(
            [str(codex), "--version"], capture_output=True, text=True, check=True
        ).stdout.strip(),
        "real_engineering_recipe": True,
        "real_github_effects": False,
        "same_session_resume_after_process_exit": True,
        "native_goal": goal,
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


def trial(
    root: Path, codex: Path, credentials: Path, model: str, effort: str
) -> dict[str, object]:
    site = installation(root, codex)
    home = codex_home(
        root / "codex-home", credentials, model, effort, fixture_plugins(root)
    )
    # Artificer inherits the host profile; this probe supplies an isolated one.
    os.environ.update(
        {
            "CODEX_HOME": str(home),
            "DARROW_REVIEW_STATE_DIR": str(root / "reviews"),
            "DARROW_CACHE_DIR": str(root / "cache"),
        }
    )
    try:
        return exercise(root, site, home, codex, credentials)
    finally:
        stop_probe(site)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codex", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--credentials", type=Path, default=Path.home() / ".codex")
    parser.add_argument("--model", default="gpt-6.1-sol")
    parser.add_argument("--effort", default="medium")
    args = parser.parse_args()
    root = Path(tempfile.mkdtemp(prefix="darrow-artificer-assurance-"))
    print(f"Evidence directory: {root}", flush=True)
    result = trial(root, args.codex, args.credentials, args.model, args.effort)
    write_object(args.out.resolve(), result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
