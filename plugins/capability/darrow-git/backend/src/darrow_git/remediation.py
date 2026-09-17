"""Execute only a saved hook diagnostic against its exact failed snapshot."""

import os
import subprocess

from .commit import failure_path, head, retry, validate_refresh
from .commit_options import CommitOptions
from .process import RefusalError, decode, git, invoke, readable, require, succeeds


def read_state() -> tuple[str, str, str]:
    path = failure_path()
    require(readable(path), "no readable hook-failure state for remediation", 7)
    text = path.read_text(encoding="utf-8", errors="surrogateescape")
    metadata, _, output = text.partition("output\n")
    fields = dict(line.split("\t", 1) for line in metadata.splitlines() if "\t" in line)
    previous_head, tree = fields.get("head", ""), fields.get("index_tree", "")
    require(previous_head and tree, "hook-failure state is invalid", 7)
    require(
        previous_head == "unborn"
        or succeeds("rev-parse", "--verify", f"{previous_head}^{{commit}}"),
        "hook-failure state is invalid",
        7,
    )
    require(
        succeeds("rev-parse", "--verify", f"{tree}^{{tree}}"),
        "hook-failure state is invalid",
        7,
    )
    return previous_head, tree, output


def run_diagnostic(command: str) -> subprocess.CompletedProcess[bytes]:
    # This is an explicitly authorized *shell command*, not interpolated provider
    # input. Preserve its historical syntax on POSIX; use the native command
    # interpreter on Windows. Never feed Git/GitHub arguments through this path.
    if os.name == "nt":
        # cmd parses its /c payload itself, not with the CRT argv convention.
        # A list would backslash-escape embedded quotes and corrupt quoted paths.
        interpreter = subprocess.list2cmdline([os.environ.get("COMSPEC", "cmd.exe")])
        return subprocess.run(
            f'{interpreter} /d /s /c "{command}"',
            capture_output=True,
            check=False,
        )
    return invoke(["sh", "-c", command])


def remediate(options: CommitOptions) -> None:
    previous_head, tree, output = read_state()
    require(
        head() == previous_head and git("write-tree") == tree,
        "failed commit state changed; do not remediate",
        7,
    )
    validate_refresh(options.files)
    require(
        options.command in output,
        "remediation command is not present in the failed hook diagnostic",
        7,
    )
    result = run_diagnostic(options.command)
    require(head() == previous_head, "remediation changed HEAD; do not retry", 8)
    if git("write-tree") != tree:
        git("read-tree", tree)
        raise RefusalError(
            "error: remediation changed the index; restored failed commit staging and stopped",
            7,
        )
    if result.returncode:
        raise RefusalError(decode(result.stdout + result.stderr), 4)
    retry(options)
