"""Public command dispatch; contextual decision authority stays in the skills."""

import io
import sys
from pathlib import Path

from . import catalog, queries
from .arguments import USAGE, Arguments, check_transition, parse_arguments
from .errors import DecisionError
from .inventory import inventory
from .paths import canonical, resolve_root, select_directory


def require_directory(directory: Path | None) -> Path:
    if directory is None:
        raise DecisionError(
            "no ADR directory detected; create or select one with --dir"
        )
    return directory


def validate(root: Path, directory: Path | None) -> None:
    records = inventory(directory)
    if directory is None:
        print("valid: 0 ADR(s); no ADR directory detected")
        return
    path = directory / "README.md"
    if records or path.exists() or path.is_symlink():
        catalog.verify(root, directory, records)
    print(f"valid: {len(records)} ADR(s) in {directory}")


def run_catalog(root: Path, directory: Path, action: str) -> None:
    if action == "rebuild":
        records = catalog.rebuild(root, directory)
        prefix = "catalog"
    else:
        catalog.load(directory / "README.md")
        records = inventory(directory)
        catalog.verify(root, directory, records)
        prefix = "fresh"
    print(f"{prefix}: {directory / 'README.md'}\nrecords: {len(records)}")


def run(arguments: Arguments) -> None:
    if arguments.command == "check-transition":
        check_transition(arguments)
        return
    root = resolve_root(arguments.get("repo", "."))
    if arguments.command == "canonical-path":
        value = arguments.get("path")
        if not value:
            raise DecisionError(USAGE)
        print(f"path: {canonical(root, value)}")
        return
    directory = select_directory(root, arguments.get("dir"))
    dispatch(arguments, root, directory)


def dispatch(arguments: Arguments, root: Path, directory: Path | None) -> None:
    command = arguments.command
    if command == "inspect":
        queries.inspect(root, directory)
    elif command == "list":
        queries.listing(root, directory, arguments)
    elif command == "validate":
        validate(root, directory)
    elif command == "next-id":
        queries.next_id(require_directory(directory), arguments.get("title"))
    else:
        run_catalog(root, require_directory(directory), arguments.action)


def main(argv: list[str] | None = None) -> int:
    try:
        run(parse_arguments(sys.argv[1:] if argv is None else argv))
    except DecisionError as error:
        message = str(error)
        prefix = "" if message.startswith(("usage:", "error:")) else "error: "
        print(prefix + message, file=sys.stderr)
        return error.code
    except OSError as error:
        # Last-resort process boundary for filesystem races after validation.
        print(f"error: decision filesystem operation failed: {error}", file=sys.stderr)
        return 2
    return 0


def entrypoint() -> None:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    raise SystemExit(main())
