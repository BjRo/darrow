"""Public refusals and bounded provider diagnostics."""

import subprocess


class TicketError(Exception):
    def __init__(self, message: str, code: int = 2) -> None:
        super().__init__(message)
        self.code = code


def bounded(text: str, stream: str) -> str:
    lines = text.splitlines(keepends=True)
    result = "".join(lines[:50])
    if len(lines) > 50:
        result += f"note: backend {stream} truncated at 50 lines ({len(lines)} total)\n"
    return result


def failure(result: subprocess.CompletedProcess[str], prefix: str = "") -> TicketError:
    diagnostic = bounded(result.stderr, "stderr") + bounded(result.stdout, "stdout")
    if not diagnostic:
        diagnostic = (
            f"error: GitHub backend command failed with exit {result.returncode}"
            " and no diagnostic\n"
        )
    return TicketError(prefix + diagnostic, 4)
