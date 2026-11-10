"""Explicit per-user shell startup integration for the installed command."""

import os
import shlex
import sys
from pathlib import Path

BLOCK = b"""# >>> darrow-artificer PATH >>>
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac
# <<< darrow-artificer PATH <<<
"""


def present() -> bool:
    return str(Path.home() / ".local/bin") in os.environ.get("PATH", "").split(
        os.pathsep
    )


def prepare(enabled: bool) -> list[Path]:
    if not enabled:
        return []
    files = destinations()
    if present():
        return []
    for path in files:
        validate(path, read(path))
        print(f"PATH setup: {path}", file=sys.stderr)
    return files


def read(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        if any(
            candidate.is_symlink() and not candidate.exists()
            for candidate in (path, *path.parents)
        ):
            raise ValueError(f"Broken shell configuration path: {path}") from None
        return b""


def validate(path: Path, content: bytes) -> None:
    remaining = content.replace(BLOCK, b"", 1)
    if b"darrow-artificer PATH" in remaining:
        raise ValueError(
            f"Malformed managed PATH entry: {path}; repair it before initialization"
        )
    if (
        BLOCK in content
        and content.index(BLOCK) > 0
        and content[content.index(BLOCK) - 1] != 10
    ):
        raise ValueError(
            f"Malformed managed PATH entry: {path}; expected a separate line"
        )


def append(path: Path) -> None:
    import fcntl

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as output:
        fcntl.flock(output, fcntl.LOCK_EX)
        output.seek(0)
        content = output.read()
        validate(path, content)
        if BLOCK not in content:
            separator = b"\n" if content and not content.endswith(b"\n") else b""
            output.write(separator + BLOCK)
            output.flush()
            os.fsync(output.fileno())


def apply(files: list[Path]) -> None:
    for path in files:
        append(path)
    if files:
        print(
            f"Open a new terminal or source {shlex.quote(str(files[0]))} to use darrow-artificer.",
            file=sys.stderr,
        )


def destinations() -> list[Path]:
    shell = Path(os.environ.get("SHELL", "")).name
    if not supported():
        raise ValueError(
            "PATH setup supports macOS zsh and Bash; configure your shell manually"
        )
    if shell == "zsh":
        return [zsh_config()]
    candidates = [
        Path.home() / name for name in (".bash_profile", ".bash_login", ".profile")
    ]
    login = next(
        (path for path in candidates if path.exists() or path.is_symlink()),
        candidates[0],
    )
    return [Path.home() / ".bashrc", login]


def supported() -> bool:
    return sys.platform == "darwin" and Path(os.environ.get("SHELL", "")).name in {
        "zsh",
        "bash",
    }


def zsh_config() -> Path:
    directory = Path(os.environ.get("ZDOTDIR", str(Path.home())))
    if not directory.is_absolute():
        raise ValueError(
            "ZDOTDIR must name a nonempty absolute directory; unset it to use HOME"
        )
    return directory / ".zshrc"
