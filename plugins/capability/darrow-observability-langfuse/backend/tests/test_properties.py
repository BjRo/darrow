from __future__ import annotations

import json
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_observability_langfuse.config import (
    Config,
    infer_work_item_id_from_branch,
)
from darrow_observability_langfuse.rollout import trace_document


@settings(derandomize=True, max_examples=100)
@given(
    kind=st.sampled_from(
        ["feat", "fix", "refactor", "perf", "docs", "test", "chore", "build", "ci"]
    ),
    prefix=st.from_regex(r"[A-Z][A-Z0-9]{0,7}", fullmatch=True),
    number=st.integers(min_value=1, max_value=999_999),
)
def test_branch_inference_preserves_the_exact_leading_token(
    kind: str, prefix: str, number: int
) -> None:
    token = f"{prefix}-{number}"

    assert infer_work_item_id_from_branch(f"{kind}/{token}-description") == token
    assert infer_work_item_id_from_branch(f"{kind}/description-{token}") is None


@settings(derandomize=True, max_examples=25)
@given(secret=st.text(alphabet=st.characters(categories=("L", "N")), min_size=8))
def test_configured_credentials_never_survive_content_capture(secret: str) -> None:
    records = [
        {"type": "session_meta", "payload": {"id": "property-session"}},
        {
            "type": "event_msg",
            "payload": {"type": "task_started", "turn_id": "property-turn"},
        },
        {
            "type": "event_msg",
            "payload": {"type": "user_message", "message": f"before {secret} after"},
        },
        {"type": "event_msg", "payload": {"type": "task_complete"}},
    ]
    with tempfile.TemporaryDirectory() as directory:
        rollout = Path(directory) / "rollout.jsonl"
        rollout.write_text(
            "".join(f"{json.dumps(record)}\n" for record in records), encoding="utf-8"
        )
        document = trace_document(
            rollout,
            Config(enabled=True, capture_content=True, secret_key=secret),
            directory,
        )

    serialized = json.dumps(document)
    assert secret not in serialized
    assert "[REDACTED]" in serialized
