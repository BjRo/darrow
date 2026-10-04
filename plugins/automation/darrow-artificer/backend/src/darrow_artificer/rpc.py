"""Bounded stdio JSON-RPC transport; no delivery decisions or retry turns."""

import json
import os
import select
import subprocess
import time
from collections import deque
from typing import BinaryIO

from .github import object_value

REQUEST_TIMEOUT_SECONDS = 30.0


class Rpc:
    def __init__(self, process: subprocess.Popen[bytes], evidence: BinaryIO) -> None:
        assert process.stdin is not None and process.stdout is not None
        self.input = process.stdin
        self.output = process.stdout
        self.evidence = evidence
        self.pending: deque[dict[str, object]] = deque()
        self.buffer = b""
        self.sequence = 0

    def record(self, message: dict[str, object]) -> None:
        self.evidence.write((json.dumps(message) + "\n").encode())
        self.evidence.flush()

    def send(self, message: dict[str, object]) -> None:
        self.record({"direction": "send", **message})
        self.input.write((json.dumps(message) + "\n").encode())
        self.input.flush()

    def receive(self, deadline: float | None = None) -> dict[str, object]:
        while b"\n" not in self.buffer:
            timeout = None if deadline is None else max(0, deadline - time.monotonic())
            ready, _, _ = select.select([self.output], [], [], timeout)
            if not ready:
                raise TimeoutError("Codex app-server observation timed out")
            chunk = os.read(self.output.fileno(), 65536)
            if not chunk:
                raise RuntimeError("Codex app-server exited before a settled result")
            self.buffer += chunk
        line, self.buffer = self.buffer.split(b"\n", 1)
        message = object_value(json.loads(line))
        self.record(message)
        return message

    def call(self, method: str, params: dict[str, object]) -> dict[str, object]:
        self.sequence += 1
        identifier = self.sequence
        self.send({"id": identifier, "method": method, "params": params})
        deadline = time.monotonic() + REQUEST_TIMEOUT_SECONDS
        while True:
            message = self.receive(deadline)
            if message.get("id") == identifier and "method" not in message:
                return response(message)
            self.pending.append(message)

    def next(self) -> dict[str, object]:
        return self.pending.popleft() if self.pending else self.receive()

    def drain(self) -> None:
        while b"\n" in self.buffer or select.select([self.output], [], [], 0)[0]:
            self.pending.append(
                self.receive(time.monotonic() + REQUEST_TIMEOUT_SECONDS)
            )


def response(message: dict[str, object]) -> dict[str, object]:
    if "error" in message:
        raise RuntimeError(f"Codex app-server request failed: {message['error']}")
    return object_value(message.get("result"))
