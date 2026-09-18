"""Read-only design evidence inventory."""

from pathlib import Path

from darrow_ia.filesystem import ENTRY_NAMES, ROOT_NAMES, unreadable_reason, walk

MANIFESTS = {
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Makefile",
}
AUTOMATION = {"lefthook.yml", "lefthook.yaml", ".pre-commit-config.yaml", "hooks.json"}


def validate_required(root: Path) -> None:
    for name in ROOT_NAMES:
        validate_file(root / name, root, "instruction entrypoint")
    validate_file(root / ".codex/config.toml", root, "Codex project configuration")


def validate_file(path: Path, root: Path, label: str) -> None:
    if (path.exists() or path.is_symlink()) and unreadable_reason(path, root):
        raise ValueError(
            f"{label} is unreadable, missing, or not a regular file: {path}"
        )


def group(label: str, records: list[str]) -> list[str]:
    lines = [f"{label}:", *(f"  - {record}" for record in records[:40])]
    if len(records) > 40:
        lines.append("  - ...")
    return lines


def entry_record(path: Path, root: Path) -> str:
    validate_file(path, root, "instruction entrypoint")
    size = path.stat().st_size
    return f"{path} | bytes={size} | approx_tokens={(size + 3) // 4}"


def guidance_candidate(path: Path, root: Path) -> bool:
    parts = path.relative_to(root).parts[:-1]
    return path.suffix == ".md" and any(
        part in {"rules", "docs"} or part.startswith("agent") for part in parts
    )


def inspect(root: Path) -> str:
    validate_required(root)
    files, directories = walk(root)
    lines = [f"root: {root}"]
    lines.extend(
        group(
            "entrypoints",
            [entry_record(path, root) for path in files if path.name in ENTRY_NAMES],
        )
    )
    lines.extend(
        group(
            "runtime_adapters",
            [
                str(path)
                for path in directories
                if path.name in {".claude", ".agents", ".codex", ".pi"}
            ],
        )
    )
    lines.extend(
        group(
            "manifests",
            [
                str(path)
                for path in files
                if len(path.relative_to(root).parts) <= 3 and path.name in MANIFESTS
            ],
        )
    )
    lines.extend(
        group("automation", [str(path) for path in files if automation(path, root)])
    )
    lines.extend(
        group("skills", [str(path) for path in files if path.name == "SKILL.md"])
    )
    lines.extend(
        group(
            "guidance_candidates",
            [str(path) for path in files if guidance_candidate(path, root)],
        )
    )
    return "\n".join(lines) + "\n"


def automation(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    return len(relative.parts) <= 4 and (
        ".github/workflows/" in relative.as_posix() or path.name in AUTOMATION
    )
