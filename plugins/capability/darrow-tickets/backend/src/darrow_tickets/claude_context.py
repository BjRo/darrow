"""Supply static native discovery context without inspecting a repository."""

import json
from importlib.resources import files


def main() -> None:
    context = (
        files("darrow_tickets")
        .joinpath("claude_routing.md")
        .read_text(encoding="utf-8")
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": context,
                }
            }
        )
    )
