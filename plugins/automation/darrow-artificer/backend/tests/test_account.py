import copy
import io
import json
import select
import subprocess
import time

import pytest

from darrow_artificer import account
from darrow_artificer.github import object_value
from darrow_artificer.installation import Installation


def snapshot() -> dict[str, object]:
    return {
        "ordinaryUsageAllowed": True,
        "rateLimits": {
            "planType": "pro",
            "credits": {"hasCredits": False, "unlimited": False, "balance": "0"},
            "primary": {"usedPercent": 42},
            "secondary": None,
        },
    }


def test_observed_subscription_allowance() -> None:
    account.require_included_usage(snapshot())


@pytest.mark.parametrize(
    "case",
    [
        "api",
        "paid",
        "unknown-credit",
        "disallowed",
        "exhausted",
        "unknown-window",
        "no-window",
        "bool-window",
    ],
)
def test_reject_paid_or_unknown(case: str) -> None:
    result = copy.deepcopy(snapshot())
    limits = object_value(result["rateLimits"])
    changes: dict[str, dict[str, object]] = {
        "api": {"planType": "api"},
        "paid": {"credits": {"hasCredits": True}},
        "unknown-credit": {"credits": {}},
        "exhausted": {"primary": {"usedPercent": 100}},
        "unknown-window": {"primary": {}},
        "no-window": {"primary": None},
        "bool-window": {"primary": {"usedPercent": False}},
        "disallowed": {},
    }
    limits.update(changes[case])
    if case == "disallowed":
        result["ordinaryUsageAllowed"] = False
    with pytest.raises(ValueError):
        account.require_included_usage(result)


def test_receive_notifications_then_result(monkeypatch: pytest.MonkeyPatch) -> None:
    stream = io.BytesIO(b'{"method":"notice"}\n{"id":2,"result":{"ok":true}}\n')
    monkeypatch.setattr(select, "select", lambda *args: ([stream], [], []))
    assert account.receive(stream, 2) == {"ok": True}
    with pytest.raises(ValueError, match="ended"):
        account.receive(stream, 2)
    monkeypatch.setattr(select, "select", lambda *args: ([], [], []))
    with pytest.raises(TimeoutError):
        account.receive(stream, 2)
    clock = iter([0.0, 99.0])
    monkeypatch.setattr(time, "monotonic", lambda: next(clock))
    with pytest.raises(TimeoutError):
        account.receive(stream, 2)


class Process:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.stdin = io.BytesIO()
        self.stdout = io.BytesIO(
            b'{"id":1,"result":{}}\n'
            + json.dumps({"id": 2, "result": snapshot()}).encode()
            + b"\n"
        )
        self.stopped = False

    def __enter__(self) -> "Process":
        return self

    def __exit__(self, *args: object) -> None:
        assert self.stopped
        requests = [json.loads(row) for row in self.stdin.getvalue().splitlines()]
        assert [row["method"] for row in requests] == [
            "initialize",
            "initialized",
            "account/rateLimits/read",
        ]

    def terminate(self) -> None:
        self.stopped = True

    def wait(self, timeout: int) -> int:
        return 0


def test_account_protocol_never_starts_model(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:

    monkeypatch.setattr(subprocess, "Popen", Process)
    monkeypatch.setattr(select, "select", lambda readers, *args: (readers, [], []))
    account.check(installation.grant, installation.root)
