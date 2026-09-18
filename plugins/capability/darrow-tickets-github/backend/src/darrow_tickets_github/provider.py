"""Argument-vector Git/gh boundary and validated provider records."""

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from typing import cast

from .errors import TicketError, bounded, failure
from .validation import norm_id


def execute(
    args: list[str], env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(args, env=env, capture_output=True, check=False)
        return subprocess.CompletedProcess(
            args,
            result.returncode,
            result.stdout.decode("utf-8"),
            result.stderr.decode("utf-8"),
        )
    except (OSError, UnicodeError) as exc:
        raise TicketError(f"error: cannot execute {args[0]}: {exc}", 3) from exc


def origin_repository(remote: str) -> str:
    if "://" in remote:
        authority, separator, path = remote.split("://", 1)[1].partition("/")
    else:
        authority, separator, path = remote.partition(":")
        if "@" not in authority:
            separator = ""
    host = authority.rsplit("@", 1)[-1]
    path = path.removesuffix("/").removesuffix(".git")
    if not separator or not re.fullmatch(r"[^\s/]+/[^\s/]+/[^\s/]+", f"{host}/{path}"):
        raise TicketError(
            f"error: unsupported 'origin' URL for the GitHub backend: {remote}", 3
        )
    return f"{host}/{path}"


def object_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise TicketError("error: malformed GitHub backend JSON response", 4)
    return cast(dict[str, object], value)


def array_value(value: object) -> list[object]:
    if not isinstance(value, list):
        raise TicketError("error: malformed GitHub backend JSON response", 4)
    return cast(list[object], value)


def string_field(record: dict[str, object], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str):
        raise TicketError(f"error: malformed GitHub backend field: {key}", 4)
    return value


def number_field(record: dict[str, object], key: str) -> str:
    value = record.get(key)
    if type(value) is not int or value < 0:
        raise TicketError(f"error: malformed GitHub backend field: {key}", 4)
    return str(value)


def labels_from(value: object) -> list[str]:
    return [string_field(object_value(label), "name") for label in array_value(value)]


@dataclass(frozen=True)
class Provider:
    repository: str

    @classmethod
    def resolve(cls) -> "Provider":
        if (
            execute(["git", "rev-parse", "--is-inside-work-tree"]).stdout.strip()
            != "true"
        ):
            raise TicketError("error: not inside a git work tree", 3)
        if shutil.which("gh") is None:
            raise TicketError(
                "error: gh CLI not found — the GitHub Issues backend is unusable", 3
            )
        remote = execute(["git", "remote", "get-url", "origin"])
        if remote.returncode:
            raise TicketError(
                "error: no 'origin' remote — cannot resolve a ticket backend", 3
            )
        return cls(origin_repository(remote.stdout.rstrip("\r\n")))

    def call(self, *args: str) -> subprocess.CompletedProcess[str]:
        env = dict(
            os.environ,
            GH_HOST=self.repository.split("/", 1)[0],
            GH_REPO=self.repository,
        )
        return execute(["gh", *args], env)

    def run(self, *args: str, prefix: str = "") -> str:
        result = self.call(*args)
        if result.returncode:
            raise failure(result, prefix)
        return result.stdout.rstrip("\n")

    def json(self, *args: str, prefix: str = "") -> object:
        text = self.run(*args, prefix=prefix)
        try:
            return cast(object, json.loads(text))
        except ValueError as exc:
            raise TicketError(
                "error: malformed GitHub backend JSON response", 4
            ) from exc

    def repository_url(self) -> str:
        return string_field(
            object_value(self.json("repo", "view", "--json", "url")), "url"
        )

    def read_id(self, reference: str) -> str:
        if "://" not in reference:
            return norm_id(reference)
        prefix = self.repository_url().removesuffix("/") + "/issues/"
        if not reference.startswith(prefix):
            raise TicketError(
                f"error: ticket URL does not belong to the current project: {reference}"
            )
        suffix = reference.removeprefix(prefix)
        if not re.fullmatch(r"[0-9]+", suffix):
            raise TicketError(
                f"error: ticket URL is not canonical for the current project: {reference}"
            )
        return norm_id(suffix)

    def issue(
        self, number: str, fields: str, *, verify: bool = False
    ) -> dict[str, object]:
        prefix = f"error: ticket #{number} not found:\n" if verify else ""
        return object_value(
            self.json("issue", "view", number, "--json", fields, prefix=prefix)
        )

    def verify(self, number: str) -> tuple[str, str]:
        issue = self.issue(number, "state,title", verify=True)
        state = string_field(issue, "state").lower()
        if state not in {"open", "closed"}:
            raise TicketError("error: malformed GitHub backend field: state", 4)
        return state, string_field(issue, "title")

    def labels(self) -> list[str]:
        return labels_from(
            self.json("label", "list", "--json", "name", "--limit", "1000")
        )

    def inspect(self) -> None:
        result = self.call("repo", "view", "--json", "hasIssuesEnabled")
        if result.returncode:
            diagnostic = bounded(result.stderr + result.stdout, "output")
            raise TicketError(
                "error: cannot resolve a GitHub repository for 'origin':\n"
                + diagnostic,
                3,
            )
        try:
            enabled = object_value(json.loads(result.stdout)).get("hasIssuesEnabled")
        except ValueError as exc:
            raise TicketError(
                "error: malformed GitHub backend JSON response", 4
            ) from exc
        if enabled is not True:
            raise TicketError(
                "error: issues are disabled for this repository — enable them or use a different backend",
                3,
            )

    def database_id(self, number: str) -> str:
        record = object_value(
            self.json("api", f"repos/{{owner}}/{{repo}}/issues/{number}")
        )
        return number_field(record, "id")
