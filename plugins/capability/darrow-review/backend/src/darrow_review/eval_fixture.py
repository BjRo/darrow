"""Construct authored repair-fixture evidence in the actor's private state."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import result, scope
from .cli import boundary
from .common import document, git, read_text, require, root_directory, serialize
from .records import validate_result
from .verification import validate_verification


def write(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(serialize(value), encoding="utf-8", newline="\n")


def target(repo: Path, revision: str) -> str:
    return (
        git(repo, "rev-parse", revision, message="fixture revision unavailable")
        .decode()
        .strip()
    )


def prepare(repo: Path, revision: str) -> Path:
    prepared = document(
        scope.prepare(
            scope.ScopeOptions(
                repo=str(repo),
                base=target(repo, revision + "^"),
                target=revision,
            )
        )
    )
    require(prepared["target"] == revision, "fixture scope target mismatch")
    return Path(str(prepared["manifest"]))


def authored(text: str, replacements: dict[str, str]) -> dict[str, object]:
    for name, value in replacements.items():
        text = text.replace("{{" + name + "}}", json.dumps(value)[1:-1])
    return document(text)


def first(repo: Path, value: dict[str, object], manifest: Path) -> None:
    template = repo / ".git/fixture-name-trim-template.json"
    if not template.exists():
        return
    record = authored(read_text(template), {"repo": str(repo)})
    record.update(result.scope_records(str(manifest)))
    original = manifest.parent / "result.json"
    write(original, record)
    findings = result.original_findings(validate_result(read_text(original)))
    require(
        value["original_findings"] == findings, "fixture original findings mismatch"
    )
    value["original_result"] = str(original)


def previous(repo: Path, record: dict[str, object], manifest: Path) -> dict[str, str]:
    path = manifest.parent / "verification.json"
    validate_verification(serialize(record))
    write(path, record)
    checksum = (
        git(
            repo,
            "hash-object",
            "--no-filters",
            str(path),
            message="fixture checksum unavailable",
        )
        .decode()
        .strip()
    )
    return {"path": str(path), "checksum": checksum}


def initialize(repo: Path, mode: str) -> str:
    value = document(read_text(repo / ".git/verification-input"))
    revision = (
        str(value["original_target"]) if mode == "first" else target(repo, "HEAD")
    )
    require(value["prior_target"] == revision, "fixture prior target mismatch")
    if mode == "first":
        require(
            value["previous_verification"] == {"checksum": "none", "path": "none"},
            "first fixture cannot have previous verification",
        )
    manifest = prepare(repo, revision)
    value["prior_manifest"] = str(manifest)
    if mode == "first":
        first(repo, value, manifest)
    else:
        record = document(serialize_document(value["previous_record"]))
        require(
            record["current_target"] == revision, "fixture previous target mismatch"
        )
        value["previous_verification"] = previous(repo, record, manifest)
    output = repo / ".fixture-state/verification-input"
    write(output, value)
    return str(output) + "\n"


def serialize_document(value: object) -> str:
    require(isinstance(value, dict), "fixture previous record must be an object")
    return json.dumps(value)


def seed_second(repo: Path, template: Path) -> str:
    revision = target(repo, "HEAD")
    manifest = prepare(repo, revision)
    record = authored(
        read_text(template), {"repo": str(repo), "prior_target": revision}
    )
    validated = validate_verification(serialize(record))
    findings = validated.items("original_findings")
    regressions = validated.items("regressions")
    require(
        len(findings) == len(regressions) == 1,
        "second fixture requires one causal chain",
    )
    value: dict[str, object] = {
        "original_target": validated.value("original_target"),
        "prior_target": revision,
        "prior_manifest": str(manifest),
        "previous_verification": previous(repo, record, manifest),
        "original_key": findings[0]["key"],
        "regression_key": regressions[0]["key"],
        "previous_record": record,
    }
    output = repo / ".git/verification-input"
    write(output, value)
    return str(output) + "\n"


def command(args: list[str]) -> str:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("first", "second", "seed-second"))
    parser.add_argument("--repo", default=".")
    parser.add_argument("--template", type=Path)
    parsed = parser.parse_args(args)
    repo = root_directory(parsed.repo)
    if parsed.mode == "seed-second":
        require(
            parsed.template is not None, "seed-second requires an authored template"
        )
        return seed_second(repo, parsed.template)
    return initialize(repo, parsed.mode)


if __name__ == "__main__":
    boundary("review-eval-fixture", command)
