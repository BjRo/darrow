"""Validate a copied plugin using only its locked runtime dependencies."""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(*args: str) -> str:
    return subprocess.check_output(args, text=True, encoding="utf-8")


def launcher(backend: Path) -> list[str]:
    return [
        "uv",
        "run",
        "--quiet",
        "--no-project",
        str((backend / "scripts/run_locked.py").resolve()),
    ]


def validate(plugin: Path, fixture: Path) -> None:
    backend = plugin / "backend"
    packages = command(
        *launcher(backend),
        "python",
        "-c",
        "import importlib.metadata as m; print('\\n'.join(d.metadata['Name'] or '' for d in m.distributions()))",
    )
    assert not any(
        tool in packages
        for tool in ("coverage", "hypothesis", "mypy", "pytest", "ruff")
    )
    command(
        *launcher(backend),
        "python",
        "-c",
        "import darrow_observability_langfuse",
    )
    hooks = json.loads((plugin / "hooks/hooks.json").read_text(encoding="utf-8"))
    handler = hooks["hooks"]["Stop"][0]["hooks"][0]
    field = "commandWindows" if os.name == "nt" else "command"
    capture = handler[field].replace("${PLUGIN_ROOT}", str(plugin))
    environment = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(("DARROW_LANGFUSE_", "LANGFUSE_", "UV_"))
    }
    environment.update(
        {
            "DARROW_LANGFUSE_ENABLED": "false",
            "PLUGIN_ROOT": str(plugin),
            "HOME": str(fixture),
        }
    )
    subprocess.run(
        capture,
        shell=True,
        input="{}\n",
        text=True,
        env=environment,
        cwd=fixture,
        check=True,
    )


def make_read_only(root: Path) -> None:
    for path in reversed([root, *root.rglob("*")]):
        path.chmod(path.stat().st_mode & ~0o222)


def make_writable(root: Path) -> None:
    for path in [root, *root.rglob("*")]:
        path.chmod(path.stat().st_mode | 0o200)


def main() -> None:
    plugin = Path(__file__).resolve().parents[2]
    ignored = shutil.ignore_patterns(
        ".venv",
        "__pycache__",
        ".hypothesis",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".coverage*",
        "coverage.json",
    )
    with tempfile.TemporaryDirectory(prefix="darrow langfuse fresh ") as temporary:
        fixture = Path(temporary).resolve()
        copied = fixture / "plugin copy"
        shutil.copytree(plugin, copied, ignore=ignored)
        os.environ["DARROW_CACHE_DIR"] = str(fixture / "darrow-cache")
        make_read_only(copied)
        validate(copied, fixture)
        assert not list(copied.rglob(".venv"))
        assert not list(copied.rglob("__pycache__"))
        make_writable(copied)
    print(
        "fresh copied Langfuse plugin: runtime dependencies and registered hook passed"
    )


if __name__ == "__main__":
    main()
