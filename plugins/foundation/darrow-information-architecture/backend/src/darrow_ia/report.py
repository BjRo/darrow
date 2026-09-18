"""Stable human-readable inventory and diagnostic records."""

from pathlib import Path

from darrow_ia.filesystem import ROOT_NAMES, readable
from darrow_ia.graph import Audit

COUNTS = {
    "broken": "broken-reference",
    "nonroot_paths": "nonroot-path",
    "cycles": "instruction-cycle",
    "unrouted": "unrouted-guidance",
    "missing_runtime": "missing-entrypoint",
    "duplicate_files": "duplicate-content",
    "unreadable": "unreadable-guidance",
    "adapter_drift": "adapter-drift",
}
FINDINGS = (
    "missing-entrypoint",
    "broken-reference",
    "nonroot-path",
    "instruction-cycle",
    "unrouted-guidance",
    "unreadable-guidance",
    "root-budget",
    "adapter-drift",
    "always-loaded-rule",
    "duplicate-content",
)
ADVISORY = {"always-loaded-rule", "duplicate-content"}


def scope(relative: str) -> str:
    if relative in ROOT_NAMES:
        return "root"
    if Path(relative).name in {
        "AGENTS.md",
        "AGENTS.override.md",
        "CLAUDE.md",
        "CLAUDE.local.md",
    }:
        return "nested"
    if relative.startswith(".claude/rules/"):
        return "claude-native-rule"
    return "adapter-rule" if "/rules/" in relative else "referenced"


def file_record(path: Path, audit: Audit) -> str:
    if not readable(path):
        return f"{path} | unreadable"
    size = path.stat().st_size
    return f"{path} | scope={scope(audit.relative(path))} | bytes={size} | approx_tokens={(size + 3) // 4}"


def summary(audit: Audit) -> str:
    values: dict[str, str | int] = {
        "runtime": audit.runtime,
        "entrypoints": len(audit.entrypoints),
        "files": len(audit.files),
        "routes": len(audit.edges),
    }
    values.update({name: len(audit.findings[key]) for name, key in COUNTS.items()})
    for runtime, size in audit.root_bytes.items():
        values[f"{runtime}_root_bytes"] = size
        values[f"{runtime}_root_approx_tokens"] = (size + 3) // 4
    return "summary: " + " ".join(f"{key}={value}" for key, value in values.items())


def limited(records: list[str], limit: int, noun: str, prefix: str = "") -> list[str]:
    result = [f"  - {prefix}{record}" for record in records[:limit]]
    if len(records) > limit:
        result.append(
            f"  - {prefix}... {len(records) - limit} additional {noun} omitted"
        )
    return result


def render(audit: Audit) -> str:
    lines = [f"root: {audit.root}", summary(audit), "entrypoints:"]
    lines.extend(
        limited(
            [file_record(path, audit) for path in audit.entrypoints], 40, "entrypoints"
        )
    )
    lines.append("adapter_mirrors:")
    lines.extend(f"  - {record}" for record in audit.mirrors or ["none detected"])
    lines.append("findings:")
    lines.extend(render_findings(audit))
    lines.append("routes:")
    routes = [f"{source} -> {target}" for source, target in sorted(audit.edges)]
    lines.extend(limited(routes or ["none"], 120, "routes"))
    return "\n".join(lines) + "\n"


def render_findings(audit: Audit) -> list[str]:
    lines: list[str] = []
    for name in FINDINGS:
        severity = "advisory" if name in ADVISORY else "critical"
        records = sorted(audit.findings[name])
        limit = (
            len(records)
            if name in {"missing-entrypoint", "instruction-cycle", "root-budget"}
            else 40
        )
        lines.extend(limited(records, limit, "findings", f"{severity} {name} | "))
    return lines or ["  - none"]


def failed(audit: Audit) -> bool:
    return any(
        records for name, records in audit.findings.items() if name not in ADVISORY
    )
