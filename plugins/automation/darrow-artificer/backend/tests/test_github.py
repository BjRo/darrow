import json
import subprocess

import pytest

from darrow_artificer.github import (
    GitHub,
    array_value,
    number_value,
    object_value,
    text_value,
)


def test_api_protocol_and_effects(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[list[str], object]] = []

    def run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs.get("input")))
        route = command[2]
        responses: dict[str, object] = {
            "user": {"login": "writer"},
            "repos/o/r/collaborators/writer/permission": {"permission": "write"},
            "repos/o/r/collaborators/reader/permission": {"permission": "read"},
            "repos/o/r/issues/1/comments": {"id": 44},
            "repos/o/r/pulls/2": {"number": 2},
        }
        result = responses.get(route)
        if "--paginate" in command:
            result = [[{"number": 1}], [{"number": 2, "pull_request": {}}]]
        if "/labels?" in route:
            result = [[{"name": "artificer:claimed"}]]
        return subprocess.CompletedProcess(command, 0, json.dumps(result), "")

    monkeypatch.setattr(subprocess, "run", run)
    forge = GitHub("gh", "o/r")
    assert forge.login() == "writer"
    assert forge.writable("writer") and not forge.writable("reader")
    assert forge.issues("artificer:ready", "open") == [{"number": 1}]
    forge.reserve(1, "literal $(no execution)\nbody")
    assert json.loads(str(calls[-3][1]))["body"] == "literal $(no execution)\nbody"
    assert calls[-2][0][-2:] == ["--input", "-"]
    assert calls[-1][0][-1] == "DELETE"
    assert forge.pr(2) == {"number": 2}
    forge.release(1)
    assert calls[-1][0][2].endswith("/labels/artificer%3Aclaimed")
    assert forge.comments(1) == [{"number": 1}, {"number": 2, "pull_request": {}}]


@pytest.mark.parametrize("blocked", [True, False])
def test_dependencies_and_nominations(
    monkeypatch: pytest.MonkeyPatch, blocked: bool
) -> None:
    def collection(self: GitHub, suffix: str) -> list[dict[str, object]]:
        if "blocked_by" in suffix:
            return [{"state": "open" if blocked else "closed"}]
        return [
            {
                "event": "labeled",
                "label": {"name": "artificer:ready"},
                "actor": {"login": "writer", "type": "User"},
            }
        ]

    monkeypatch.setattr(GitHub, "collection", collection)
    monkeypatch.setattr(GitHub, "writable", lambda self, user: user == "writer")
    forge = GitHub("gh", "o/r")
    assert forge.unblocked(1) is not blocked
    assert forge.nominated(1)
    monkeypatch.setattr(GitHub, "collection", lambda self, suffix: [])
    assert not forge.nominated(1)
    assert forge.unblocked(1)


def test_bad_protocol_values_fail_closed() -> None:
    for reader in (array_value, number_value, object_value, text_value):
        with pytest.raises(ValueError):
            reader(None)
    with pytest.raises(ValueError):
        number_value(True)


def test_empty_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess([], 0, "", ""),
    )
    assert GitHub("gh", "o/r").request("route", "DELETE") is None
