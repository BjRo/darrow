"""Adapter, duplicate-content, and root-budget checks."""

import hashlib
import os
import re
from collections import defaultdict
from pathlib import Path, PureWindowsPath

from darrow_ia.filesystem import ROOT_NAMES, inside, read_text, readable, walk
from darrow_ia.graph import Audit


def mirror_paths(spec: str, root: Path) -> tuple[Path, Path]:
    if "=" not in spec:
        raise ValueError(f"mirror must be source=target: {spec}")
    parts = spec.split("=", 1)
    if not all(valid_mirror_path(part) for part in parts):
        raise ValueError(f"mirror paths must stay inside the repository: {spec}")
    paths = (root / parts[0], root / parts[1])
    if not all(inside(path.resolve(), root) for path in paths):
        raise ValueError(f"mirror paths must stay inside the repository: {spec}")
    return paths


def valid_mirror_path(value: str) -> bool:
    windows = PureWindowsPath(value)
    return (
        bool(value)
        and not windows.drive
        and not windows.root
        and not Path(value).is_absolute()
        and ".." not in windows.parts
    )


def mirror_files(directory: Path) -> dict[str, bytes]:
    files, _ = walk(directory, prune=False)
    return {
        path.relative_to(directory).as_posix(): path.read_bytes()
        for path in files
        if path.name != ".DS_Store"
    }


def compare_mirror(source: Path, target: Path) -> list[str]:
    prefix = f"{source} -> {target}"
    if not all(
        path.is_dir() and os.access(path, os.R_OK | os.X_OK)
        for path in (source, target)
    ):
        return [
            f"{prefix} | declared mirror source or target is unreadable, unsearchable, or missing"
        ]
    try:
        left, right = mirror_files(source), mirror_files(target)
    except OSError as error:
        return [f"{prefix} | traversal failed: {error}"]
    if left.keys() != right.keys():
        return [f"{prefix} | file sets differ"]
    return [
        f"{prefix} | content differs: {name}"
        for name in sorted(left)
        if left[name] != right[name]
    ]


def check_mirrors(audit: Audit, specs: list[str]) -> set[Path]:
    extra: set[Path] = set()
    for spec in specs:
        source, target = mirror_paths(spec, audit.root)
        drift = compare_mirror(source, target)
        audit.findings["adapter-drift"].update(drift)
        status = "drift" if drift else "aligned"
        audit.mirrors.append(f"{source} -> {target} | status={status} | declared=true")
        extra.update(mirror_guidance(source, target))
    return extra


def mirror_guidance(source: Path, target: Path) -> set[Path]:
    extra: set[Path] = set()
    for directory in (source, target):
        if directory.is_dir() and os.access(directory, os.R_OK | os.X_OK):
            files, _ = walk(directory)
            extra.update(path for path in files if path.suffix == ".md")
    return extra


def root_adapter(audit: Audit) -> tuple[Path, Path] | None:
    agents, claude = audit.root / "AGENTS.md", audit.root / "CLAUDE.md"
    for source, target in ((agents, claude), (claude, agents)):
        if (
            source.is_file()
            and target.is_symlink()
            and target.is_file()
            and source.samefile(target)
        ):
            audit.mirrors.insert(0, f"{source} -> {target} | status=symlink")
            return source, target
    return None


def duplicates(
    audit: Audit, specs: list[str], adapter: tuple[Path, Path] | None
) -> None:
    groups: dict[bytes, list[Path]] = defaultdict(list)
    for path in sorted(audit.files):
        if readable(path):
            groups[hashlib.sha256(path.read_bytes()).digest()].append(path)
    for paths in groups.values():
        if len(paths) > 1 and not intentional(paths, audit, specs, adapter):
            audit.findings["duplicate-content"].add(" = ".join(map(str, paths)))


def intentional(
    paths: list[Path], audit: Audit, specs: list[str], adapter: tuple[Path, Path] | None
) -> bool:
    if adapter and set(paths) == set(adapter):
        return True
    return any(mirrored_group(paths, audit, spec) for spec in specs)


def mirrored_group(paths: list[Path], audit: Audit, spec: str) -> bool:
    source, target = mirror_paths(spec, audit.root)
    record = f"{source} -> {target} | status=aligned | declared=true"
    return (
        record in audit.mirrors
        and any(inside(path, source) for path in paths)
        and any(inside(path, target) for path in paths)
    )


def root_budget(audit: Audit) -> int:
    config = audit.root / ".codex/config.toml"
    if audit.runtime == "claude" or not (config.exists() or config.is_symlink()):
        return 32768
    if not audit.add(config):
        return 32768
    match = re.search(
        r"^\s*project_doc_max_bytes\s*=\s*([0-9]+)\s*(?:#.*)?$",
        read_text(config),
        re.MULTILINE,
    )
    return int(match[1]) if match else 32768


def metrics(audit: Audit) -> None:
    budget = root_budget(audit)
    for runtime, seeds in audit.seeds.items():
        for path in sorted(seeds):
            root_metric(audit, runtime, path, budget)
    for path in audit.files:
        if audit.relative(path).startswith(".claude/rules/") and readable(path):
            check_always_loaded(audit, path)


def root_metric(audit: Audit, runtime: str, path: Path, budget: int) -> None:
    if not readable(path) or audit.relative(path) not in ROOT_NAMES:
        return
    size = path.stat().st_size
    audit.root_bytes[runtime] += size
    if runtime == "codex" and runtime in audit.runtimes and size > budget:
        audit.findings["root-budget"].add(f"{path} bytes={size} limit={budget}")


def check_always_loaded(audit: Audit, path: Path) -> None:
    try:
        content = read_text(path)
    except (OSError, UnicodeError):
        # Selected dependencies are diagnosed by traversal. Advisory inventory
        # must not let an unselected runtime block verification.
        return
    scoped = re.search(r"^\s*paths\s*:", content, re.MULTILINE)
    universal = re.search(
        r'paths:\s*\[[^\]]*"\*\*"|^\s*-\s*"\*\*"', content, re.MULTILINE
    )
    if not scoped or universal:
        audit.findings["always-loaded-rule"].add(str(path))
