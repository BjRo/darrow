"""Opt-in real app-server probes in disposable state; no real GitHub effects."""

import argparse
import json
import shutil
import signal
import time
from pathlib import Path
from types import FrameType
from uuid import uuid4

from darrow_artificer import archive, native, setup, worker
from darrow_artificer.github import object_value, text_value
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim, Grant, Outcome
from darrow_artificer.storage import write_object


def fixture(root: Path, scenario: str) -> Path:
    plugin = root / "transport-fixture"
    skill = plugin / "skills/ticket-to-pr"
    skill.mkdir(parents=True)
    (plugin / ".codex-plugin").mkdir()
    (plugin / ".codex-plugin/plugin.json").write_text('{"name":"transport-fixture"}')
    instructions = (
        "This is an explicitly authorized native transport test. Do not access GitHub, "
        "commit, push, publish or edit repository files. The PR number 9 is a fictional "
        "transport result, not a claim about a real PR. Read marker.txt once and remember "
        "its exact text in this original main thread. "
    )
    if scenario != "preflight":
        instructions += (
            "Create a native goal in this main thread: 'Complete this authorized transport "
            "probe and return the remembered marker after any required answer.' "
        )
    if scenario == "completion":
        instructions += (
            "Delegate one bounded read-only assignment to a child named implementor on "
            "gpt-6-luna/medium with fork_turns none: return READY without goals or edits. "
            "Wait for its completed result. In your first final response, leave the goal "
            "active and return status needs-attention, detail containing the remembered "
            "marker and 'native continuation pending', question null, pr null. This is "
            "an intermediate transport probe response. When the host automatically "
            "continues the native goal, mark that original goal complete and return status "
            "pr-open, detail containing the remembered marker, question null, pr 9."
        )
    else:
        instructions += (
            "Ask 'Choose a color?' and yield status question, detail containing the remembered "
            "marker, question 'Choose a color?', pr null. Wait for the actual answer. "
            "On continuation, retain any existing goal; if no goal exists yet, create the "
            "bounded probe goal now. The marker file will be unavailable; use your original "
            "history. Mark the original goal complete only after receiving the answer. "
            "Return status pr-open, detail containing the remembered marker immediately "
            "followed by a colon and the complete human answer, question null, pr 9."
        )
    (skill / "SKILL.md").write_text(
        "---\nname: ticket-to-pr\ndescription: Explicit Artificer transport fixture.\n---\n"
        + instructions
    )
    return plugin


def installation(root: Path, scenario: str) -> tuple[Installation, Claim, str]:
    marker = str(uuid4())
    (root / "marker.txt").write_text(marker)
    grant = Grant(
        id=str(uuid4()),
        repository="fixture/never-published",
        checkout=str(root),
        common_git=str(root / ".git"),
        grantor="authorized-probe",
        codex=shutil.which("codex") or "codex",
        gh="/bin/false",
        git="/usr/bin/git",
        model="gpt-6-sol",
        effort="medium",
        credential_home=str(Path.home() / ".codex"),
        plugins=[str(fixture(root, scenario))],
        account_usage_accepted=True,
        effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
    )
    result = Installation(root / "state")
    setup.bind(result, grant)
    claim = Claim(
        id=str(uuid4()),
        issue=1,
        activation=str(uuid4()),
        grant=grant.id,
        worktree=str(root),
        branch="fixture",
        status="running",
        created_at=time.time(),
    )
    result.save(claim)
    return result, claim, marker


def restore(result: Installation, claim: Claim, home: Path) -> None:
    key = (result.root / "archive.key").read_bytes()
    encrypted = home.parent / "session.enc"
    archive.save(home, encrypted, key)
    shutil.move(str(home), str(home.parent / "original-native"))
    archive.restore(encrypted, home, key)
    assert not (home / "auth.json").exists()
    (home / "auth.json").symlink_to(Path(result.grant.credential_home) / "auth.json")
    assert claim.native is not None
    assert native.correlate(home, claim.native.thread, result.grant) == claim.native


def actor_usage(path: Path) -> dict[str, object]:
    rows = native.records(path)
    metadata = [
        object_value(row["payload"])
        for row in rows
        if row.get("type") == "session_meta"
    ]
    contexts = [
        object_value(row["payload"])
        for row in rows
        if row.get("type") == "turn_context"
    ]
    counts = [
        object_value(row["payload"]) for row in rows if row.get("type") == "event_msg"
    ]
    counts = [
        object_value(value["info"])
        for value in counts
        if value.get("type") == "token_count" and value.get("info") is not None
    ]
    assert len(metadata) == 1 and contexts and counts
    return {
        "thread": metadata[0]["id"],
        "parent": metadata[0].get("parent_thread_id"),
        "model": contexts[-1]["model"],
        "effort": contexts[-1]["effort"],
        "usage": counts[-1]["total_token_usage"],
    }


def observations(home: Path, thread: str) -> dict[str, object]:
    actors = [
        actor_usage(path) for path in sorted((home / "sessions").rglob("*.jsonl"))
    ]
    roots = [actor for actor in actors if actor["parent"] is None]
    assert len(roots) == 1 and roots[0]["thread"] == thread
    identities = {text_value(actor["thread"]) for actor in actors}
    assert all(
        actor["parent"] in identities for actor in actors if actor["parent"] is not None
    )
    usage = [object_value(actor["usage"]) for actor in actors]
    fields = [
        "input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_output_tokens",
        "total_tokens",
    ]
    return {
        "actors": actors,
        "whole_tree_usage": {
            field: sum(int(str(value[field])) for value in usage) for field in fields
        },
        "dollar_cost": None,
    }


def trial(root: Path, scenario: str) -> dict[str, object]:
    result, claim, marker = installation(root, scenario)
    home = result.delivery_dir(claim.id) / "native"
    native.prepare_home(home, result.grant)
    native.check_login(result.grant, home)
    started = time.monotonic()
    events, output = worker.execute(result, claim, home)
    first = Outcome.model_validate_json(output.read_bytes())
    original = result.claim(claim.id)
    assert original.native is not None
    assert (original.goal_objective is None) == (scenario == "preflight")
    assert marker in first.detail
    if scenario != "completion":
        assert first.status == "question"
        (root / "marker.txt").unlink()
        restore(result, original, home)
        original.pending_answer = "  violet\nKeep these bytes.\n"
        events, output = worker.execute(result, original, home)
        final = Outcome.model_validate_json(output.read_bytes())
        assert marker + ":" + original.pending_answer in final.detail
    else:
        final = first
    assert final.status == "pr-open" and final.pr == 9
    assert result.claim(claim.id).native == original.native
    retained_goal = result.claim(claim.id).goal_objective
    assert retained_goal is not None
    assert original.goal_objective is None or retained_goal == original.goal_objective
    native.require_completion(events, original.native.thread)
    completed_turns = [
        row
        for row in native.records(events)
        if row.get("method") == "turn/completed"
        and object_value(row["params"]).get("threadId") == original.native.thread
    ]
    if scenario == "completion":
        assert len(completed_turns) >= 2
    return {
        "case": scenario,
        "codex": native.VERSION,
        "native": original.native.model_dump(),
        "task": "pass",
        "same_thread": True,
        "goal_preserved_or_created_after_preflight": True,
        "history_and_answer": "pass",
        "root_completed_turns_last_invocation": len(completed_turns),
        "archive_restored": scenario != "completion",
        "wall_seconds": time.monotonic() - started,
        "real_github_effects": False,
        "real_engineering_recipe": False,
        "account_usage_accepted": result.grant.account_usage_accepted,
        "test_only_credit_exception": False,
        **observations(home, original.native.thread),
    }


def experiment_timeout(signum: int, frame: FrameType | None) -> None:
    raise TimeoutError(
        "Native transport experiment exceeded its test-only duration limit"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--case", choices=["completion", "preflight", "goal-feedback"], required=True
    )
    parser.add_argument("--timeout-seconds", type=float, default=3600)
    args = parser.parse_args()
    if args.timeout_seconds <= 0:
        parser.error("--timeout-seconds must be positive")
    args.out.mkdir(parents=True, exist_ok=False)
    print(f"Evidence directory: {args.out}", flush=True)
    signal.signal(signal.SIGALRM, experiment_timeout)
    signal.setitimer(signal.ITIMER_REAL, args.timeout_seconds)
    try:
        evidence = trial(args.out.resolve(), args.case)
    except Exception as error:
        write_object(
            args.out / "result.json",
            {"case": args.case, "status": "failed", "error": str(error)},
        )
        raise
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    write_object(args.out / "result.json", evidence)
    print(json.dumps(evidence, indent=2), flush=True)


if __name__ == "__main__":
    main()
