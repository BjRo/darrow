"""Contained tracker adapters for the public ticket commands."""

from typing import Protocol

from ..arguments import Arguments


class TicketAdapter(Protocol):
    """Execute one public operation using one selected tracker."""

    def execute(self, args: Arguments) -> None: ...
