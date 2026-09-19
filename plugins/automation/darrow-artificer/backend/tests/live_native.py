"""Opt-in real CLI/ChatGPT restoration trial; not part of offline pytest."""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from uuid import uuid4

from cryptography.fernet import Fernet

from darrow_artificer import archive, native
from darrow_artificer.models import Grant, Outcome


def invoke(
    grant: Grant, home: Path, prompt: str, stage: str, parent: str | None = None
) -> tuple[Path, Outcome]:
    output, events = home.parent / f"{stage}.json", home.parent / f"{stage}.jsonl"
    args = native.command(grant, home, output, parent)
    args.insert(-1, "--skip-git-repo-check")
    with events.open("wb") as stream:
        result = subprocess.run(
            args,
            input=prompt.encode(),
            stdout=stream,
            stderr=subprocess.PIPE,
            cwd=home.parent,
            env=native.environment(home),
            check=False,
            timeout=180,
        )
    if result.returncode:
        raise RuntimeError(
            f"Native trial exited {result.returncode}: {result.stderr.decode()}"
        )
    return events, Outcome.model_validate_json(output.read_bytes())


def main() -> None:
    directory = Path(tempfile.mkdtemp(prefix="darrow-artificer-native-"))
    print(f"Evidence directory: {directory}", flush=True)
    home = directory / "native"
    grant = Grant(
        id=str(uuid4()),
        repository="fixture/read-only",
        checkout=str(directory),
        common_git=str(directory / ".git"),
        grantor="local-integration-test",
        codex=shutil.which("codex") or "codex",
        gh="unused",
        git="unused",
        model="gpt-5.6-terra",
        effort="medium",
        credential_home=str(Path.home() / ".codex"),
        subscription_only_confirmed=True,
        effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
    )
    native.prepare_home(home, grant)
    native.check_login(grant, home)
    marker = "amber-" + str(uuid4())
    events, outcome = invoke(
        grant,
        home,
        "Read-only native restoration integration test. Spawn exactly one subagent named continuity_owner. "
        f"Tell it to privately remember {marker} and reply READY. No shell, no edits, no children. "
        "Wait for its result, do not close it, then return JSON with status question, detail READY, "
        "question Continue?, pr null, and owner the accepted canonical child reference.",
        "initial",
    )
    parent = native.thread_id(events)
    assert outcome.owner is not None
    before = native.correlate(home, parent, outcome.owner, grant)
    key = Fernet.generate_key()
    encrypted = directory / "session.enc"
    archive.save(home, encrypted, key)
    shutil.move(str(home), directory / "original-native")
    archive.restore(encrypted, home, key)
    assert not (home / "auth.json").exists()
    (home / "auth.json").symlink_to(Path(grant.credential_home) / "auth.json")
    events, outcome = invoke(
        grant,
        home,
        f"Authorized continuation. Do not spawn. Follow up with retained {before.owner}, asking it "
        "to repeat its private continuity marker and append RESTORED. Do not include the marker "
        "yourself. Wait for that same owner. Return status question, detail its complete answer, "
        "question Continue?, pr null, and owner the same canonical reference. No shell or edits.",
        "restored",
        parent,
    )
    assert native.thread_id(events) == parent
    after = native.correlate(home, parent, outcome.owner or "", grant)
    assert before == after
    assert marker + " RESTORED" in outcome.detail
    evidence = {
        "codex": native.VERSION,
        "before": before.model_dump(),
        "after": after.model_dump(),
        "history_challenge_passed": True,
        "encrypted_restore_passed": True,
        "credentials_excluded": True,
        "processes": 2,
        "evidence_directory": str(directory),
    }
    print(json.dumps(evidence, indent=2), flush=True)


if __name__ == "__main__":
    main()
