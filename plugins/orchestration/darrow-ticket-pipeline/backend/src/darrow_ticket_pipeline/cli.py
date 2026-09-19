"""Command dispatch and stable refusal exits for local ticket snapshots."""

import io
import sys
from collections.abc import Sequence

from . import operations
from .model import PipelineError, require

COMMANDS = {
    "init": operations.init,
    "launch": operations.launch,
    "record": operations.record,
    "summary": operations.summary,
    "finish": operations.finish,
}
OPTIONS = {
    "init": "body-file run-id repo base-revision baseline-file output",
    "launch": "body-file phase iteration agent harness model effort output",
    "record": "body-file artifact-file output",
    "summary": "body-file",
    "finish": "body-file status output",
}
USAGE = """usage: ticket-pipeline <command> [args]

  init --body-file <path> --run-id <id> --repo <absolute-path>
       --base-revision <revision> --baseline-file <path> --output <path>
  launch --body-file <path> --phase <phase> --iteration <n> --agent <id>
         --harness <name> --model <name> --effort <name> --output <path>
  record --body-file <path> --artifact-file <path> --output <path>
  summary --body-file <path>
  finish --body-file <path> --status verified|needs_human|blocked|failed|budget_exhausted
         [--reason-file <path>] --output <path>"""


def arguments(command: str, tokens: list[str]) -> dict[str, str]:
    required = OPTIONS[command].split()
    allowed = required + (["reason-file"] if command == "finish" else [])
    if command == "summary":
        require(
            len(tokens) == 2 and tokens[0] == "--body-file",
            "summary requires --body-file",
            2,
        )
    values: dict[str, str] = {}
    pairs = iter(tokens)
    for token in pairs:
        require(
            token.startswith("--") and token[2:] in allowed,
            f"unknown {command} argument: {token}",
            2,
        )
        value = next(pairs, None)
        require(value is not None, f"{token} needs a value", 2)
        assert value is not None
        values[token[2:]] = value
    require(
        all(values.get(key) for key in required),
        f"{command} requires " + ", ".join("--" + key for key in required),
        2,
    )
    return values


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] not in COMMANDS:
        print(USAGE, file=sys.stderr)
        return 64
    command = args.pop(0)
    try:
        print(COMMANDS[command](arguments(command, args)), end="")
    except PipelineError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return exc.code
    except (OSError, UnicodeError) as exc:
        # The process boundary translates filesystem failures without a traceback.
        print(
            f"error: ticket-pipeline filesystem operation failed: {exc}",
            file=sys.stderr,
        )
        return 2
    return 0


def entrypoint() -> None:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    raise SystemExit(main())
