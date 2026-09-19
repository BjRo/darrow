"""Stateful GitHub fixture for ticket evals, independent of the ticket facade."""

import json
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any


def flag(arguments: list[str], name: str, default: str = "") -> str:
    try:
        return arguments[arguments.index(name) + 1]
    except ValueError:
        return default


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def append(path: Path, text: str) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(text + "\n")


def issue_list(directory: Path) -> list[dict[str, Any]]:
    records = []
    for line in read(directory / "list").splitlines():
        match = re.fullmatch(r"#([0-9]+) (open|closed)  (.*?)(?: \((.*)\))?", line)
        assert match, line
        labels = match[4].split(", ") if match[4] else []
        records.append(
            {
                "number": int(match[1]),
                "state": match[2].upper(),
                "title": match[3],
                "labels": [{"name": n} for n in labels],
            }
        )
    return records


def issue_view(directory: Path, arguments: list[str]) -> dict[str, Any]:
    number = arguments[2]
    if not (directory / f"issue-{number}-state").exists():
        raise ValueError(
            f"GraphQL: Could not resolve to an Issue with the number of {number}."
        )
    fields = {
        name: read(directory / f"issue-{number}-{name}")
        for name in ("state", "title", "body", "labels")
    }
    record: dict[str, Any] = {
        "number": int(number),
        "state": fields["state"].upper(),
        "title": fields["title"],
        "body": fields["body"],
        "url": f"https://github.test/o/r/issues/{number}",
        "labels": [{"name": n} for n in fields["labels"].splitlines()],
    }
    return {field: record[field] for field in flag(arguments, "--json").split(",")}


def copy_body(directory: Path, arguments: list[str], *names: str) -> None:
    source = flag(arguments, "--body-file")
    if source:
        for name in names:
            shutil.copyfile(source, directory / name)


def create_issue(directory: Path, arguments: list[str]) -> str:
    copy_body(directory, arguments, "created-body")
    title = flag(arguments, "--title")
    if "--title" in arguments:
        (directory / "created-title").write_text(title, encoding="utf-8")
    labels = [arguments[i + 1] for i, arg in enumerate(arguments) if arg == "--label"]
    (directory / "created-labels").write_text(
        "".join(label + "\n" for label in labels), encoding="utf-8"
    )
    (directory / "issue-99-state").write_text("open", encoding="utf-8")
    for name in ("title", "body"):
        source = directory / f"created-{name}"
        if source.exists():
            shutil.copyfile(source, directory / f"issue-99-{name}")
    return "https://github.test/o/r/issues/99"


def mutate_issue(directory: Path, arguments: list[str]) -> str | None:
    action, number = arguments[1:3]
    if action == "comment":
        copy_body(directory, arguments, f"comment-body-{number}")
        return f"https://github.test/o/r/issues/{number}#issuecomment-1"
    if action == "edit":
        copy_body(directory, arguments, f"edited-body-{number}", f"issue-{number}-body")
    else:
        append(directory / "transitions", f"{action} {number}")
    return None


def api_arguments(arguments: list[str]) -> tuple[str, str, dict[str, str]]:
    method, endpoint, fields = "GET", "", {}
    iterator = iter(arguments[1:])
    for argument in iterator:
        if argument == "-X":
            method = next(iterator)
        elif argument == "-F":
            key, value = next(iterator).split("=", 1)
            fields[key] = value
        elif argument not in ("--paginate", "--slurp"):
            endpoint = argument
    return method, endpoint, fields


def api_get(directory: Path, number: str, suffix: str) -> Any:
    prefix = directory / f"issue-{number}"
    if not suffix:
        if not prefix.with_name(prefix.name + "-state").exists():
            raise ValueError("gh: Not Found (HTTP 404)")
        return {"id": 10000 + int(number)}
    if suffix == "/parent":
        parent = read(prefix.with_name(prefix.name + "-parent")).strip()
        if not parent:
            raise ValueError("gh: No parent issue found (HTTP 404)")
        return {
            "number": int(parent),
            "html_url": f"https://github.test/o/r/issues/{parent}",
        }
    return [
        [
            {"number": int(n)}
            for n in read(directory / f"issue-{number}-blockedby").splitlines()
        ]
    ]


def api_mutate(
    directory: Path, number: str, method: str, suffix: str, fields: dict[str, str]
) -> None:
    blocked = directory / f"issue-{number}-blockedby"
    if method == "POST" and suffix == "/dependencies/blocked_by":
        append(blocked, str(int(fields["issue_id"]) - 10000))
    elif method == "DELETE" and suffix.startswith("/dependencies/blocked_by/"):
        removed = str(int(suffix.rsplit("/", 1)[1]) - 10000)
        blocked.write_text(
            "".join(n + "\n" for n in read(blocked).splitlines() if n != removed),
            encoding="utf-8",
        )
    else:
        parent = directory / f"issue-{int(fields['sub_issue_id']) - 10000}-parent"
        if method == "POST":
            parent.write_text(number + "\n", encoding="utf-8")
        else:
            parent.unlink(missing_ok=True)


def api(directory: Path, arguments: list[str]) -> Any:
    method, endpoint, fields = api_arguments(arguments)
    match = re.fullmatch(r".*/issues/([0-9]+)(.*)", endpoint)
    if not match:
        raise ValueError(f"mock gh: unsupported api call: {method} {endpoint}")
    number, suffix = match.groups()
    if method == "GET" and suffix in ("", "/parent", "/dependencies/blocked_by"):
        return api_get(directory, number, suffix)
    supported = (
        method == "POST" and suffix in ("/dependencies/blocked_by", "/sub_issues")
    ) or (
        method == "DELETE"
        and (suffix == "/sub_issue" or suffix.startswith("/dependencies/blocked_by/"))
    )
    if not supported:
        raise ValueError(f"mock gh: unsupported api call: {method} {endpoint}")
    api_mutate(directory, number, method, suffix, fields)
    return None


def dispatch(directory: Path, arguments: list[str]) -> Any:
    pair = tuple(arguments[:2])
    queries: dict[tuple[str, ...], Callable[[], Any]] = {
        ("repo", "view"): lambda: {"hasIssuesEnabled": True},
        ("label", "list"): lambda: [
            {"name": n} for n in read(directory / "labels").splitlines()
        ],
        ("issue", "list"): lambda: issue_list(directory),
        ("issue", "view"): lambda: issue_view(directory, arguments),
        ("issue", "create"): lambda: create_issue(directory, arguments),
    }
    if arguments[0] == "api":
        return api(directory, arguments)
    if pair in queries:
        return queries[pair]()
    if pair in {("issue", action) for action in ("comment", "edit", "close", "reopen")}:
        return mutate_issue(directory, arguments)
    raise ValueError("mock gh: unsupported: " + " ".join(arguments))


def main() -> None:
    git_dir = subprocess.check_output(
        ["git", "rev-parse", "--absolute-git-dir"], text=True
    ).strip()
    directory = Path(git_dir) / "fixture-gh"
    directory.mkdir(exist_ok=True)
    arguments = sys.argv[1:]
    append(directory / "calls", " ".join(arguments))
    try:
        result = dispatch(directory, arguments)
        if result is not None:
            print(result if isinstance(result, str) else json.dumps(result))
    except (ValueError, IndexError, StopIteration) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
