"""Consume literal option values without interpreting their contents."""

from collections import deque

from .process import require


def take_value(args: deque[str], message: str, code: int = 2) -> str:
    require(args, message, code)
    return args.popleft()
