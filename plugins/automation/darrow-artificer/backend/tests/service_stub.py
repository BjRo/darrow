"""External native-host and forge processes for public CLI acceptance checks."""

import fcntl
import json
import os
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import uuid4


def emit(value: object) -> None:
    print(json.dumps(value), flush=True)


def skills() -> list[str]:
    values = ["adaptive-goal", "verify-change", "code-review", "ticket-to-pr"]
    if os.environ.get("ARTIFICER_MISSING_CORE"):
        values.remove("code-review")
    return values


def interrupted(root: Path, identity: str, resuming: bool) -> bool:
    path = root / "interruptions.json"
    if not path.exists():
        return False
    state = json.loads(path.read_text())
    state["starts"].append({"identity": identity, "resuming": resuming})
    if state.get("progress_on") == len(state["starts"]):
        event = {
            "type": "user",
            "message": {"content": [{"type": "tool_result", "is_error": False}]},
        }
        if Path(sys.argv[0]).name == "codex":
            event = {
                "method": "item/completed",
                "params": {
                    "threadId": identity,
                    "item": {"type": "commandExecution", "status": "completed"},
                },
            }
        emit(event)
    fail = bool(state["failures"] > 0)
    state["failures"] = max(0, state["failures"] - 1)
    path.write_text(json.dumps(state))
    return fail


def forge(root: Path) -> None:
    with (root / "forge.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = root / "forge.json"
        state = json.loads(path.read_text())
        result = github(state)
        path.write_text(json.dumps(state))
        if (
            os.environ.get("ARTIFICER_AMBIGUOUS_REPORT")
            and sys.argv[2].endswith("comments")
            and len(state["comments"]) > 1
        ):
            raise SystemExit("Comment acknowledgement lost")
        emit(result)


def github(state: dict[str, Any]) -> object:
    route = sys.argv[2]
    method = sys.argv[sys.argv.index("--method") + 1]
    if method != "GET":
        return mutate(state, route)
    if route == "user":
        return {"login": "writer"}
    if "permission" in route:
        return {"permission": "write"}
    if "/pulls/" in route:
        return state["pr"]
    return [collection(state, route)]


def collection(state: dict[str, Any], route: str) -> list[object]:
    if "/issues/" in route and "/labels?" in route:
        number = int(route.split("/")[4])
        return [{"name": "artificer:claimed"}] if number in state["claimed"] else []
    if "events?" in route:
        return [
            {
                "event": "labeled",
                "label": {"name": "artificer:ready"},
                "actor": {"login": "writer", "type": "User"},
            }
        ]
    if "/issues?" in route:
        return issue_collection(state, route)
    if "/pulls?" in route:
        return pull_collection(state)
    return []


def issue_collection(state: dict[str, Any], route: str) -> list[object]:
    key = "ready" if "artificer:ready" in route else "claimed"
    issues: list[object] = [{"number": number} for number in state[key]]
    pr = state.get("pr")
    if (
        key == "claimed"
        and pr
        and pr.get("state") == "open"
        and "artificer:claimed" in pr.get("labels", [])
    ):
        issues.append({"number": pr["number"], "pull_request": {}})
    return issues


def pull_collection(state: dict[str, Any]) -> list[object]:
    if os.environ.get("ARTIFICER_PUBLICATION_UNAVAILABLE"):
        raise SystemExit("Publication lookup unavailable")
    if state.get("duplicate_prs"):
        return [{"number": 9}, {"number": 10}]
    return [state["pr"]] if state.get("pr") else []


def mutate(state: dict[str, Any], route: str) -> object:
    body = json.load(sys.stdin) if "--input" in sys.argv else {}
    if route.endswith("comments"):
        state["comments"].append(body["body"])
        return {"id": len(state["comments"])}
    if "/issues/" in route:
        mutate_labels(state, route)
    return None


def mutate_labels(state: dict[str, Any], route: str) -> None:
    issue = int(route.split("/")[4])
    if route.endswith("/labels"):
        if state.get("pr") and issue == state["pr"]["number"]:
            state["pr"]["labels"] = ["artificer:claimed"]
        else:
            state["claimed"].append(issue)
    elif route.endswith("artificer%3Aready"):
        state["ready"].remove(issue)
    elif route.endswith("artificer%3Aclaimed"):
        state["claimed"].remove(issue)


def outcome() -> dict[str, object]:
    if os.environ.get("ARTIFICER_QUESTION"):
        return {
            "status": "question",
            "detail": "Product decision needed",
            "question": "Which customer role may approve this operation?",
            "pr": None,
        }
    if os.environ.get("ARTIFICER_COMPLETE"):
        root = Path(os.environ["ARTIFICER_TEST_STATE"])
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"], text=True
        ).strip()
        if os.environ.get("ARTIFICER_WRONG_PR"):
            branch = "unrelated"
        state = json.loads((root / "forge.json").read_text())
        state["pr"] = {
            "number": 9,
            "state": "open",
            "head": {"ref": branch, "repo": {"full_name": "o/r"}},
            "base": {
                "ref": "unrelated" if os.environ.get("ARTIFICER_WRONG_BASE") else "main"
            },
        }
        if os.environ.get("ARTIFICER_PR_RESULT") == "closed":
            state["pr"]["state"] = "closed"
        (root / "forge.json").write_text(json.dumps(state))
        return {
            "status": "pr-open",
            "detail": "Reviewable PR",
            "question": None,
            "pr": None if os.environ.get("ARTIFICER_PR_RESULT") == "missing" else 9,
        }
    return {
        "status": "needs-attention",
        "detail": "Specification needed; profile inherited",
        "question": None,
        "pr": None,
    }


def claude(root: Path) -> None:
    identifier = (
        sys.argv[sys.argv.index("--session-id") + 1]
        if "--session-id" in sys.argv
        else sys.argv[sys.argv.index("--resume") + 1]
    )
    (root / "session.txt").write_text(identifier)
    (root / "base.txt").write_text(
        subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    )
    mode = os.environ.get("ARTIFICER_CLAUDE_RESULT", "")
    if mode == "empty":
        return
    claude_initialized(identifier, mode)
    wait_for_release(root)
    if interrupted(root, identifier, "--resume" in sys.argv):
        if os.environ.get("ARTIFICER_EOF"):
            return
        emit({"type": "assistant", "session_id": identifier, "error": "server_error"})
        return
    if mode == "user-text":
        emit(
            {
                "type": "user",
                "message": {
                    "content": [{"type": "text", "text": "Progress without a tool"}]
                },
            }
        )
    result = goal_outcome(root, identifier, "--resume" in sys.argv)
    emit(
        {
            "type": "result",
            "is_error": mode == "error-result",
            "session_id": identifier,
            "structured_output": {} if mode == "invalid-result" else result,
        }
    )


def claude_initialized(identity: str, mode: str) -> None:
    if mode != "missing-init":
        emit(
            {
                "type": "system",
                "subtype": "init",
                "session_id": "different" if mode == "identity" else identity,
                "slash_commands": skills(),
            }
        )


def wait_for_release(root: Path) -> None:
    if os.environ.get("ARTIFICER_HOLD"):
        while not (root / "release-native").exists():
            time.sleep(0.02)


def prepared_goal() -> dict[str, object]:
    return {
        "status": "goal-required",
        "detail": "Read-only preflight ready",
        "goal": None
        if os.environ.get("ARTIFICER_GOAL_MODE") == "missing"
        else "Deliver the prepared ready ticket under the original grant",
        "question": None,
        "pr": None,
    }


def goal_outcome(root: Path, identity: str, resuming: bool) -> dict[str, object]:
    if not os.environ.get("ARTIFICER_REQUIRE_GOAL"):
        return outcome()
    path = root / "goal-handshake.json"
    trace = json.loads(path.read_text()) if path.exists() else []
    trace.append({"identity": identity, "resuming": resuming, "prompt": sys.argv[-1]})
    path.write_text(json.dumps(trace))
    if not resuming:
        if not sys.argv[-1].startswith("/darrow-ticket-to-pr:ticket-to-pr "):
            return {
                "status": "needs-attention",
                "detail": "Recipe requires explicit native invocation",
                "question": None,
                "pr": None,
            }
        return prepared_goal()
    if os.environ.get("ARTIFICER_GOAL_MODE") == "always":
        return prepared_goal()
    return goal_continued()


def goal_continued() -> dict[str, object]:
    if not sys.argv[-1].startswith("/goal "):
        return {
            "status": "needs-attention",
            "detail": "Native goal command required in original session",
            "question": None,
            "pr": None,
        }
    return (
        prepared_goal()
        if os.environ.get("ARTIFICER_GOAL_MODE") == "repeat"
        else outcome()
    )


class Host:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.identity = str(uuid4())
        self.started = False
        self.resuming = False

    def handle(self, message: dict[str, Any]) -> None:
        with (self.root / "requests.jsonl").open("a") as trace:
            trace.write(json.dumps(message) + "\n")
        method = message["method"]
        if self.invalid_schema(message):
            emit(
                {
                    "id": message["id"],
                    "error": {
                        "code": -32602,
                        "message": "Strict output schema requires every property",
                    },
                }
            )
            return
        handlers: dict[str, Callable[[dict[str, Any]], dict[str, object]]] = {
            "skills/list": self.catalog,
            "thread/start": self.thread,
            "thread/resume": self.thread,
            "thread/goal/get": self.goal,
            "thread/read": self.read,
        }
        result = handlers.get(method, self.empty)(message)
        if "id" in message:
            emit({"id": message["id"], "result": result})
        if method == "thread/resume" and os.environ.get("ARTIFICER_ACTIVE_RESUME"):
            self.started = True
            self.completed()
        if method == "turn/start":
            self.after_turn()

    def catalog(self, message: dict[str, Any]) -> dict[str, object]:
        return {
            "data": [
                {
                    "skills": [{"name": name, "enabled": True} for name in skills()],
                    "errors": [
                        {"path": "/unreadable/skill", "message": "permission denied"}
                    ]
                    if os.environ.get("ARTIFICER_SKILL_ERROR")
                    else [],
                }
            ]
        }

    def empty(self, message: dict[str, Any]) -> dict[str, object]:
        return {}

    def invalid_schema(self, message: dict[str, Any]) -> bool:
        if message["method"] != "turn/start" or not os.environ.get(
            "ARTIFICER_STRICT_SCHEMA"
        ):
            return False
        schema = message["params"].get("outputSchema")
        return bool(schema and set(schema["properties"]) != set(schema["required"]))

    def thread(self, message: dict[str, Any]) -> dict[str, object]:
        if os.environ.get("ARTIFICER_PROFILE_POLICY") and (
            "sandbox" in message["params"] or "approvalPolicy" in message["params"]
        ):
            raise ValueError("Configured permission profile was overridden")
        self.resuming = message["method"] == "thread/resume"
        self.identity = message["params"].get("threadId", self.identity)
        (self.root / "session.txt").write_text(self.identity)
        thread: dict[str, object] = {"id": self.identity}
        if self.resuming and os.environ.get("ARTIFICER_ACTIVE_RESUME"):
            thread["turns"] = [{"id": "first", "status": "inProgress"}]
        return {
            "thread": thread,
            "model": "profile-model",
            "reasoningEffort": None
            if os.environ.get("ARTIFICER_DEFAULT_EFFORT")
            else "medium",
            "modelProvider": "openai",
        }

    def goal(self, message: dict[str, Any]) -> dict[str, object]:
        goal = {
            "threadId": self.identity,
            "objective": "Fixture delivery",
            "status": "complete" if os.environ.get("ARTIFICER_COMPLETE") else "blocked",
        }
        return {"goal": goal if self.started else None}

    def read(self, message: dict[str, Any]) -> dict[str, object]:
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
                                "text": json.dumps(outcome()),
                            }
                        ],
                    }
                ],
            }
        }

    def after_turn(self) -> None:
        self.started = True
        if os.environ.get("ARTIFICER_PRIVATE_HISTORY"):
            emit(
                {
                    "method": "item/completed",
                    "params": {
                        "threadId": self.identity,
                        "item": {
                            "type": "agentMessage",
                            "text": "PRIVATE_NATIVE_HISTORY_CANARY",
                        },
                    },
                }
            )
        if interrupted(self.root, self.identity, self.resuming):
            if os.environ.get("ARTIFICER_EOF"):
                raise SystemExit(0)
            emit(
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
            return
        (self.root / "base.txt").write_text(
            subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        )
        self.completed()

    def completed(self) -> None:
        emit(
            {
                "method": "turn/completed",
                "params": {
                    "threadId": self.identity,
                    "turn": {"id": "first", "status": "completed"},
                },
            }
        )


def codex(root: Path) -> None:
    host = Host(root)
    for line in sys.stdin:
        host.handle(json.loads(line))


def main() -> None:
    root = Path(os.environ["ARTIFICER_TEST_STATE"])
    if Path(sys.argv[0]).name == "gh":
        forge(root)
    elif Path(sys.argv[0]).name == "claude":
        if (
            os.environ.get("ARTIFICER_PROFILE_POLICY")
            and "--dangerously-skip-permissions" in sys.argv
        ):
            raise SystemExit("Configured permission profile was overridden")
        if os.environ.get("ARTIFICER_TEST_NESTING") and os.environ.get("CLAUDECODE"):
            raise SystemExit(
                "Claude Code cannot be launched inside another Claude Code session"
            )
        claude(root)
    else:
        codex(root)


if __name__ == "__main__":
    main()
