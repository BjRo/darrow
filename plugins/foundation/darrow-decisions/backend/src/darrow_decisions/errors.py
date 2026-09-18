"""Stable CLI failures and bounded validation diagnostics."""

from dataclasses import dataclass, field


class DecisionError(Exception):
    def __init__(self, message: str, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class Diagnostics:
    messages: list[str] = field(default_factory=list)
    count: int = 0

    def add(self, message: str) -> None:
        self.count += 1
        if len(self.messages) < 40:
            self.messages.append(f"error: {message}")

    def require_valid(self) -> None:
        if not self.count:
            return
        lines = list(self.messages)
        if self.count > 40:
            lines.append(f"error: {self.count - 40} additional diagnostics omitted")
        raise DecisionError("\n".join(lines), 4)
