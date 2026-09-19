"""Independent fake GitHub CLI for publication regression tests."""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def git(repo: Path, *arguments: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo), *arguments], text=True
    ).strip()


def append(path: Path, value: str) -> None:
    with path.open("a", encoding="utf-8") as stream:
        stream.write(value + "\n")


def comment_help() -> str:
    if os.environ.get("NO_ATTACH") == "1":
        return "flags: --body-file"
    if os.environ.get("DISTRACTING_LIMIT") == "1":
        return (
            "global maximum 80\nflags: --body-file --attach file\n"
            "  Uploads attachments (Maximum: 10)\n\nflags: --body-file"
        )
    maximum = 10 if os.environ.get("STRICT_ATTACH") == "1" else 50
    return f"flags: --body-file --attach file (maximum {maximum})"


def attachments(arguments: list[str], directory: Path) -> tuple[Path, list[str]]:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--body-file", required=True, type=Path)
    parser.add_argument("--attach", action="append", default=[])
    parsed, _ = parser.parse_known_args(arguments[2:])
    files = []
    for attached in parsed.attach:
        append(directory / "attach-order", attached)
        files.append(attached.split("#", 1)[0])
    (directory / "attach-files").write_text(
        "".join(path + "\n" for path in files), encoding="utf-8"
    )
    return parsed.body_file, files


def render(body: Path, files: list[str], mode: str) -> str:
    text = body.read_bytes().decode("utf-8")
    for index, attached in enumerate(files, 1):
        number = 1 if mode == "duplicate-url" else index
        text = text.replace(
            Path(attached).name,
            f"https://github.com/user-attachments/assets/mock-{number}",
        )
    if mode == "extra":
        text += "\nextra remote text\n"
    return text


def comment_record(body: str) -> str:
    escaped = (
        body.removesuffix("\n")
        .replace("\\", "\\\\")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("\n", "\\n")
    )
    return (
        "9\thttps://github.com/fixture/repo/pull/42#issuecomment-9\t" + escaped + "\n"
    )


def publish(repo: Path, directory: Path, arguments: list[str]) -> None:
    append(directory / "comment-calls", " ".join(arguments))
    body, files = attachments(arguments, directory)
    mode = os.environ.get("COMMENT_MODE", "")
    if mode == "fail":
        raise SystemExit(1)
    if mode == "partial":
        record = comment_record(
            f"<!-- darrow-pr-evidence:v1 candidate=fixture/repo#42@{git(repo, 'rev-parse', 'HEAD')} -->"
        )
        (directory / "comments").write_text(record, encoding="utf-8")
        raise SystemExit(1)
    text = render(body, files, mode)
    (directory / "rendered-body").write_bytes(text.encode("utf-8"))
    (directory / "comments").write_text(comment_record(text), encoding="utf-8")
    if mode == "head-change":
        append(repo / "tracked", "changed")
        git(repo, "add", "tracked")
        git(repo, "commit", "-qm", "test: concurrent head change")


def query(repo: Path, arguments: list[str]) -> str:
    if arguments[:2] == ["repo", "view"]:
        host = (
            "github.example"
            if os.environ.get("HOST_MODE") == "enterprise"
            else "github.com"
        )
        return f"fixture/repo\thttps://{host}/fixture/repo"
    ref = "main" if os.environ.get("FORGE_HEAD_MODE") == "wrong" else "HEAD"
    return f"42\thttps://github.com/fixture/repo/pull/42\t{git(repo, 'rev-parse', ref)}\tfalse"


def main() -> None:
    repo = Path(
        os.environ.get("DARROW_EVIDENCE_REPOSITORY")
        or git(Path.cwd(), "rev-parse", "--show-toplevel")
    )
    directory = Path(git(repo, "rev-parse", "--absolute-git-dir"))
    arguments = sys.argv[1:]
    pair = arguments[:2]
    if pair in (["repo", "view"], ["pr", "list"]):
        print(query(repo, arguments))
    elif pair == ["pr", "comment"]:
        comment(repo, directory, arguments)
    elif arguments[0] == "api":
        api(directory, arguments)
    else:
        print("unsupported gh call: " + " ".join(arguments), file=sys.stderr)
        raise SystemExit(80)


def comment(repo: Path, directory: Path, arguments: list[str]) -> None:
    if arguments[2:] == ["--help"]:
        print(comment_help())
    else:
        publish(repo, directory, arguments)


def api(directory: Path, arguments: list[str]) -> None:
    if arguments[:2] == ["api", "meta"]:
        return
    append(directory / "api-calls", " ".join(arguments))
    comments = directory / "comments"
    if comments.exists():
        sys.stdout.write(comments.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
