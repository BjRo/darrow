"""External app-server fixture with an observed turn between transport incidents."""

import json
import os
import sys
from pathlib import Path
from typing import Any

import service_stub


class Host(service_stub.Host):
    def __init__(self, root: Path) -> None:
        super().__init__(root)
        self.active = False

    def after_turn(self) -> None:
        self.started = True
        path = self.root / "retry-turns.json"
        starts = json.loads(path.read_text()) if path.exists() else []
        starts.append({"identity": self.identity, "resuming": self.resuming})
        path.write_text(json.dumps(starts))
        if len(starts) == 2:
            self.active = True
            self.completed()
        elif len(starts) == 4:
            self.completed()
            return
        service_stub.emit(
            {
                "method": "error",
                "params": {
                    "threadId": self.identity,
                    "willRetry": False,
                    "error": {
                        "codexErrorInfo": "internalServerError",
                        "message": "temporary server error",
                    },
                },
            }
        )

    def goal(self, message: dict[str, Any]) -> dict[str, object]:
        return {
            "goal": {
                "threadId": self.identity,
                "objective": "Fixture delivery",
                "status": "active" if self.active else "blocked",
            }
            if self.started or self.resuming
            else None
        }

    def read(self, message: dict[str, Any]) -> dict[str, object]:
        if not self.active or not os.environ.get("ARTIFICER_MALFORMED_RETRY_TURN"):
            return super().read(message)
        return {
            "thread": {
                "id": self.identity,
                "turns": [
                    {
                        "id": "first",
                        "status": "completed",
                        "items": [
                            {
                                "type": "agentMessage",
                                "phase": "final_answer",
                                "text": "{}",
                            }
                        ],
                    }
                ],
            }
        }


def claude(root: Path) -> None:
    identity = sys.argv[
        sys.argv.index("--resume" if "--resume" in sys.argv else "--session-id") + 1
    ]
    path = root / "retry-turns.json"
    starts = json.loads(path.read_text()) if path.exists() else []
    starts.append({"identity": identity, "resuming": "--resume" in sys.argv})
    path.write_text(json.dumps(starts))
    service_stub.claude_initialized(identity, "")
    if len(starts) not in {2, 5}:
        service_stub.emit(
            {"type": "assistant", "session_id": identity, "error": "server_error"}
        )
        return
    service_stub.emit(
        {
            "type": "result",
            "subtype": "success",
            "is_error": False,
            "session_id": identity,
            "structured_output": service_stub.prepared_goal()
            if len(starts) == 2
            else service_stub.outcome(),
        }
    )


def main() -> None:
    root = Path(os.environ["ARTIFICER_TEST_STATE"])
    if Path(sys.argv[0]).name == "claude":
        claude(root)
        return
    host = Host(root)
    for line in sys.stdin:
        host.handle(json.loads(line))


if __name__ == "__main__":
    main()
