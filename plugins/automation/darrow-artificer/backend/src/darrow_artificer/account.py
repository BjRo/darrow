"""Read native account limits without starting a model or purchasing credits."""

import json
import select
import subprocess
import time
from pathlib import Path
from typing import IO

from .github import object_value
from .models import Grant
from .native import environment, options


def receive(stream: IO[bytes], identifier: int) -> dict[str, object]:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        ready, _, _ = select.select(
            [stream], [], [], max(0, deadline - time.monotonic())
        )
        if not ready:
            break
        line = stream.readline()
        if not line:
            raise ValueError("Codex account reader ended without an observation")
        result = object_value(json.loads(line))
        if result.get("id") == identifier:
            return object_value(result.get("result"))
    raise TimeoutError("Codex account limits are unavailable")


def send(stream: IO[bytes], value: dict[str, object]) -> None:
    stream.write((json.dumps(value) + "\n").encode())
    stream.flush()


def snapshot(grant: Grant, home: Path) -> dict[str, object]:
    with subprocess.Popen(
        [grant.codex, "app-server", "--stdio", *options(grant)],
        env=environment(home),
        cwd=home,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=0,
    ) as process:
        assert process.stdin is not None and process.stdout is not None
        try:
            send(
                process.stdin,
                {
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "clientInfo": {"name": "darrow_artificer", "version": "0.1.0"}
                    },
                },
            )
            receive(process.stdout, 1)
            send(process.stdin, {"method": "initialized", "params": {}})
            send(
                process.stdin,
                {"id": 2, "method": "account/rateLimits/read", "params": None},
            )
            return receive(process.stdout, 2)
        finally:
            process.terminate()
            process.wait(timeout=10)


def require_included_usage(result: dict[str, object]) -> None:
    limits = object_value(result.get("rateLimits"))
    if limits.get("planType") != "pro":
        raise ValueError("This installation requires an observed ChatGPT Pro account")
    credits = object_value(limits.get("credits"))
    if credits.get("hasCredits") is not False or credits.get("unlimited") is not False:
        raise ValueError(
            "Paid-credit availability is present or unknown; refusing model launch"
        )
    if result.get("ordinaryUsageAllowed") is not True:
        raise ValueError("Included subscription usage is unavailable or unknown")
    check_windows(limits)


def check_windows(limits: dict[str, object]) -> None:
    windows = [
        limits[name]
        for name in ("primary", "secondary")
        if limits.get(name) is not None
    ]
    if not windows:
        raise ValueError("Included subscription allowance is unknown")
    for value in windows:
        used = object_value(value).get("usedPercent")
        if type(used) not in (int, float) or not 0 <= float(str(used)) < 100:
            raise ValueError("Included subscription allowance is exhausted or unknown")


def check(grant: Grant, home: Path) -> None:
    require_included_usage(snapshot(grant, home))
