"""Export a fixture to an explicitly configured isolated Langfuse project."""
import json
import os
import tempfile
import uuid
from pathlib import Path

from darrow_observability_langfuse.capture import capture, delivery_rows
from darrow_observability_langfuse.config import Config
from darrow_observability_langfuse.delivery import drain


def main():
    config = Config(enabled=True, strict=True, capture_content=False,
                    public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
                    secret_key=os.environ["LANGFUSE_SECRET_KEY"],
                    base_url=os.environ["LANGFUSE_BASE_URL"], work_item_id="SMOKE-77")
    fixtures = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
    session_id = "smoke-77-" + uuid.uuid4().hex
    with tempfile.TemporaryDirectory() as directory:
        for source in fixtures.glob("*.jsonl"):
            (Path(directory) / source.name).write_text(source.read_text().replace("session-main", session_id))
        path = Path(directory) / "main-rollout.jsonl"
        metrics = capture(path, config, directory, session_id, "turn-1", None)
        assert drain(path, config, cwd=directory) == 1
        row = delivery_rows(path)[0]
        assert row["state"] == "acknowledged"
        print(json.dumps({"state": row["state"], "trace_id": row["identity"][:32],
                          "expected_observations": row["expected_count"], **metrics}))


if __name__ == "__main__":
    main()
