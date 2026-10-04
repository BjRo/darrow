"""External Codex protocol fixture; no Darrow implementation imports."""

import json
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any


def emit(value: object) -> None:
    print(json.dumps(value), flush=True)


def completed(turn: str) -> dict[str, object]:
    return {
        "method": "turn/completed",
        "params": {
            "threadId": "original",
            "turn": {"id": turn, "status": "completed"},
        },
    }


class Host:
    def __init__(self, home: Path) -> None:
        self.home = home
        scenario = home / "scenario"
        self.scenario = scenario.read_text() if scenario.exists() else "complete"
        overrides = home / "overrides.json"
        self.overrides = json.loads(overrides.read_text()) if overrides.exists() else {}
        self.continued = False
        self.started = False

    def thread(self, message: dict[str, Any]) -> dict[str, object]:
        return {
            "thread": {"id": "original"},
            "model": "gpt-6-sol",
            "reasoningEffort": "medium",
            "modelProvider": "openai",
        }

    def turn(self, message: dict[str, Any]) -> dict[str, object]:
        self.started = True
        if (
            self.overrides.get("active_schema_none")
            and "outputSchema" in message["params"]
        ):
            self.overrides.setdefault("errors", {})["turn/start"] = {
                "code": -32603,
                "message": "failed to submit turn input: ActiveTurnOutputSchemaMismatch",
            }
        claim = json.loads((self.home.parent / "claim.json").read_text())
        assert claim["native"]["thread"] == "original"
        if self.scenario == "reply":
            assert (
                "  violet\\nKeep these bytes.\\n"
                in message["params"]["input"][0]["text"]
            )
        return {"turn": {"id": "first"}}

    def goal(self, message: dict[str, Any]) -> dict[str, object]:
        if not self.started:
            claim = json.loads((self.home.parent / "claim.json").read_text())
            if not claim.get("goal_objective"):
                return {"goal": None}
        return {
            "goal": {
                "threadId": "original",
                "objective": "Deliver the bounded task",
                "status": "complete" if self.continued else "active",
            }
        }

    def read(self, message: dict[str, Any]) -> dict[str, object]:
        if self.scenario == "fatal":
            emit(
                {
                    "method": "error",
                    "params": {
                        "threadId": "original",
                        "willRetry": False,
                        "error": {
                            "message": "Access expired",
                            "codexErrorInfo": "unauthorized",
                        },
                    },
                }
            )
        turn = "native-second"
        outcome = {
            "status": "pr-open",
            "detail": "Verified PR",
            "question": None,
            "pr": 9,
        }
        if self.scenario == "text-question":
            turn = "first"
            outcome = {
                "status": "question",
                "detail": "Scope needed",
                "question": "Choose a scope?",
                "pr": None,
            }
        return {
            "thread": {
                "id": "original",
                "turns": [
                    {
                        "id": turn,
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
            }
        }

    def after_turn(self) -> None:
        time.sleep(self.overrides.get("turn_delay", 0))
        if self.scenario == "question":
            emit(
                {
                    "id": "ask-1",
                    "method": "item/tool/requestUserInput",
                    "params": {
                        "threadId": "original",
                        "turnId": "first",
                        "itemId": "item-1",
                        "isBlocking": True,
                        "questions": [
                            {
                                "id": "color",
                                "header": "Color",
                                "question": "Choose a color?",
                                "options": [
                                    {"label": "Violet", "description": "Use violet."}
                                ],
                            }
                        ],
                    },
                }
            )
        else:
            emit(completed("first"))

    def after_goal(self) -> None:
        if not self.started:
            return
        if not self.continued and self.scenario != "text-question":
            self.continued = True
            emit(completed("native-second"))

    def handle(self, message: dict[str, Any]) -> None:
        method = message["method"]
        if method in self.overrides.get("no_reply", []):
            return
        handlers = {
            "thread/start": self.thread,
            "thread/resume": self.thread,
            "turn/start": self.turn,
            "thread/goal/get": self.goal,
            "thread/read": self.read,
        }
        result = handlers[method](message) if method in handlers else {}
        result = self.overrides.get("responses", {}).get(method, result)
        for value in self.overrides.get("before", {}).get(method, []):
            emit(value)
        if "id" in message:
            self.reply(message["id"], method, result)
        after = {"turn/start": self.after_turn, "thread/goal/get": self.after_goal}
        if method in after:
            after[method]()

    def reply(self, identifier: object, method: str, result: object) -> None:
        errors = self.overrides.get("errors", {})
        if method in errors:
            emit({"id": identifier, "error": errors[method]})
        else:
            values = [
                {"id": identifier, "result": result},
                *self.overrides.get("after_response", {}).get(method, []),
            ]
            sys.stdout.write("".join(json.dumps(value) + "\n" for value in values))
            sys.stdout.flush()


def main() -> None:
    if sys.argv[1] != "app-server":
        raise SystemExit("Expected app-server transport")
    host = Host(Path(os.environ["CODEX_HOME"]))
    if host.overrides.get("ignore_termination"):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.alarm(2)
    for line in sys.stdin:
        host.handle(json.loads(line))


if __name__ == "__main__":
    main()
