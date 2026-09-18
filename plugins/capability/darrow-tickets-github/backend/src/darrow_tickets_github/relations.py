"""Read qualified relation identities before making native API changes."""

import json
import re

from .errors import TicketError, failure
from .provider import Provider, array_value, number_field, object_value, string_field


def parent(provider: Provider, number: str) -> str:
    result = provider.call("api", f"repos/{{owner}}/{{repo}}/issues/{number}/parent")
    if result.returncode:
        if "No parent issue found" in result.stderr + result.stdout:
            return ""
        raise failure(result)
    try:
        record = object_value(json.loads(result.stdout))
        target = number_field(record, "number")
        url = string_field(record, "html_url")
    except (ValueError, TicketError) as exc:
        raise TicketError(
            f"error: malformed parent relation response for ticket #{number}", 4
        ) from exc
    validate_parent(provider, number, target, url)
    return target


def validate_parent(provider: Provider, number: str, target: str, url: str) -> None:
    if not re.fullmatch(r"https://[^/\s]+/[^/\s]+/[^/\s]+/issues/" + target, url):
        raise TicketError(
            f"error: malformed parent relation response for ticket #{number}", 4
        )
    local = provider.repository_url()
    if not re.fullmatch(r"https://[^/\s]+/[^/\s]+/[^/\s]+", local):
        raise TicketError(
            f"error: malformed canonical repository URL for 'origin': {local}", 4
        )
    identity = local.removeprefix("https://").lower()
    if identity.split("/", 1)[0] != provider.repository.split("/", 1)[0].lower():
        raise TicketError(
            f"error: canonical repository URL is outside the origin host: https://{identity}",
            4,
        )
    if url.rsplit("/issues/", 1)[0].lower() != local.lower():
        raise TicketError(
            f"error: ticket #{number} has unsupported foreign parent: {url} — cross-repository parent relations are not supported",
            9,
        )


def dependencies(provider: Provider, number: str) -> list[str]:
    pages = provider.json(
        "api",
        f"repos/{{owner}}/{{repo}}/issues/{number}/dependencies/blocked_by",
        "--paginate",
        "--slurp",
    )
    try:
        return [
            number_field(object_value(item), "number")
            for page in array_value(pages)
            for item in array_value(page)
        ]
    except TicketError as exc:
        raise TicketError(
            f"error: malformed dependency relation response for ticket #{number}", 4
        ) from exc


def report(provider: Provider, number: str) -> str:
    parent_id = parent(provider, number)
    deps = dependencies(provider, number)
    parent_text = f"#{parent_id}" if parent_id else "(none)"
    deps_text = " ".join(f"#{dep}" for dep in deps) or "(none)"
    return f"parent: {parent_text}\ndepends-on: {deps_text}"


def change_dependency(
    provider: Provider, number: str, target: str, *, remove: bool = False
) -> None:
    database_id = provider.database_id(target)
    endpoint = f"repos/{{owner}}/{{repo}}/issues/{number}/dependencies/blocked_by"
    if remove:
        provider.run("api", "-X", "DELETE", f"{endpoint}/{database_id}")
    else:
        provider.run("api", "-X", "POST", endpoint, "-F", f"issue_id={database_id}")


def change_parent(
    provider: Provider, number: str, target: str, *, remove: bool = False
) -> None:
    database_id = provider.database_id(number)
    method, suffix = ("DELETE", "sub_issue") if remove else ("POST", "sub_issues")
    provider.run(
        "api",
        "-X",
        method,
        f"repos/{{owner}}/{{repo}}/issues/{target}/{suffix}",
        "-F",
        f"sub_issue_id={database_id}",
    )


def update_dependency(
    provider: Provider, number: str, target: str, *, remove: bool
) -> None:
    if not remove:
        provider.verify(target)
    present = target in dependencies(provider, number)
    if present != remove:
        condition = "does not depend on" if remove else "already depends on"
        raise TicketError(f"error: #{number} {condition} #{target}", 9)
    change_dependency(provider, number, target, remove=remove)
    action = "removed" if remove else "recorded"
    print(f"{action}: #{number} depends-on #{target}")


def update_parent(
    provider: Provider, number: str, target: str, *, remove: bool
) -> None:
    existing = parent(provider, number)
    if remove:
        if not existing:
            raise TicketError(f"error: #{number} has no parent", 9)
        target = existing
    else:
        if existing:
            raise TicketError(
                f"error: #{number} already has parent #{existing} — use --remove-parent first",
                9,
            )
        provider.verify(target)
    change_parent(provider, number, target, remove=remove)
    action = "removed" if remove else "recorded"
    print(f"{action}: #{number} parent #{target}")
