"""Independent release-skill metadata and reachability checks for the doctor eval."""

import argparse
import os
import re
import subprocess
from itertools import takewhile
from pathlib import Path


def skills(root: Path) -> list[Path]:
    visited: set[Path] = set()
    found = []
    for directory, children, files in os.walk(root, followlinks=True):
        path = Path(directory)
        if path.resolve() in visited:
            children.clear()
            continue
        visited.add(path.resolve())
        if "SKILL.md" in files and "doctor-information-architecture" not in str(path):
            found.append(path / "SKILL.md")
    return sorted(found)


def release_skill(root: Path) -> Path:
    matches = [
        path
        for path in skills(root)
        if "build-release" in path.read_text(encoding="utf-8").lower()
    ]
    assert matches, "release skill is missing"
    return matches[0]


def scalar(value: str) -> bool:
    value = re.sub(r"\s+#.*$", "", value).strip()
    return bool(value) and not (
        value.startswith(("[", "{"))
        or value in ('""', "''")
        or re.fullmatch(r"null|~|true|false|yes|no|on|off|[0-9]+", value, re.I)
        or block_header(value)
    )


def block_header(value: str) -> bool:
    return re.fullmatch(r"[|>](?:[1-9][+-]?|[+-][1-9]?)?", value) is not None


def field_valid(lines: list[str], index: int, value: str) -> bool:
    value = re.sub(r"\s+#.*$", "", value).strip()
    if block_header(value):
        content = takewhile(
            lambda line: not line or line.startswith(" "), lines[index + 1 :]
        )
        return bool("\n".join(content).strip())
    return scalar(value)


def metadata(path: Path) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    assert lines and lines[0] == "---", "missing frontmatter"
    end = lines.index("---", 1)
    fields = {}
    for index, line in enumerate(lines[1:end], 1):
        match = re.match(r"^(name|description)\s*:(.*)$", line)
        if match:
            assert match[1] not in fields, "duplicate discovery metadata"
            fields[match[1]] = field_valid(lines[:end], index, match[2])
    assert all(fields.get(key, False) for key in ("name", "description"))


def visible(root: Path, path: Path) -> bool:
    result = subprocess.run(
        ["git", "check-ignore", "-q", "--", str(path)],
        cwd=root,
        check=False,
    )
    assert result.returncode in (0, 1), "git check-ignore failed"
    return result.returncode == 1


def native_release(root: Path, directory: str) -> bool:
    pattern = (
        r"preflight.*package\.json.*build-release.*dist/checksums\.txt"
        r".*tools/publish.*explicit confirmation"
    )
    return any(
        visible(root, path)
        and re.search(pattern, path.read_text(encoding="utf-8"), re.I | re.S)
        for path in skills(root / directory)
    )


def resident_intent(text: str, target: str) -> bool:
    return any(
        target in line
        and re.search(r"release|publish", line, re.I)
        and re.search(r"read|load|use", line, re.I)
        for line in text.splitlines()
    )


def reachable(root: Path) -> None:
    skill = release_skill(root)
    target = str(skill.relative_to(root))
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--frozen",
            "--no-dev",
            "--project",
            str(root / ".git/ia-backend"),
            "ia-doctor",
            "inspect",
            "--runtime",
            "codex",
            ".",
        ],
        cwd=root,
        text=True,
        capture_output=True,
        check=True,
    )
    graph_route = f"{root / 'AGENTS.md'} -> {skill.resolve()}" in result.stdout
    text = (root / "AGENTS.md").read_text(encoding="utf-8")
    if graph_route and resident_intent(text, target):
        return
    assert native_release(root, ".agents/skills") and native_release(
        root, ".claude/skills"
    ), "release procedure needs an exact intent route or both native loaders"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("check", choices=("metadata", "reachable"))
    arguments = parser.parse_args()
    root = Path.cwd().resolve()
    if arguments.check == "metadata":
        metadata(release_skill(root))
        print("valid")
    else:
        reachable(root)
        print("discoverable")


if __name__ == "__main__":
    main()
