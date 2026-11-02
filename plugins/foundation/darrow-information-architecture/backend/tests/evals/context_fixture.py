"""Shared preparation and UV capture for context-usage native evals."""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def real_uv() -> str:
    search = os.pathsep.join(
        path for path in os.get_exec_path() if "fixture-bin" not in Path(path).parts
    )
    executable = shutil.which("uv", path=search)
    if executable is None:
        raise RuntimeError("context fixture needs the real UV executable")
    return str(Path(executable).resolve())


def prepare(root: Path) -> None:
    source = Path(__file__).resolve().parents[2]
    git = root / ".git"
    backend = git / "ia-backend"
    backend.mkdir(parents=True)
    shutil.copytree(source / "src", backend / "src")
    for name in ("pyproject.toml", "uv.lock"):
        shutil.copyfile(source / name, backend / name)
    tools = git / "fixture-bin"
    tools.mkdir(exist_ok=True)
    shutil.copyfile(Path(__file__), tools / "context_fixture.py")
    oracle = git / "eval-checks/ia"
    oracle.mkdir(parents=True)
    shutil.copyfile(
        Path(__file__).with_name("eval_context_usage.py"),
        oracle / "eval_context_usage.py",
    )
    (git / "context-python").write_text(sys.executable, encoding="utf-8")
    (git / "context-uv").write_text(real_uv(), encoding="utf-8")


def capture(root: Path, arguments: list[str]) -> subprocess.CompletedProcess[bytes]:
    executable = (root / ".git/context-uv").read_text(encoding="utf-8")
    result = subprocess.run([executable, *arguments], capture_output=True, check=False)
    directory = root / ".fixture-state/context-capture"
    directory.mkdir(parents=True, exist_ok=True)
    record = Path(tempfile.mkdtemp(prefix="call.", dir=directory))
    (record / "output").write_bytes(result.stdout)
    (record / "error").write_bytes(result.stderr)
    (record / "status").write_text(str(result.returncode), encoding="utf-8")
    (record / "arguments").write_text("\n".join(arguments), encoding="utf-8")
    (record / "thread").write_text(
        os.environ.get("CODEX_THREAD_ID", ""), encoding="utf-8"
    )
    return result


def forward(root: Path, arguments: list[str]) -> None:
    if "--no-project" not in arguments or "ia-context" not in arguments:
        executable = (root / ".git/context-uv").read_text(encoding="utf-8")
        os.execv(executable, [executable, *arguments])
    result = capture(root, arguments)
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    if result.returncode < 0:
        os.kill(os.getpid(), -result.returncode)
    sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("prepare", "capture"))
    parser.add_argument("root", type=Path)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.mode == "prepare":
        prepare(root)
    else:
        forward(root, args.arguments)


if __name__ == "__main__":
    main()
