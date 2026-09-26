"""One explicitly requested literal check, captured as canonical evidence."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from . import storage
from .common import ReviewError, new_record, require, root_directory, run, serialize


def shell_args(command: str) -> list[str]:
    if os.name == "nt":
        shell = shutil.which("pwsh") or shutil.which("powershell")
        require(shell, "PowerShell is unavailable")
        return [
            str(shell),
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            powershell_check(command),
        ]
    shell = os.environ.get("BASH") or shutil.which("bash")
    require(shell, "Bash is unavailable")
    return [str(shell), "-c", command]


def powershell_check(command: str) -> str:
    # This boundary deliberately accepts caller-authored shell syntax.
    # Preserve native exit codes and map unavailable commands to the JSON contract.
    return (
        "$ErrorActionPreference = 'Stop'; "
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
        "try { & { " + command + " }; $ok = $?; "
        "if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }; "
        "if (-not $ok) { exit 1 } } "
        "catch [System.Management.Automation.CommandNotFoundException] { "
        "[Console]::Error.WriteLine($_.Exception.Message); exit 127 } "
        "catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
    )


def execute(command: str) -> tuple[int, str]:
    try:
        result = run(shell_args(command), merge_output=True)
    except (OSError, ReviewError) as exc:
        return 127, str(exc)
    # Merge at the process boundary and keep bounded multiline evidence.
    output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    evidence = output[:512]
    code = result.returncode if result.returncode >= 0 else 128 - result.returncode
    return code, evidence or "no output"


def capture(output: str, command: str) -> str:
    require(
        command and "\0" not in command,
        "command must be nonempty and contain no NUL byte",
    )
    require(Path(output).is_absolute(), "output must be an absolute path")
    require(Path(output).name not in ("", ".", ".."), "output must name a file")
    path = storage.check_output(root_directory(str(Path.cwd())), Path(output))
    require(
        not path.exists() and not path.is_symlink(), f"output already exists: {path}"
    )
    code, first = execute(command)
    status = "pass" if code == 0 else "blocked" if code in (126, 127) else "fail"
    body = serialize(
        {
            "format": "darrow-review-check-v3",
            "check": {
                "command": command,
                "applicability": "applicable",
                "status": status,
                "evidence": f"exited {code}: {first}",
            },
            "exit_code": str(code),
        }
    )
    record = new_record(str(path), body)
    return serialize({"check_record": str(record)})
