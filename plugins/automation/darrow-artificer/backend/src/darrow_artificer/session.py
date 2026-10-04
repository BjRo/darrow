"""Host one original native thread; the skill coordinates all engineering work."""

from collections.abc import Callable
from pathlib import Path

from pydantic import ValidationError

from .github import object_value, text_value
from .models import Grant, Native, Outcome
from .rpc import Rpc


class Session:
    def __init__(
        self,
        rpc: Rpc,
        grant: Grant,
        cwd: Path,
        previous_goal: str | None = None,
        observed_goal: Callable[[str], None] = lambda objective: None,
    ) -> None:
        self.rpc, self.grant, self.cwd = rpc, grant, cwd
        self.thread = ""
        self.resuming = False
        self.objective = previous_goal
        self.observed_goal = observed_goal

    def start(
        self, previous: Native | None, accepted: Callable[[Native], None]
    ) -> None:
        self.resuming = previous is not None
        self.rpc.call(
            "initialize",
            {
                "clientInfo": {"name": "darrow_artificer", "version": "0.2.0"},
                "capabilities": {"experimentalApi": True},
            },
        )
        self.rpc.send({"method": "initialized", "params": {}})
        params: dict[str, object] = {
            "cwd": str(self.cwd),
            "model": self.grant.model,
            "modelProvider": "openai",
            "config": {"model_reasoning_effort": self.grant.effort},
            "approvalPolicy": "never",
            "sandbox": "danger-full-access",
        }
        if previous:
            params["threadId"] = previous.thread
        else:
            params.update({"ephemeral": False, "allowProviderModelFallback": False})
        result = self.rpc.call("thread/resume" if previous else "thread/start", params)
        self.thread = text_value(object_value(result["thread"])["id"])
        observed = Native(
            thread=self.thread,
            model=text_value(result["model"]),
            effort=text_value(result["reasoningEffort"]),
        )
        if (observed.model, observed.effort, result.get("modelProvider")) != (
            self.grant.model,
            self.grant.effort,
            "openai",
        ):
            raise ValueError("App-server effective main-thread route changed")
        if previous is not None and previous != observed:
            raise ValueError("App-server resumed a different native identity")
        accepted(observed)
        self.rpc.record({"type": "thread.started", "thread_id": self.thread})
        self.goal_status()

    def submit(self, prompt: str) -> None:
        params: dict[str, object] = {
            "threadId": self.thread,
            "model": self.grant.model,
            "effort": self.grant.effort,
            "input": [{"type": "text", "text": prompt, "text_elements": []}],
        }
        if not self.resuming:
            params["outputSchema"] = Outcome.model_json_schema()
        self.rpc.call("turn/start", params)

    def wait(self) -> Outcome:
        while True:
            result = self.observe(self.rpc.next())
            if result is not None:
                return result

    def observe(self, message: dict[str, object]) -> Outcome | None:
        if "id" in message:
            return self.question(message)
        params = object_value(message.get("params", {}))
        if params.get("threadId") != self.thread:
            return None
        method = message.get("method")
        self.check_notification(method, params)
        if method == "thread/goal/updated":
            self.remember_goal(object_value(params["goal"]))
        if method == "turn/completed":
            return self.completed(object_value(params["turn"]))
        return None

    def question(self, message: dict[str, object]) -> Outcome:
        params = object_value(message.get("params"))
        if (
            message.get("method") != "item/tool/requestUserInput"
            or params.get("threadId") != self.thread
        ):
            raise RuntimeError(
                f"Unanswered app-server request: {message.get('method')}"
            )
        questions = params.get("questions")
        if not isinstance(questions, list) or not questions:
            raise ValueError("Native question request is empty")
        self.goal_status()
        # Do not manufacture an answer. Save the question and end this host process;
        # its later authorized answer enters the same persisted main thread.
        content = "\n\n".join(
            render_question(object_value(value)) for value in questions
        )
        return Outcome(
            status="question",
            detail="Native question awaits an authorized answer",
            question=content,
            pr=None,
        )

    def goal_status(self) -> str | None:
        result = self.rpc.call("thread/goal/get", {"threadId": self.thread})
        goal = result.get("goal")
        if goal is None:
            if self.objective is not None:
                raise ValueError("Original native goal disappeared")
            return None
        return self.remember_goal(object_value(goal))

    def remember_goal(self, value: dict[str, object]) -> str:
        objective = text_value(value["objective"])
        status = text_value(value["status"])
        if value.get("threadId") != self.thread or not 0 < len(objective) <= 4000:
            raise ValueError("Invalid native goal identity or objective")
        if status not in {
            "active",
            "paused",
            "blocked",
            "usageLimited",
            "budgetLimited",
            "complete",
        }:
            raise ValueError("Unknown native goal status")
        if self.objective is not None and objective != self.objective:
            raise ValueError("Original native goal objective changed")
        if self.objective is None:
            self.observed_goal(objective)
        self.objective = objective
        return status

    def check_notification(self, method: object, params: dict[str, object]) -> None:
        check_error(method, params)
        if method == "thread/goal/cleared" and self.objective is not None:
            raise ValueError("Original native goal was cleared")

    def completed(self, turn: dict[str, object]) -> Outcome | None:
        if turn.get("status") != "completed":
            raise RuntimeError(f"Codex turn failed: {turn}")
        status = self.goal_status()
        outcome = self.read_outcome(text_value(turn["id"]), status)
        if outcome is None:
            return None
        if status == "active" and outcome.status != "question":
            return None
        return self.accept_outcome(outcome, status, text_value(turn["id"]))

    def accept_outcome(
        self, outcome: Outcome, status: str | None, turn: str
    ) -> Outcome | None:
        if outcome.status == "pr-open" and status != "complete":
            raise ValueError("PR completion requires observed native goal completion")
        if not self.settled(turn):
            return None
        self.rpc.record(
            {
                "type": "artificer.settled",
                "thread_id": self.thread,
                "turn_id": turn,
                "goal_status": status,
            }
        )
        return outcome

    def read_outcome(self, turn_id: str, status: str | None) -> Outcome | None:
        result = self.rpc.call(
            "thread/read", {"threadId": self.thread, "includeTurns": True}
        )
        try:
            return final_outcome(object_value(result["thread"]), self.thread, turn_id)
        except ValidationError:
            if status == "active":
                return None
            raise

    def settled(self, turn: str) -> bool:
        self.rpc.drain()
        ready = not self.rpc.buffer
        for message in self.rpc.pending:
            params = object_value(message.get("params", {}))
            if params.get("threadId") == self.thread:
                ready = self.check_pending(message, params, turn) and ready
        return ready

    def check_pending(
        self, message: dict[str, object], params: dict[str, object], turn: str
    ) -> bool:
        method = message.get("method")
        self.check_notification(method, params)
        if method in {"turn/started", "turn/completed"}:
            return object_value(params["turn"]).get("id") == turn
        if method == "thread/goal/updated":
            return object_value(params["goal"]).get("status") != "active"
        return "id" not in message


def final_outcome(
    thread: dict[str, object], identity: str, turn_id: str
) -> Outcome | None:
    if thread.get("id") != identity:
        raise ValueError("App-server read another thread")
    turns = thread.get("turns")
    if not isinstance(turns, list) or not turns:
        raise ValueError("Missing native turn history")
    turn = object_value(turns[-1])
    if turn.get("id") != turn_id and turn.get("status") in {"inProgress", "completed"}:
        return None
    if turn.get("status") != "completed":
        raise ValueError("Native final turn did not complete")
    return turn_outcome(turn)


def turn_outcome(turn: dict[str, object]) -> Outcome:
    items = turn.get("items")
    if not isinstance(items, list):
        raise ValueError("Missing native final response")
    messages = [object_value(item) for item in items]
    finals = [
        item
        for item in messages
        if item.get("type") == "agentMessage" and item.get("phase") == "final_answer"
    ]
    if len(finals) != 1:
        raise ValueError("Native final response is missing or ambiguous")
    return Outcome.model_validate_json(text_value(finals[0]["text"]))


def render_question(value: dict[str, object]) -> str:
    text = text_value(value["question"])
    options = value.get("options")
    if isinstance(options, list):
        for item in options:
            option = object_value(item)
            text += f"\n- {text_value(option['label'])}: {text_value(option['description'])}"
    return text


def check_error(method: object, params: dict[str, object]) -> None:
    if method == "error" and params.get("willRetry") is not True:
        raise RuntimeError(f"Codex fatal error: {params.get('error')}")
