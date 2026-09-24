"""Seven frozen public entrypoints with one explicit process/error boundary."""

from __future__ import annotations

import argparse
import io
import signal
import sys
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import NoReturn

from . import check, provider, report, result, routing, scope, storage
from .common import ReviewError, read_text, require, root_directory, serialize
from .records import validate_result


def terminate(signum: int, _frame: object) -> NoReturn:
    raise SystemExit(128 + signum)


def configure_streams() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if isinstance(stream, io.TextIOWrapper):
            stream.reconfigure(encoding="utf-8", newline="\n")


def boundary(program: str, operation: Callable[[list[str]], str | bytes]) -> None:
    configure_streams()
    previous = signal.signal(signal.SIGTERM, terminate)
    try:
        output = operation(sys.argv[1:])
        if isinstance(output, bytes):
            sys.stdout.buffer.write(output)
        else:
            sys.stdout.write(output)
    except ReviewError as exc:
        print(f"{program}: {exc}", file=sys.stderr)
        raise SystemExit(exc.code) from exc
    except (OSError, UnicodeError) as exc:
        print(f"{program}: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    except KeyboardInterrupt as exc:
        raise SystemExit(130) from exc
    finally:
        signal.signal(signal.SIGTERM, previous)


def options(
    program: str,
    args: Sequence[str],
    required: Sequence[str],
    optional: Sequence[str] = (),
    flags: Sequence[str] = (),
) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog=program, allow_abbrev=False)
    for name in required:
        parser.add_argument("--" + name, required=True)
    for name in optional:
        parser.add_argument("--" + name, default="")
    for name in flags:
        parser.add_argument("--" + name, action="store_true")
    return parser.parse_args(args)


def scope_command(args: list[str]) -> str | bytes:
    require(
        args,
        "Usage: review-scope prepare|show|compare|allocate-terminal|locate|prune|pin|unpin [options]",
    )
    command, rest = args[0], args[1:]
    handlers: dict[str, Callable[[list[str]], str | bytes]] = {
        "prepare": prepare_scope,
        "show": show_scope,
        "compare": compare_scope,
        "allocate-terminal": allocate_terminal_scope,
        "locate": locate_scope,
        "prune": prune_scope,
        "pin": pin_scope,
        "unpin": unpin_scope,
    }
    require(
        command in handlers,
        "Usage: review-scope prepare|show|compare|allocate-terminal|locate|prune|pin|unpin [options]",
    )
    return handlers[command](rest)


def prepare_scope(args: list[str]) -> str:
    parsed = options(
        "review-scope prepare",
        args,
        ("base", "target"),
        ("repo", "prior-manifest"),
        ("merge-base", "staged", "unstaged", "untracked", "allow-empty"),
    )
    parsed.repo = parsed.repo or "."
    return scope.prepare(scope.ScopeOptions(**vars(parsed)))


def show_scope(args: list[str]) -> bytes:
    parsed = options("review-scope show", args, ("manifest",))
    return scope.show(parsed.manifest)


def compare_scope(args: list[str]) -> str:
    parsed = options(
        "review-scope compare", args, ("prior-manifest", "current-manifest")
    )
    return scope.compare(parsed.prior_manifest, parsed.current_manifest)


def allocate_terminal_scope(args: list[str]) -> str:
    parsed = options("review-scope allocate-terminal", args, ("repo",))
    repo = root_directory(parsed.repo)
    run = storage.allocate_terminal(repo)
    return serialize([["artifact_dir", str(run)], ["manifest", str(run / "scope.tsv")]])


def locate_scope(args: list[str]) -> str:
    parsed = options("review-scope locate", args, ("repo", "target"))
    candidate = storage.locate(root_directory(parsed.repo), parsed.target)
    require(
        candidate is not None,
        f"review artifact is unavailable for target: {parsed.target}",
        4,
    )
    return serialize([["manifest", str(candidate)]])


def prune_scope(args: list[str]) -> str:
    parsed = options(
        "review-scope prune", args, (), ("repo", "older-than-days"), ("all",)
    )
    days = parsed.older_than_days
    require(
        not days or days.isdecimal(), "older-than-days must be a nonnegative integer"
    )
    require(parsed.all or parsed.repo, "prune requires --repo or --all")
    age = int(days) if days else storage.RETENTION_DAYS
    removed = (
        storage.prune_all(older_than_days=age)
        if parsed.all
        else storage.prune(root_directory(parsed.repo), age)
    )
    return serialize(
        [["pruned", str(len(removed))], *[["removed", str(p)] for p in removed]]
    )


def pin_scope(args: list[str]) -> str:
    parsed = options("review-scope pin", args, ("manifest",))
    return serialize([["pinned", str(storage.pin(Path(parsed.manifest)))]])


def unpin_scope(args: list[str]) -> str:
    parsed = options("review-scope unpin", args, ("manifest",))
    return serialize([["unpinned", str(storage.unpin(Path(parsed.manifest)))]])


def result_command(args: list[str]) -> str:
    require(args, "Usage: review-result COMMAND FILE [FILE]")
    command, rest = args[0], args[1:]
    counts = {
        "validate": 1,
        "validate-verification": 1,
        "validate-axis": 2,
        "validate-fix-axis": 2,
        "original-findings": 1,
        "validate-original": 2,
        "scope-records": 1,
        "validate-scope": 2,
    }
    require(
        command in counts and len(rest) == counts[command],
        "Usage: review-result COMMAND FILE [FILE]",
    )
    return result_operation(command, rest)


def result_operation(command: str, args: list[str]) -> str:
    handlers: dict[str, Callable[[], str]] = {
        "scope-records": lambda: serialize(result.scope_records(args[0])),
        "validate-scope": lambda: result.validate_scope(args[0], args[1]),
        "original-findings": lambda: serialize(
            result.original_findings(
                validate_result(read_text(args[0], "original result"))
            )
        ),
        "validate-original": lambda: result.validate_original(args[0], args[1]),
    }
    if command in handlers:
        return handlers[command]()
    axis = args[0] if command.endswith("axis") else ""
    require(not axis or axis in ("standards", "spec"), "axis must be standards or spec")
    return result.validate(command, args[-1], axis)


def report_command(args: list[str]) -> str:
    require(
        len(args) == 2 and args[0] in ("render", "render-verification"),
        "Usage: review-report render|render-verification RESULT_FILE",
    )
    return report.render(args[0], args[1])


def check_command(args: list[str]) -> str:
    require(
        args and args[0] == "run",
        "Usage: review-check run --output ABSOLUTE_PATH --command LITERAL_COMMAND",
    )
    parsed = options("review-check run", args[1:], ("output", "command"))
    return check.capture(parsed.output, parsed.command)


def provider_command(args: list[str]) -> str:
    require(args == ["observe-direct"], "usage: claude-provider observe-direct")
    return provider.direct()


def verify_command(args: list[str]) -> str:
    parsed = options(
        "review-claude-verify", args, ("repo", "agent-id"), ("projects-dir", "record")
    )
    return provider.verify(
        parsed.repo, parsed.agent_id, parsed.projects_dir, parsed.record
    )


def route_command(args: list[str]) -> str:
    if args and args[0] in ("help", "-h", "--help"):
        return "usage: review-route resolve|select|claude-agent|confirm-codex|confirm-claude [options]\n"
    require(
        args,
        "usage: review-route resolve|select|claude-agent|confirm-codex|confirm-claude [options]",
    )
    handlers = {
        "resolve": resolve_route,
        "select": select_route,
        "claude-agent": claude_route,
        "confirm-codex": confirm_codex,
        "confirm-claude": confirm_claude,
    }
    require(args[0] in handlers, f"unknown command: {args[0]}")
    return handlers[args[0]](args[1:])


def resolve_route(args: list[str]) -> str:
    parsed = options("review-route resolve", args, ("repo", "host"))
    return routing.resolve(parsed.repo, parsed.host).body()


def select_route(args: list[str]) -> str:
    parsed = options("review-route select", args, ("repo", "host", "record"))
    return routing.select(parsed.repo, parsed.host, parsed.record)


def claude_route(args: list[str]) -> str:
    parsed = options(
        "review-route claude-agent",
        args,
        (),
        ("route-record", "provider", "model", "effort"),
    )
    route = routing.Route("claude", parsed.provider, parsed.model, parsed.effort)
    if parsed.route_record:
        require(
            not any((parsed.provider, parsed.model, parsed.effort)),
            "claude-agent route record cannot be combined with route fields",
        )
        route = routing.load_route(parsed.route_record, "claude")
    require(
        all(route.fields()), "claude-agent requires --route-record or all route fields"
    )
    return routing.claude_agent(route)


def confirm_codex(args: list[str]) -> str:
    parsed = options(
        "review-route confirm-codex",
        args,
        ("route-record", "axis", "agent-id", "application-record"),
    )
    return routing.confirm(
        parsed.route_record,
        parsed.axis,
        parsed.application_record,
        agent=parsed.agent_id,
    )


def confirm_claude(args: list[str]) -> str:
    parsed = options(
        "review-route confirm-claude",
        args,
        ("route-record", "observed-record", "axis", "application-record"),
    )
    return routing.confirm(
        parsed.route_record,
        parsed.axis,
        parsed.application_record,
        observed_path=parsed.observed_record,
    )


def review_scope() -> None:
    boundary("review-scope", scope_command)


def review_result() -> None:
    boundary("review-result", result_command)


def review_report() -> None:
    boundary("review-report", report_command)


def review_check() -> None:
    boundary("review-check", check_command)


def review_route() -> None:
    boundary("review-route", route_command)


def review_claude_verify() -> None:
    boundary("review-claude-verify", verify_command)


def claude_provider() -> None:
    boundary("claude-provider", provider_command)
