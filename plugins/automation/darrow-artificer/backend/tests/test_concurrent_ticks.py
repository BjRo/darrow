import json
import subprocess
import sys
import time
from pathlib import Path

from darrow_artificer.installation import Installation
from darrow_artificer.processes import alive
from test_admission import existing


def test_real_overlapping_cli_ticks_preserve_capacity(
    installation: Installation,
) -> None:
    grant = installation.grant
    grant.WORK_IN_PROGRESS_LIMIT, grant.MAX_STARTS_PER_ACTIVATION = 5, 3
    fixture = installation.root / "gh"
    fixture.write_text(
        f"#!{sys.executable}\n" + Path(__file__).with_name("forge_stub.py").read_text()
    )
    fixture.chmod(0o700)
    grant.gh = str(fixture)
    installation.save_grant(grant)
    credentials = Path(grant.credential_home)
    credentials.mkdir()
    (credentials / "auth.json").write_text("fixture credential, never sent to a model")
    existing(installation, 10)
    existing(installation, 11)
    external = installation.root / "forge.json"
    external.write_text(
        json.dumps({"ready": [1, 2, 3, 4, 5], "claimed": [10, 11], "comments": []})
    )
    args = [
        sys.executable,
        "-c",
        "from darrow_artificer.cli import entrypoint; entrypoint()",
        "--state",
        str(installation.root),
        "tick",
    ]
    children = [
        subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        for _ in range(2)
    ]
    results = [child.communicate(timeout=20) for child in children]
    assert [child.returncode for child in children] == [0, 0], results
    admitted = [
        identifier
        for stdout, _ in results
        for identifier in json.loads(stdout)["admitted"]
    ]
    assert len(admitted) == len(set(admitted)) == 3
    claims = installation.claims()
    assert len(claims) == 5
    assert {claim.issue for claim in claims} == {1, 2, 3, 10, 11}
    state = json.loads(external.read_text())
    assert state["claimed"] == [10, 11, 1, 2, 3] and state["ready"] == [4, 5]
    assert len(state["comments"]) == 3
    deadline = time.monotonic() + 20
    while (
        any(alive(claim.process) for claim in installation.claims())
        and time.monotonic() < deadline
    ):
        time.sleep(0.05)
    assert not any(alive(claim.process) for claim in installation.claims())
    # The intentionally unavailable Codex cannot result in replacement reservations.
    result = subprocess.run(args, capture_output=True, check=True)
    assert json.loads(result.stdout)["admitted"] == []
    assert len(installation.claims()) == 5
