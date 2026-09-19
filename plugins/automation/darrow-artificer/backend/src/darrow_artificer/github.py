"""GitHub observations and narrowly scoped claim/comment effects via gh."""

import json
import subprocess
from typing import cast


def object_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("Expected GitHub JSON object")
    return cast(dict[str, object], value)


def array_value(value: object) -> list[object]:
    if not isinstance(value, list):
        raise ValueError("Expected GitHub JSON array")
    return cast(list[object], value)


def text_value(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Expected GitHub string")
    return value


def number_value(value: object) -> int:
    if type(value) is not int:
        raise ValueError("Expected GitHub integer")
    return value


class GitHub:
    def __init__(self, executable: str, repository: str) -> None:
        self.executable = executable
        self.repository = repository

    def request(
        self,
        route: str,
        method: str = "GET",
        body: dict[str, object] | None = None,
        pages: bool = False,
    ) -> object:
        command = [self.executable, "api", route, "--method", method]
        if pages:
            command += ["--paginate", "--slurp"]
        if body is not None:
            command += ["--input", "-"]
        result = subprocess.run(
            command,
            input=json.dumps(body) if body else None,
            text=True,
            capture_output=True,
            check=True,
        )
        return json.loads(result.stdout or "null")

    def route(self, suffix: str) -> str:
        return f"repos/{self.repository}/{suffix}"

    def collection(self, suffix: str) -> list[dict[str, object]]:
        pages = array_value(self.request(self.route(suffix), pages=True))
        return [object_value(item) for page in pages for item in array_value(page)]

    def writable(self, user: str) -> bool:
        result = object_value(
            self.request(self.route(f"collaborators/{user}/permission"))
        )
        return result.get("permission") in ("write", "admin", "maintain")

    def login(self) -> str:
        return text_value(object_value(self.request("user"))["login"])

    def issues(self, label: str, state: str) -> list[dict[str, object]]:
        return [
            item
            for item in self.collection(
                f"issues?state={state}&labels={label}&sort=created&direction=asc&per_page=100"
            )
            if "pull_request" not in item
        ]

    def nominated(self, issue: int) -> bool:
        events = self.collection(f"issues/{issue}/events?per_page=100")
        relevant = [
            event
            for event in events
            if event.get("event") in ("labeled", "unlabeled")
            and object_value(event.get("label", {})).get("name") == "artificer:ready"
        ]
        if not relevant or relevant[-1].get("event") != "labeled":
            return False
        return self.human_writer(object_value(relevant[-1]["actor"]))

    def human_writer(self, author: dict[str, object]) -> bool:
        return author.get("type") == "User" and self.writable(
            text_value(author["login"])
        )

    def unblocked(self, issue: int) -> bool:
        blockers = self.collection(
            f"issues/{issue}/dependencies/blocked_by?per_page=100"
        )
        return all(item.get("state") == "closed" for item in blockers)

    def reserve(self, issue: int, correlation: str) -> None:
        self.comment(issue, correlation)
        self.request(
            self.route(f"issues/{issue}/labels"),
            "POST",
            {"labels": ["artificer:claimed"]},
        )
        self.request(self.route(f"issues/{issue}/labels/artificer%3Aready"), "DELETE")

    def comment(self, issue: int, body: str) -> int:
        result = object_value(
            self.request(self.route(f"issues/{issue}/comments"), "POST", {"body": body})
        )
        return number_value(result["id"])

    def comments(self, issue: int) -> list[dict[str, object]]:
        return self.collection(f"issues/{issue}/comments?per_page=100")

    def pr(self, number: int) -> dict[str, object]:
        return object_value(self.request(self.route(f"pulls/{number}")))

    def release(self, issue: int) -> None:
        labels = self.collection(f"issues/{issue}/labels?per_page=100")
        if any(label.get("name") == "artificer:claimed" for label in labels):
            self.request(
                self.route(f"issues/{issue}/labels/artificer%3Aclaimed"), "DELETE"
            )
