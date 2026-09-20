"""Filesystem-backed GitHub protocol fixture for real concurrent CLI processes."""

import json
import sys
from pathlib import Path
from typing import cast
from urllib.parse import unquote, urlsplit


def numbers(state: dict[str, object], key: str) -> list[int]:
    return cast(list[int], state[key])


def write_operation(
    state: dict[str, object], route: str, body: dict[str, object]
) -> object:
    issue = int(route.split("/")[4])
    if route.endswith("comments"):
        comments = cast(list[dict[str, object]], state["comments"])
        comments.append(
            {
                "id": len(comments) + 1,
                "issue": issue,
                "body": body["body"],
                "user": {"login": "writer", "type": "User"},
            }
        )
        return comments[-1]
    if route.endswith("/labels"):
        numbers(state, "claimed").append(issue)
    elif route.endswith("artificer:ready"):
        numbers(state, "ready").remove(issue)
    elif route.endswith("artificer:claimed"):
        numbers(state, "claimed").remove(issue)
    return None


def issue_collection(state: dict[str, object], route: str) -> object:
    parsed = urlsplit(route)
    if parsed.path.endswith("/issues"):
        key = "ready" if "artificer:ready" in parsed.query else "claimed"
        return [{"number": number} for number in numbers(state, key)]
    if "/events" in route:
        return [
            {
                "event": "labeled",
                "label": {"name": "artificer:ready"},
                "actor": {"login": "writer", "type": "User"},
            }
        ]
    if "comments" in route:
        return state["comments"]
    if "blocked_by" in route:
        return []
    raise ValueError(f"Unsupported fixture collection: {route}")


def response(state: dict[str, object], route: str, method: str) -> object:
    if method != "GET":
        body = json.load(sys.stdin) if "--input" in sys.argv else {}
        return write_operation(state, unquote(route), body)
    if "/permission" in route:
        return {"permission": "write"}
    return [issue_collection(state, route)]


def main() -> None:
    path = Path(sys.argv[0]).parent / "forge.json"
    state = cast(dict[str, object], json.loads(path.read_text()))
    route = sys.argv[2]
    method = sys.argv[sys.argv.index("--method") + 1]
    result = response(state, route, method)
    path.write_text(json.dumps(state))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
