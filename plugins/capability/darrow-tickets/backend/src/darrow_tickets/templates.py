"""Install and inspect repository-owned GitHub issue templates."""

import argparse
import os
import re
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

from .errors import TicketError

KINDS = ("dependency-upgrade", "retirement", "bug-fix-regression")
ASSETS = Path(__file__).parent / "template_assets"
EXTENSIONS = {".md", ".yml", ".yaml"}


def repository_root(value: str) -> Path:
    path = Path(value).expanduser().resolve()
    if not path.is_dir():
        raise TicketError(f"error: repository is not a directory: {path}")
    environment = {
        key: item
        for key, item in os.environ.items()
        if not key.upper().startswith("GIT_")
    }
    result = subprocess.run(
        ["git", "-C", str(path), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
        env=environment,
    )
    if result.returncode or Path(result.stdout.strip()).resolve() != path:
        raise TicketError(f"error: target is not a repository root: {path}")
    return path


def template_directory(root: Path, *, create: bool) -> Path:
    github = root / ".github"
    target = github / "ISSUE_TEMPLATE"
    for directory in (github, target):
        if directory.is_symlink():
            raise TicketError(f"error: template directory is a symlink: {directory}")
        if directory.exists() and not directory.is_dir():
            raise TicketError(
                f"error: template directory is not a directory: {directory}"
            )
    if create:
        target.mkdir(parents=True, exist_ok=True)
    return target


def valid_filename(filename: str) -> bool:
    return (
        filename.casefold() not in {".", "..", "config.yml", "config.yaml"}
        and Path(filename).name == filename
        and "/" not in filename
        and "\\" not in filename
        and Path(filename).suffix.lower() in EXTENSIONS
    )


def template_path(root: Path, filename: str) -> Path:
    if not valid_filename(filename):
        raise TicketError(f"error: invalid template filename: {filename}")
    return template_directory(root, create=False) / filename


def bundled_templates() -> dict[str, bytes]:
    return {kind: (ASSETS / f"{kind}.md").read_bytes() for kind in KINDS}


def install_status(path: Path, expected: bytes) -> str:
    if path.is_symlink() or path.is_dir():
        return "preserved"
    if path.exists():
        return "unchanged" if path.read_bytes() == expected else "preserved"
    return "created"


def install_targets(directory: Path, bundle: dict[str, bytes]) -> dict[str, Path]:
    names = {f"{kind}.md" for kind in bundle}
    if directory.exists():
        for path in directory.iterdir():
            key = path.name.casefold()
            if key in names and path.name != key:
                raise TicketError(
                    f"error: case-variant template blocks installation: {path}"
                )
    return {kind: directory / f"{kind}.md" for kind in bundle}


def install(root: Path) -> None:
    target_dir = template_directory(root, create=False)
    bundle = bundled_templates()
    paths = install_targets(target_dir, bundle)
    statuses: dict[str, str] = {}
    for kind, expected in bundle.items():
        path = paths[kind]
        statuses[kind] = install_status(path, expected)
    template_directory(root, create=True)
    for kind, status in statuses.items():
        path = paths[kind]
        if status == "created":
            with path.open("xb") as stream:
                stream.write(bundle[kind])
        print(f"{status}: {path}")


def metadata(content: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for key, value in re.findall(
        r"^(name|about|description):[ \t]*(.+)$", content, re.M
    ):
        if key not in fields:
            fields[key] = value.strip().strip("\"'")
    return fields


def print_template_entry(path: Path) -> None:
    if path.is_symlink() or not path.is_file():
        raise TicketError(f"error: installed template is not a regular file: {path}")
    fields = metadata(path.read_text(encoding="utf-8"))
    print(f"file: {path.name}\npath: {path}")
    for key in ("name", "about", "description"):
        if key in fields:
            print(f"{key}: {fields[key]}")


def list_templates(root: Path) -> None:
    directory = template_directory(root, create=False)
    if not directory.exists():
        print(f"status: missing\npath: {directory}")
        return
    paths = sorted(
        (path for path in directory.iterdir() if valid_filename(path.name)),
        key=lambda path: path.name.casefold(),
    )
    print(f"status: {'available' if paths else 'empty'}\npath: {directory}")
    for path in paths:
        print_template_entry(path)


def show(root: Path, filename: str) -> None:
    path = template_path(root, filename)
    if path.is_symlink() or path.is_dir():
        raise TicketError(f"error: installed template is not a regular file: {path}")
    if not path.exists():
        print(f"status: missing\npath: {path}")
        return
    content = path.read_text(encoding="utf-8")
    print(f"status: installed\npath: {path}\ncontent:\n{content}", end="")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="darrow-ticket-templates")
    commands = result.add_subparsers(dest="command", required=True)
    install_parser = commands.add_parser("install")
    install_parser.add_argument("--repo", required=True)
    list_parser = commands.add_parser("list")
    list_parser.add_argument("--repo", required=True)
    show_parser = commands.add_parser("show")
    show_parser.add_argument("--repo", required=True)
    show_parser.add_argument("--file", required=True)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    try:
        args = parser().parse_args(argv)
        root = repository_root(args.repo)
        if args.command == "install":
            install(root)
        elif args.command == "list":
            list_templates(root)
        else:
            show(root, args.file)
    except (OSError, UnicodeError, TicketError) as exc:
        message = str(exc)
        print(
            message if message.startswith("error:") else f"error: {message}",
            file=sys.stderr,
        )
        return 2
    return 0


def entrypoint() -> None:
    raise SystemExit(main())
