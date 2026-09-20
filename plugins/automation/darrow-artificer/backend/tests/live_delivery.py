"""Opt-in launchd -> real ChatGPT owner -> issue fixture reply -> same owner."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from darrow_artificer import native, processes, scheduler, setup
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim, Grant
from live_schedule import await_exit


def wait_question(site: Installation, previous: str | None = None) -> Claim:
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        claims = site.claims()
        if claims and not processes.alive(claims[0].process):
            claim = claims[0]
            if claim.status != "question":
                raise RuntimeError(claim.model_dump_json())
            if claim.question != previous:
                return claim
        time.sleep(0.2)
    raise TimeoutError(f"Owner did not return a question: {site.root}")


def fixture_plugin(root: Path) -> Path:
    plugin = root / "fixture-delivery"
    skill = plugin / "skills/ticket-to-pr"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(
        "---\nname: ticket-to-pr\ndescription: Explicit native transport integration fixture.\n---\n"
        "This is a transport-only fixture, not real engineering delivery. Spawn exactly one "
        "child named transport_owner. Tell it: remember private marker cobalt-157; ask 'Choose a color?'; "
        "on later feedback, ask a new question consisting of 'cobalt-157:' immediately followed by "
        "the exact feedback including all whitespace. No shell, edits or children. Wait for the "
        "child, retain it, and return its question with its canonical owner in the supplied schema. "
        "No commits, pushes, PRs or external effects in this fixture."
    )
    return plugin


def installation(root: Path) -> Installation:
    repo = root / "repo"
    repo.mkdir()
    subprocess.run(
        ["git", "init", "-b", "main", str(repo)], check=True, capture_output=True
    )
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-m",
            "chore: fixture",
        ],
        check=True,
        capture_output=True,
    )
    fixture = root / "gh"
    fixture.write_text(
        f"#!{sys.executable}\n" + Path(__file__).with_name("forge_stub.py").read_text()
    )
    fixture.chmod(0o700)
    (root / "forge.json").write_text(
        json.dumps({"ready": [157], "claimed": [], "comments": []})
    )
    site = Installation(root / "state")
    grant = Grant(
        id=str(uuid4()),
        repository="fixture/never-published",
        checkout=str(repo),
        common_git=str(repo / ".git"),
        grantor="writer",
        gh=str(fixture),
        codex=shutil.which("codex") or "codex",
        git=shutil.which("git") or "git",
        model="gpt-5.6-terra",
        effort="medium",
        credential_home=str(Path.home() / ".codex"),
        plugins=[str(fixture_plugin(root))],
        subscription_only_confirmed=True,
        effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
    )
    setup.bind(site, grant)
    return site


def activate(site: Installation) -> None:
    service = f"gui/{os.getuid()}/{scheduler.label(site)}"
    subprocess.run(
        ["/bin/launchctl", "kickstart", service], check=True, capture_output=True
    )
    await_exit(service)


def main() -> None:
    root = Path(tempfile.mkdtemp(prefix="darrow-artificer-delivery-"))
    print(f"Evidence directory: {root}", flush=True)
    site = installation(root)
    scheduler.install(site, Path(__file__).resolve().parents[1])
    try:
        activate(site)
        first = wait_question(site)
        assert first.native is not None
        assert (site.delivery_dir(first.id) / "session.enc").is_file()
        grant = site.grant
        grant.WORK_IN_PROGRESS_LIMIT = 0
        site.save_grant(grant)
        payload = "  violet\nKeep these bytes.\n"
        path = root / "forge.json"
        state = json.loads(path.read_text())
        state["comments"].append(
            {
                "id": 99,
                "issue": 157,
                "body": f"/artificer reply {first.id} {first.question}\n" + payload,
                "user": {"login": "writer", "type": "User"},
            }
        )
        path.write_text(json.dumps(state))
        activate(site)
        second = wait_question(site, first.question)
        assert second.native == first.native
        assert second.question != first.question
        assert second.question_text == "cobalt-157:" + payload
        assert second.consumed_comments == [99]
        assert len(site.claims()) == 1
        print(
            json.dumps(
                {
                    "codex": native.VERSION,
                    "scheduled_without_terminal": True,
                    "normal_persistent_chatgpt_login": True,
                    "wip_zero_reply": True,
                    "same_native_identity": second.native.model_dump(),
                    "exact_payload": True,
                    "real_github_effects": False,
                    "real_engineering_recipe": False,
                    "evidence_directory": str(root),
                },
                indent=2,
            ),
            flush=True,
        )
    finally:
        scheduler.remove(site)


if __name__ == "__main__":
    main()
