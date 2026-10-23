"""Eval completion gate delegating canonical artifact validation to its provider."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import cast

from ..common import RefusalError
from .state import metadata


class InvalidProofError(Exception):
    """Fixture completion is refused with exit 1."""


def field(path: Path, name: str) -> str:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, RecursionError) as exc:
        raise InvalidProofError(f"invalid review JSON: {path}") from exc
    value = record.get(name) if isinstance(record, dict) else None
    if not isinstance(value, str):
        raise InvalidProofError(f"invalid review JSON field {name}: {path}")
    return value


def unique_json(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for name, item in pairs:
        if name in value:
            raise InvalidProofError(f"duplicate provider JSON field: {name}")
        value[name] = item
    return value


def provider_json(path: Path) -> dict[str, object]:
    try:
        value: object = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=unique_json
        )
    except (OSError, UnicodeError, ValueError, RecursionError) as error:
        raise InvalidProofError(f"unreadable provider metadata: {path}") from error
    if not isinstance(value, dict):
        raise InvalidProofError(f"invalid provider metadata: {path}")
    return cast(dict[str, object], value)


def review_source(root: Path) -> str:
    plugins = provider_json(root / ".claude-plugin/marketplace.json").get("plugins")
    if not isinstance(plugins, list):
        raise InvalidProofError("invalid provider catalog plugins")
    if any(not isinstance(plugin, dict) for plugin in plugins):
        raise InvalidProofError("invalid provider catalog entry")
    matching = [plugin for plugin in plugins if plugin.get("name") == "darrow-review"]
    if len(matching) != 1:
        raise InvalidProofError("exactly one declared review provider is required")
    source = matching[0].get("source")
    if not isinstance(source, str):
        raise InvalidProofError("review provider requires a local source")
    return source


def provider_package(root: Path, source: str) -> Path:
    if not source.startswith("./") or "\\" in source:
        raise InvalidProofError("unsafe review provider source")
    selected = root / source
    if not selected.resolve().is_relative_to(root.resolve()):
        raise InvalidProofError("escaping review provider source")
    if any((root / part).is_symlink() for part in selected.relative_to(root).parents):
        raise InvalidProofError("linked review provider source")
    if selected.is_symlink():
        raise InvalidProofError("linked review provider source")
    return selected


def provider_identity(package: Path) -> None:
    manifests = [
        provider_json(package / folder / "plugin.json")
        for folder in (".claude-plugin", ".codex-plugin")
    ]
    if any(manifest.get("name") != "darrow-review" for manifest in manifests):
        raise InvalidProofError("review provider plugin identity differs")
    version = manifests[0].get("version")
    if (
        not isinstance(version, str)
        or not version
        or manifests[1].get("version") != version
    ):
        raise InvalidProofError("review provider plugin versions differ")


def provider(repo: Path) -> Path:
    root = repo / ".sevro-marketplace"
    package = provider_package(root, review_source(root))
    provider_identity(package)
    backend = package / "backend"
    if not (backend / "src/darrow_review/result.py").is_file():
        raise InvalidProofError("installed review-result tool is missing")
    return backend


def invoke(
    backend: Path, repo: Path, *args: str, state_root: Path | None = None
) -> str:
    environment = (
        None
        if state_root is None
        else {**os.environ, "DARROW_REVIEW_STATE_DIR": str(state_root)}
    )
    result = subprocess.run(
        [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str((backend / "scripts/run_locked.py").resolve()),
            *args,
        ],
        cwd=repo,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode:
        raise InvalidProofError(result.stderr.strip() or result.stdout.strip())
    return result.stdout


def review_state_root() -> Path:
    root = Path(os.environ.get("DARROW_REVIEW_STATE_DIR", ""))
    if not root.is_absolute():
        raise InvalidProofError("fixture requires an absolute DARROW_REVIEW_STATE_DIR")
    return root.resolve()


def canonical_record(state: Path, selected: str) -> Path:
    path = Path(selected).resolve()
    if not path.is_file():
        raise InvalidProofError(f"unreadable artifact: {selected}")
    if not path.is_relative_to(state) or not path.parent.name.startswith(
        "darrow-review."
    ):
        raise InvalidProofError(f"not a canonical fixture review artifact: {path}")
    if path.name not in {
        "result.json",
        "verification.json",
        "review.md",
        "verification.md",
    }:
        raise InvalidProofError(f"not a canonical fixture review artifact: {path}")
    return path


def machine_record(backend: Path, repo: Path, path: Path) -> Path:
    if path.suffix != ".md":
        return path
    if not (backend / "src/darrow_review/report.py").is_file():
        raise InvalidProofError("installed review renderer is missing")
    name, render = (
        ("result.json", "render")
        if path.name == "review.md"
        else ("verification.json", "render-verification")
    )
    record = path.with_name(name)
    rendered = invoke(backend, repo, "review-report", render, str(record))
    if rendered.encode() != path.read_bytes():
        raise InvalidProofError("human report differs from its canonical result")
    return record


def original_matches(
    backend: Path, repo: Path, original: Path, verification: Path
) -> bool:
    try:
        invoke(
            backend,
            repo,
            "review-result",
            "validate-original",
            str(original),
            str(verification),
        )
    except InvalidProofError:
        return False
    return True


def original_record(backend: Path, repo: Path, state: Path, verification: Path) -> Path:
    target = field(verification, "original_target")
    for path in state.rglob("result.json"):
        if (
            not path.parent.name.startswith("darrow-review.")
            or field(path, "target") != target
        ):
            continue
        if original_matches(backend, repo, path, verification):
            return path
    raise InvalidProofError("matching original comprehensive result is missing")


def reviewed_target(backend: Path, repo: Path, state: Path, path: Path) -> str:
    format_name = field(path, "format")
    if format_name == "darrow-review-result-v3":
        return comprehensive_target(backend, repo, path)
    if format_name == "darrow-review-verification-v3":
        return verification_target(backend, repo, state, path)
    raise InvalidProofError(f"unsupported format: {format_name}")


def comprehensive_target(backend: Path, repo: Path, path: Path) -> str:
    if path.name != "result.json":
        raise InvalidProofError("wrong comprehensive artifact name")
    invoke(backend, repo, "review-result", "validate", str(path))
    if field(path, "verdict") != "pass":
        raise InvalidProofError("review is not clear")
    return field(path, "target")


def verification_target(backend: Path, repo: Path, state: Path, path: Path) -> str:
    if path.name != "verification.json":
        raise InvalidProofError("wrong verification artifact name")
    invoke(backend, repo, "review-result", "validate-verification", str(path))
    if field(path, "outcome") != "clear":
        raise InvalidProofError("verification is not clear")
    original_record(backend, repo, state, path)
    return field(path, "current_target")


def current(backend: Path, repo: Path, target: str) -> None:
    if not (backend / "src/darrow_review/scope.py").is_file():
        raise InvalidProofError("installed review-scope tool is missing")
    with TemporaryDirectory(prefix="darrow-fixture-current-") as scratch:
        scope = invoke(
            backend,
            repo,
            "review-scope",
            "prepare",
            "--repo",
            str(repo),
            "--base",
            "HEAD",
            "--target",
            "WORKTREE",
            state_root=Path(scratch),
        )
    try:
        value = json.loads(scope)
        actual = value["target"]
        if not isinstance(actual, str):
            raise TypeError("target must be a string")
    except (ValueError, KeyError, TypeError) as exc:
        raise InvalidProofError("invalid review scope JSON") from exc
    if not target or target != actual:
        raise InvalidProofError(f"stale review target: {target}; current: {actual}")


def validate(repo: Path, mode: str, selected: str = "") -> str:
    if mode not in {"complete", "artifact", "current"}:
        raise InvalidProofError("expected complete ARTIFACT, artifact, or current")
    try:
        return validate_selected(repo, mode, selected)
    except (OSError, UnicodeError, RefusalError) as error:
        raise InvalidProofError(str(error)) from error


def validate_selected(repo: Path, mode: str, selected: str) -> str:
    metadata(repo)
    proof = repo / ".fixture-state/high-risk-review-proof"
    if mode != "complete":
        selected = proof.read_text(encoding="utf-8").strip()
    state = review_state_root()
    if state.is_relative_to(repo.resolve()):
        raise InvalidProofError("review state must be outside the repository")
    path = canonical_record(state, selected)
    backend = provider(repo)
    path = machine_record(backend, repo, path)
    target = reviewed_target(backend, repo, state, path)
    if mode != "artifact":
        current(backend, repo, target)
    if mode == "complete":
        proof.parent.mkdir(exist_ok=True)
        proof.write_text(str(path) + "\n", encoding="utf-8", newline="\n")
        (repo / ".fixture-state/high-risk-review-state-root").write_text(
            str(state) + "\n", encoding="utf-8", newline="\n"
        )
        (repo / ".fixture-state/goal-complete").write_text(
            "complete\n", encoding="utf-8", newline="\n"
        )
    return f"valid clear review: {path}\n"
