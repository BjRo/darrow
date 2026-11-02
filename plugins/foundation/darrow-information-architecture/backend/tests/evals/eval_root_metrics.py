"""Check requested doctor metric artifacts against the real before/after roots."""

import json
import subprocess
from pathlib import Path


def metrics(content: bytes) -> dict[str, int]:
    return {"bytes": len(content), "tokens": (len(content) + 3) // 4}


def verify(root: Path) -> None:
    path = root / ".fixture-state/root-metrics.json"
    reported = json.loads(path.read_text(encoding="utf-8"))
    expected = {}
    for runtime, name in (("codex", "AGENTS.md"), ("claude", "CLAUDE.md")):
        before = subprocess.run(
            ["git", "-C", str(root), "show", f"HEAD:{name}"],
            capture_output=True,
            check=True,
        ).stdout
        expected[runtime] = {
            "before": metrics(before),
            "after": metrics((root / name).read_bytes()),
        }
    assert reported == expected, path


if __name__ == "__main__":
    repository = Path.cwd().resolve()
    verify(repository)
    print(f"metrics-ok: {repository / '.fixture-state/root-metrics.json'}")
