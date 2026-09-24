"""Choose one bundled tracker before any tracker access."""

from .arguments import Arguments
from .errors import TicketError
from .providers import TicketAdapter
from .providers.github import GitHubAdapter

PROVIDERS: dict[str, TicketAdapter] = {"github": GitHubAdapter()}


def select_provider(args: Arguments) -> TicketAdapter:
    requested = args.values("provider")
    if len(requested) > 1:
        raise TicketError("error: --provider accepts exactly one tracker")
    choice = requested[0] if requested else ""
    if not choice:
        if len(PROVIDERS) != 1:
            names = ", ".join(sorted(PROVIDERS)) or "(none)"
            raise TicketError(
                f"error: ticket provider is ambiguous — select --provider from: {names}",
                3,
            )
        choice = next(iter(PROVIDERS))
    adapter = PROVIDERS.get(choice)
    if adapter is None:
        names = ", ".join(sorted(PROVIDERS)) or "(none)"
        raise TicketError(
            f"error: ticket provider is unavailable: {choice} (available: {names})",
            3,
        )
    args.options.pop("provider", None)
    return adapter
