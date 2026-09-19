"""Read-only host capacity diagnosis for Adaptive Delivery."""

from __future__ import annotations

import os
import re
import subprocess
import sys
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

from .arguments import options
from .common import RefusalError

VersionProbe = Callable[[], str]

USAGE = """usage: host-config-doctor codex [--config PATH] [--backend v1|v2|unknown] [--context effective|isolated-eval]
       host-config-doctor claude [--version VERSION]
"""

TOPOLOGY = (
    "topology: primary -> owner -> verification coordinator -> review coordinator "
    "-> parallel Standards/Spec readers\n"
    "required_spawned_slots: baseline=1 full=5 (primary excluded)\n"
    "required_nesting_layers: baseline=1 full=4\n"
)


class UsageError(Exception):
    """Invalid command arguments; the process boundary prints usage."""


class DiagnosisError(Exception):
    """A safe refusal with any records emitted before the failure."""

    def __init__(self, output: str, status: str, reason: str) -> None:
        self.output = output
        self.diagnostic = f"status: {status}\nreason: {reason}\n"
        super().__init__(self.diagnostic.rstrip())


@dataclass(frozen=True)
class AgentSettings:
    enabled: bool | None
    concurrency: int | None
    depth: int | None


def _lines(*values: str) -> str:
    return "\n".join(values) + "\n"


def _parse_options(args: list[str], names: set[str]) -> dict[str, str]:
    try:
        return options(args, names, "host doctor ")
    except RefusalError as error:
        raise UsageError from error


def _default_config(environment: Mapping[str, str]) -> str:
    codex_home = environment.get("CODEX_HOME")
    if codex_home:
        return str(Path(codex_home) / "config.toml")
    home = environment.get("HOME") or environment.get("USERPROFILE")
    if home:
        return str(Path(home) / ".codex/config.toml")
    raise DiagnosisError(
        "", "unavailable", "HOME, USERPROFILE, and CODEX_HOME are unset"
    )


def _resolve_config(
    configured: str | None, environment: Mapping[str, str], cwd: Path
) -> Path:
    value = _default_config(environment) if configured is None else configured
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = cwd / candidate
    try:
        return candidate.parent.resolve(strict=True) / candidate.name
    except OSError as error:
        raise DiagnosisError(
            "", "unavailable", "configuration parent directory cannot be resolved"
        ) from error


def _codex_header(source: Path, backend: str, context: str) -> str:
    return (
        _lines(
            "format: darrow-adaptive-delivery-host-doctor-v1",
            "host: codex",
            f"configuration_source: {source}",
            f"configuration_context: {context}",
            "checkout_config_used: no",
            f"backend: {backend}",
            "concurrency_control: agents.max_concurrent_threads_per_session",
            "nesting_control: agents.max_depth (V1 only; ignored by V2)",
        )
        + TOPOLOGY
    )


def _optional_bool(values: Mapping[str, object], name: str) -> bool | None:
    if name not in values:
        return None
    value = values[name]
    if type(value) is not bool:
        raise ValueError
    return value


def _optional_int(
    values: Mapping[str, object], name: str, *, positive: bool
) -> int | None:
    if name not in values:
        return None
    value = values[name]
    if type(value) is not int or (positive and value <= 0):
        raise ValueError
    return value


def _agent_settings(document: Mapping[str, object]) -> AgentSettings:
    agents = document.get("agents", {})
    if not isinstance(agents, dict):
        raise ValueError
    return AgentSettings(
        enabled=_optional_bool(agents, "enabled"),
        concurrency=_optional_int(
            agents, "max_concurrent_threads_per_session", positive=True
        ),
        depth=_optional_int(agents, "max_depth", positive=False),
    )


def _read_settings(source: Path, header: str) -> AgentSettings:
    if not source.is_file() or not os.access(source, os.R_OK):
        raise DiagnosisError(
            header,
            "unreadable",
            "effective configuration is not a readable regular file",
        )
    try:
        document = tomllib.loads(source.read_bytes().decode("utf-8"))
        return _agent_settings(document)
    except (tomllib.TOMLDecodeError, UnicodeError, ValueError) as error:
        raise DiagnosisError(
            header,
            "malformed",
            "invalid or duplicate Adaptive Delivery agent setting",
        ) from error
    except OSError as error:
        raise DiagnosisError(
            header, "unreadable", "failed while reading effective configuration"
        ) from error


def _codex_absent(source: Path, backend: str) -> str:
    nesting = (
        "not-applicable (agents.max_depth is V1-only and ignored by V2)"
        if backend == "v2"
        else "unknown"
    )
    return _lines(
        "status: absent",
        "delegation: enabled-by-default",
        "concurrency: unknown (host default is not a configured value)",
        f"nesting: {nesting}",
        "baseline_owner_only: unknown",
        "full_required_assessment: unknown",
        f"guidance: create {source} with [agents], enabled = true, and "
        "max_concurrent_threads_per_session = 5 or greater",
    )


def _concurrency_capacity(concurrency: int | None) -> tuple[str, str]:
    if concurrency is None:
        return "unknown", "unknown"
    if concurrency >= 5:
        return "supported", "supported"
    return "supported", "unsupported"


def _v1_capacity(baseline: str, full: str, depth: int | None) -> tuple[str, str]:
    if depth is None:
        return "unknown", "unknown"
    if depth < 1:
        return "unsupported", "unsupported"
    if depth < 4:
        return baseline, "unsupported"
    return baseline, full


def _codex_capacity(settings: AgentSettings, backend: str) -> tuple[str, str]:
    baseline, full = _concurrency_capacity(settings.concurrency)
    if backend == "unknown":
        return "unknown", "unknown"
    return (
        _v1_capacity(baseline, full, settings.depth)
        if backend == "v1"
        else (baseline, full)
    )


def _codex_values(settings: AgentSettings, backend: str) -> tuple[str, str, str]:
    delegation = {
        True: "enabled",
        False: "disabled",
        None: "enabled-by-default",
    }[settings.enabled]
    concurrency = (
        "unknown (host default is not a configured value)"
        if settings.concurrency is None
        else (
            f"adequate ({settings.concurrency}; full path requires 5)"
            if settings.concurrency >= 5
            else f"inadequate ({settings.concurrency}; baseline requires 1, full path requires 5)"
        )
    )
    if backend == "v2":
        depth = "unset" if settings.depth is None else str(settings.depth)
        nesting = (
            f"not-applicable (agents.max_depth={depth} is V1-only and ignored by V2)"
        )
    elif backend == "unknown":
        nesting = "unknown (backend was not established; max_depth applies only to V1)"
    elif settings.depth is None:
        nesting = "unknown (agents.max_depth is unset)"
    elif settings.depth >= 4:
        nesting = f"adequate ({settings.depth}; full path requires 4)"
    else:
        nesting = (
            f"inadequate ({settings.depth}; baseline requires 1, full path requires 4)"
        )
    return delegation, concurrency, nesting


def _codex_result(source: Path, settings: AgentSettings, backend: str) -> str:
    delegation, concurrency, nesting = _codex_values(settings, backend)
    if settings.enabled is False:
        baseline, full = "unsupported", "unsupported"
        actions = ["agents.enabled = true"]
        if settings.concurrency is not None and settings.concurrency < 5:
            actions.append("agents.max_concurrent_threads_per_session = 5 or greater")
        if backend == "v1" and settings.depth is not None and settings.depth < 4:
            actions.append("agents.max_depth = 4 or greater")
        guidance = f"set {', '.join(actions)} in {source}"
    else:
        baseline, full = _codex_capacity(settings, backend)
        guidance = (
            "no Adaptive Delivery capacity change is required"
            if full == "supported"
            else "set agents.max_concurrent_threads_per_session = 5 or greater in "
            f"{source}; for V1 also set agents.max_depth = 4 or greater"
        )
    return _lines(
        "status: valid",
        f"delegation: {delegation}",
        f"concurrency: {concurrency}",
        f"nesting: {nesting}",
        f"baseline_owner_only: {baseline}",
        f"full_required_assessment: {full}",
        f"guidance: {guidance}",
    )


def _codex(args: list[str], environment: Mapping[str, str], cwd: Path) -> str:
    values = _parse_options(args, {"--config", "--backend", "--context"})
    backend = values.get("backend", "unknown")
    context = values.get("context", "effective")
    if backend not in {"v1", "v2", "unknown"}:
        raise UsageError
    if context not in {"effective", "isolated-eval"}:
        raise UsageError
    source = _resolve_config(values.get("config"), environment, cwd)
    header = _codex_header(source, backend, context)
    if not source.exists():
        return header + _codex_absent(source, backend)
    return header + _codex_result(source, _read_settings(source, header), backend)


def _default_version_probe() -> str:
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError:
        return ""
    return result.stdout


def _version(value: str | None, probe: VersionProbe) -> str:
    if value is None:
        try:
            match = re.search(r"[0-9]+\.[0-9]+\.[0-9]+", probe())
        except OSError:
            return "unknown"
        return match.group(0) if match else "unknown"
    return value if re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", value) else "unknown"


def _at_least(version: str, required: tuple[int, int, int]) -> bool:
    parts = tuple(int(value) for value in version.split(".")[:3])
    return parts + (0,) * (3 - len(parts)) >= required


def _claude_header(version: str) -> str:
    return (
        _lines(
            "format: darrow-adaptive-delivery-host-doctor-v1",
            "host: claude",
            "configuration_source: process-environment",
            f"host_version: {version}",
            "concurrency_control: CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
            "nesting_control: CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH",
        )
        + TOPOLOGY
    )


def _positive_control(value: str | None, name: str, header: str) -> int | None:
    if not value:
        return None
    if not re.fullmatch(r"[1-9][0-9]*", value):
        raise DiagnosisError(
            header, "malformed", f"{name} must be a positive whole number"
        )
    return int(value)


def _claude_unknown() -> str:
    return _lines(
        "status: version-unknown",
        "concurrency_control_applicability: unknown (installed version not established)",
        "nesting_control_applicability: unknown (installed version not established)",
        "concurrency: unknown (installed version applicability was not established)",
        "nesting: unknown (installed version applicability was not established)",
        "baseline_owner_only: unknown",
        "full_required_assessment: unknown",
        "guidance: provide the installed Claude Code version before changing either control",
    )


def _claude_controls(
    version: str, environment: Mapping[str, str], header: str
) -> tuple[list[str], str, str]:
    if not _at_least(version, (2, 1, 217)):
        return (
            [
                "concurrency_control_applicability: unsupported (requires Claude Code 2.1.217 or later)",
                "nesting_control_applicability: fixed host behavior (environment control requires Claude Code 2.1.217 or later)",
                "concurrency: not-applicable (control requires Claude Code 2.1.217 or later)",
            ],
            "unknown",
            "unknown",
        )
    concurrency = _positive_control(
        environment.get("CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS"),
        "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
        header,
    )
    depth = _positive_control(
        environment.get("CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH"),
        "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH",
        header,
    )
    effective = 20 if concurrency is None else concurrency
    concurrency_state = "yes" if effective >= 5 else "no"
    adjective = "adequate" if concurrency_state == "yes" else "inadequate"
    return (
        [
            "concurrency_control_applicability: supported (Claude Code 2.1.217 or later)",
            "nesting_control_applicability: supported (Claude Code 2.1.217 or later)",
            f"concurrency: {adjective} ({effective}; "
            + (
                "full path requires 5)"
                if effective >= 5
                else "baseline requires 1, full path requires 5)"
            ),
        ],
        concurrency_state,
        "" if depth is None else str(depth),
    )


def _claude_nesting(version: str, depth: str) -> tuple[str, str]:
    if _at_least(version, (2, 1, 219)):
        effective = 3 if not depth else int(depth)
    elif _at_least(version, (2, 1, 217)):
        effective = 1 if not depth else int(depth)
    elif _at_least(version, (2, 1, 172)):
        return "adequate (host default 5; control not supported by this version)", "yes"
    else:
        return "unknown (version predates documented nesting behavior)", "unknown"
    state = "yes" if effective >= 4 else "no"
    adjective = "adequate" if state == "yes" else "inadequate"
    requirement = (
        "full path requires 4"
        if state == "yes"
        else "baseline requires 1, full path requires 4"
    )
    return f"{adjective} ({effective}; {requirement})", state


def _claude_result(version: str, environment: Mapping[str, str], header: str) -> str:
    controls, concurrency, depth = _claude_controls(version, environment, header)
    nesting, nesting_state = _claude_nesting(version, depth)
    baseline = "unknown" if concurrency == "unknown" else "supported"
    if concurrency == "yes" and nesting_state == "yes":
        full = "supported"
    elif "no" in {concurrency, nesting_state}:
        full = "unsupported"
    else:
        full = "unknown"
    if full == "supported":
        guidance = "no Adaptive Delivery capacity change is required"
    elif _at_least(version, (2, 1, 217)):
        guidance = (
            "set CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=5 and "
            "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4 in the effective Claude Code "
            "environment, then start a new session"
        )
    else:
        guidance = (
            "upgrade Claude Code to a version with documented concurrency control "
            "before relying on the full path"
        )
    return _lines(
        *controls,
        f"nesting: {nesting}",
        "status: valid",
        f"baseline_owner_only: {baseline}",
        f"full_required_assessment: {full}",
        f"guidance: {guidance}",
    )


def _claude(
    args: list[str], environment: Mapping[str, str], probe: VersionProbe
) -> str:
    values = _parse_options(args, {"--version"})
    version = _version(values.get("version"), probe)
    header = _claude_header(version)
    if version == "unknown":
        return header + _claude_unknown()
    return header + _claude_result(version, environment, header)


def run(
    args: list[str],
    *,
    environment: Mapping[str, str] | None = None,
    cwd: Path | None = None,
    version_probe: VersionProbe | None = None,
) -> str:
    """Return one diagnosis or raise a safe usage/diagnosis refusal."""
    if not args:
        raise UsageError
    values = os.environ if environment is None else environment
    host, host_args = args[0], args[1:]
    if host == "codex":
        return _codex(host_args, values, Path.cwd() if cwd is None else cwd)
    if host == "claude":
        return _claude(host_args, values, version_probe or _default_version_probe)
    raise UsageError
