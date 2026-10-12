"""Authorize historical readers only through validated prior assessment records."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from native_codex_routes import decode


def operation(command: str, *paths: Path) -> str:
    backend = Path(__file__).resolve().parents[2]
    return subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--frozen",
            "--no-dev",
            "--project",
            str(backend),
            "review-result",
            command,
            *(str(path) for path in paths),
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def prior_scope(directory: Path) -> tuple[Path, dict[str, Any]] | None:
    path = directory / "scope.json"
    if not path.exists():
        return None
    current = decode(path.read_text())
    if not current.get("prior_manifest"):
        return None
    verification = directory / "verification.json"
    operation("validate-verification", verification)
    record = decode(verification.read_text())
    prior = Path(current["prior_manifest"])
    assert prior.is_absolute()
    operation("scope-records", path)
    operation("scope-records", prior)
    old = decode(prior.read_text())
    assert old["repository"] == current["repository"] and old["base"] == current["base"]
    assert (
        old["target"] == record["prior_target"]
        and current["target"] == record["current_target"]
    )
    return prior.parent, record


def finalized(directory: Path, current: dict[str, Any]) -> dict[str, Any] | None:
    paths = [
        directory / name
        for name in ("result.json", "verification.json")
        if (directory / name).exists()
    ]
    if not paths:
        return None
    assert len(paths) == 1, "ambiguous prior finalized assessment"
    path = paths[0]
    command = "validate" if path.name == "result.json" else "validate-verification"
    operation(command, path)
    record = decode(path.read_text())
    if command == "validate":
        operation("validate-scope", directory / "scope.json", path)
        originals = decode(operation("original-findings", path))["original_findings"]
        assert record["target"] == current["original_target"] == current["prior_target"]
    else:
        originals = record["original_findings"]
        assert record["current_target"] == current["prior_target"]
        assert (
            Path(current["previous_verification"]["path"]).resolve() == path.resolve()
        )
    assert originals == current["original_findings"], (
        "changed original assessment findings"
    )
    return record


def bindings(
    directory: Path, assessment: dict[str, Any]
) -> tuple[dict[str, str], list[str]]:
    selected = decode((directory / "reviewer-route.json").read_text())["selected_route"]
    expected = [selected[name] for name in ("host", "provider", "model", "effort")]
    assert expected[:2] == ["codex", "openai"]
    agents = {}
    for axis in ("standards", "spec"):
        path = directory / f"{axis}-route.json"
        if path.exists():
            record = decode(path.read_text())
            assert record["axis"] == axis and record["route_bound"] == "true"
            assert record["requested_route"] == selected
            agent = record["agent_id"]
            assert isinstance(agent, str) and agent
            agents[axis] = agent
    assert agents and len(set(agents.values())) == len(agents)
    if assessment["format"] == "darrow-review-result-v3":
        applicable = {
            axis
            for axis in ("standards", "spec")
            if assessment[axis] != "not_available"
        }
        assert set(agents) == applicable, "prior route axes do not match the assessment"
    return agents, expected


def prior_bindings(directory: Path) -> list[tuple[dict[str, str], list[str]]]:
    history = []
    seen: set[Path] = set()
    while prior := prior_scope(directory):
        directory, current = prior
        assert directory not in seen, "cyclic prior assessment history"
        seen.add(directory)
        assessment = finalized(directory, current)
        if assessment is None or not (directory / "reviewer-route.json").exists():
            break
        history.append(bindings(directory, assessment))
    return history
