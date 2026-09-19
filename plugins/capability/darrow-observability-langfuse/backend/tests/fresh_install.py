"""Validate a copied plugin using only its locked runtime dependencies."""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def command(*args: str) -> str:
    return subprocess.check_output(args, text=True, encoding="utf-8")


def validate(plugin: Path, fixture: Path) -> None:
    backend = plugin / "backend"
    command("uv", "sync", "--frozen", "--no-dev", "--project", str(backend))
    tree = command("uv", "tree", "--frozen", "--no-dev", "--project", str(backend))
    assert not any(
        tool in tree for tool in ("coverage", "hypothesis", "mypy", "pytest", "ruff")
    )
    command(
        "uv",
        "run",
        "--quiet",
        "--frozen",
        "--no-dev",
        "--project",
        str(backend),
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
        validate(copied, fixture)
    print(
        "fresh copied Langfuse plugin: runtime dependencies and registered hook passed"
    )


if __name__ == "__main__":
    main()
