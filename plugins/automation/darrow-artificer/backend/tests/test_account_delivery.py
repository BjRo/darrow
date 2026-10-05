import json
import subprocess
import sys

import pytest
from cryptography.fernet import Fernet

from darrow_artificer import native
from darrow_artificer.installation import Installation
from test_app_server import prepare_host
from test_native import rollout


@pytest.mark.parametrize("included_remaining", [True, False])
def test_worker_accepts_account_credits(
    installation: Installation, included_remaining: bool
) -> None:
    claim, home = prepare_host(installation)
    rollout(home, "original", model="gpt-6-sol")
    claim.native = native.correlate(home, "original", installation.grant)
    claim.pending_answer = "Continue the authorized delivery."
    installation.save(claim)
    (installation.root / "archive.key").write_bytes(Fernet.generate_key())
    outcome = {
        "status": "needs-attention",
        "detail": "Readiness rejected: acceptance criteria missing",
        "question": None,
        "pr": None,
    }
    (home / "overrides.json").write_text(
        json.dumps(
            {
                "responses": {
                    "account/rateLimits/read": {
                        "ordinaryUsageAllowed": included_remaining,
                        "rateLimits": {
                            "planType": "pro",
                            "credits": {"hasCredits": True, "unlimited": False},
                            "primary": {
                                "usedPercent": 42 if included_remaining else 100
                            },
                        },
                    },
                    "thread/read": {
                        "thread": {
                            "id": "original",
                            "turns": [
                                {
                                    "id": "native-second",
                                    "status": "completed",
                                    "items": [
                                        {
                                            "type": "agentMessage",
                                            "id": "final",
                                            "phase": "final_answer",
                                            "text": json.dumps(outcome),
                                        }
                                    ],
                                }
                            ],
                        },
                    },
                },
            }
        )
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "darrow_artificer.worker",
            str(installation.root),
            claim.id,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=10,
    )
    saved = installation.claim(claim.id)
    assert saved.status == "needs-attention"
    assert saved.detail == outcome["detail"]
    assert saved.native == claim.native
    assert (home.parent / "session.enc").is_file()
