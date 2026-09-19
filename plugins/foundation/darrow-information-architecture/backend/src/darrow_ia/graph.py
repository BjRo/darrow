"""Selected-runtime graph traversal and reachability."""

from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from darrow_ia.filesystem import (
    ENTRY_NAMES,
    RULE_DIRS,
    exact_path,
    read_text,
    unreadable_reason,
    walk,
)
from darrow_ia.references import guidance_reference, references, resolve


@dataclass
class Audit:
    root: Path
    runtime: str
    files: set[Path] = field(default_factory=set)
    entrypoints: list[Path] = field(default_factory=list)
    seeds: dict[str, set[Path]] = field(default_factory=dict)
    edges: set[tuple[Path, Path]] = field(default_factory=set)
    findings: dict[str, set[str]] = field(default_factory=lambda: defaultdict(set))
    mirrors: list[str] = field(default_factory=list)
    root_bytes: dict[str, int] = field(
        default_factory=lambda: {"codex": 0, "claude": 0}
    )

    @property
    def runtimes(self) -> tuple[str, ...]:
        return ("codex", "claude") if self.runtime == "both" else (self.runtime,)

    def relative(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def add(self, path: Path) -> bool:
        self.files.add(path)
        reason = unreadable_reason(path, self.root)
        if reason:
            self.findings["unreadable-guidance"].add(reason)
        return reason is None


def choose_runtime(root: Path, runtime: str) -> str:
    if runtime != "auto":
        return runtime
    codex = any(
        named_entrypoint(root / name) for name in ("AGENTS.md", "AGENTS.override.md")
    )
    claude = any(
        named_entrypoint(root / name) for name in ("CLAUDE.md", ".claude/CLAUDE.md")
    )
    if claude:
        return "both" if codex else "claude"
    return "codex"


def named_entrypoint(path: Path) -> bool:
    return path.is_file() and exact_path(path)


def inventory(audit: Audit) -> None:
    files, _ = walk(audit.root)
    audit.entrypoints = [path for path in files if path.name in ENTRY_NAMES]
    audit.files.update(audit.entrypoints)
    rules = {path for path in files if is_rule(audit.relative(path))}
    audit.files.update(rules)
    override = audit.root / "AGENTS.override.md"
    active = (
        "AGENTS.override.md"
        if override in audit.entrypoints
        and override.is_file()
        and override.stat().st_size
        else "AGENTS.md"
    )
    audit.seeds = {
        "codex": {path for path in audit.entrypoints if audit.relative(path) == active},
        "claude": {
            path for path in audit.entrypoints if path.name.startswith("CLAUDE")
        },
    }
    audit.seeds["claude"].update(
        path for path in rules if audit.relative(path).startswith(".claude/rules/")
    )
    missing_entrypoints(audit)


def is_rule(relative: str) -> bool:
    return relative.endswith(".md") and any(
        relative.startswith(directory + "/") for directory in RULE_DIRS
    )


def missing_entrypoints(audit: Audit) -> None:
    present = {
        "codex": bool(audit.seeds["codex"]),
        "claude": any(
            named_entrypoint(audit.root / name)
            for name in ("CLAUDE.md", ".claude/CLAUDE.md")
        ),
    }
    for runtime in audit.runtimes:
        if not present[runtime]:
            audit.findings["missing-entrypoint"].add(f"runtime={runtime}")


def traverse(audit: Audit, extra: set[Path]) -> None:
    pending = extra.union(*(audit.seeds[runtime] for runtime in audit.runtimes))
    parsed: set[Path] = set()
    while pending:
        source = min(pending)
        pending.remove(source)
        if source in parsed:
            continue
        parsed.add(source)
        if audit.add(source):
            pending.update(parse_source(audit, source) - parsed)


def parse_source(audit: Audit, source: Path) -> set[Path]:
    pending: set[Path] = set()
    for ref in references(read_text(source)):
        result = resolve(ref, source, audit.root)
        if result.nonroot:
            audit.findings["nonroot-path"].add(
                f"{source} -> {result.requested} | expected session-root-relative path"
            )
        if result.target is not None:
            audit.files.add(result.target)
            record_route(audit, source, result.target, ref.explicit, pending)
        elif not result.external_import and (
            ref.explicit or guidance_reference(ref.value)
        ):
            audit.findings["broken-reference"].add(f"{source} -> {result.requested}")
    return pending


def record_route(
    audit: Audit, source: Path, target: Path, explicit: bool, pending: set[Path]
) -> None:
    if not explicit:
        return
    audit.add(target)
    audit.edges.add((source, target))
    if target.suffix == ".md":
        pending.add(target)


def reachable(seeds: set[Path], edges: set[tuple[Path, Path]]) -> set[Path]:
    adjacency: dict[Path, set[Path]] = defaultdict(set)
    for source, target in edges:
        adjacency[source].add(target)
    found = set(seeds)
    pending = list(seeds)
    while pending:
        for target in adjacency[pending.pop()] - found:
            found.add(target)
            pending.append(target)
    return found


def requires_route(runtime: str, relative: str) -> bool:
    if relative.startswith(".agent-shared/rules/"):
        return True
    if runtime == "claude":
        return False
    return relative.startswith((".agents/rules/", ".codex/rules/", ".pi/rules/")) or (
        "/" in relative and Path(relative).name in {"AGENTS.md", "AGENTS.override.md"}
    )


def check_reachability(audit: Audit) -> None:
    for runtime in audit.runtimes:
        for path in audit.files - reachable(audit.seeds[runtime], audit.edges):
            if requires_route(runtime, audit.relative(path)):
                audit.findings["unrouted-guidance"].add(f"runtime={runtime} | {path}")


def cycles(edges: set[tuple[Path, Path]]) -> set[str]:
    """Iterative DFS avoids a recursion limit on long instruction graphs."""
    adjacency: dict[Path, list[Path]] = defaultdict(list)
    for source, target in sorted(edges):
        adjacency[source].append(target)
    state: dict[Path, int] = {}
    found: set[str] = set()
    for node in sorted(adjacency):
        if node not in state:
            visit(node, adjacency, state, found)
    return found


def visit(
    node: Path,
    adjacency: dict[Path, list[Path]],
    state: dict[Path, int],
    found: set[str],
) -> None:
    stack = [(node, iter(adjacency.get(node, [])))]
    state[node] = 1
    while stack:
        source, children = stack[-1]
        target = next(children, None)
        if target is None:
            state[source] = 2
            stack.pop()
        elif state.get(target) == 1:
            found.add(f"{source} -> {target}")
        elif target not in state:
            state[target] = 1
            stack.append((target, iter(adjacency.get(target, []))))
