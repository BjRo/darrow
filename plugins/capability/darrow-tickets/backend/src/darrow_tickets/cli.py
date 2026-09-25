"""Public CLI dispatch and process-level error reporting."""

import io
import sys
from collections.abc import Sequence

from .arguments import Arguments, parse
from .errors import TicketError
from .selection import select_provider
from .temporary import allocate_temp_file

COMMANDS = frozenset(
    {
        "temp-file",
        "inspect",
        "list",
        "get",
        "create",
        "comment",
        "describe",
        "close",
        "reopen",
        "label",
        "relate",
    }
)

USAGE = """usage: ticket <command> [args] [--provider <name>]

  temp-file   # allocate a private body draft; no tracker access
  inspect
  list [--state open|closed|all] [--type <t>] [--label <l>]... [--search <q>]
       [--milestone <m>] [--limit <n>]
  get <id|canonical-url>
  create --title <t> --type bug|feature|task|chore --body-file <f>
         [--label <l>]... [--milestone <m>] [--assignee <a>]
         [--depends-on <id>]... [--parent <id>]
  comment <id> --body-file <f>
  describe <id> --body-file <f>   # full description rewrite, explicit request only
  close <id>
  reopen <id>
  label <id> (--add <l> | --remove <l>)
  relate <id> (--depends-on <id> | --remove-depends-on <id> |
               --parent <id> | --remove-parent)

create enforces body structure per type:
  bug      -> "## Observed", "## Expected", "## Reproduction"
  feature  -> "## Motivation", "## Acceptance criteria"
  task     -> "## Outcome", "## Done criteria"
  chore    -> "## Outcome", "## Done criteria"
"## Open questions" is optional on every type."""


def execute_command(arguments: Arguments) -> None:
    if arguments.command == "temp-file":
        if arguments.options:
            raise TicketError("error: temp-file accepts no options")
        print(allocate_temp_file())
    else:
        select_provider(arguments).execute(arguments)


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] not in COMMANDS:
        print(USAGE, file=sys.stderr)
        return 64
    try:
        command = args.pop(0)
        arguments = parse(command, args)
        execute_command(arguments)
    except TicketError as exc:
        sys.stdout.flush()
        text = str(exc)
        print(text, end="" if text.endswith("\n") else "\n", file=sys.stderr)
        return exc.code
    except OSError as exc:
        # The process boundary covers filesystem failures (including temp files).
        print(f"error: ticket filesystem operation failed: {exc}", file=sys.stderr)
        return 2
    return 0


def entrypoint() -> None:
    for stream in (sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")
    raise SystemExit(main())
