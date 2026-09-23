"""Eval completion gate delegating canonical artifact validation to its provider."""

from __future__ import annotations

import subprocess
from pathlib import Path

from ..common import RefusalError
from .state import metadata


class InvalidProofError(Exception):
    """Fixture completion is refused with exit 1."""


def field(path: Path, name: str) -> str:
    return "\n".join(
        row.split("\t")[1]
        for row in path.read_text(encoding="utf-8").splitlines()
        if row.startswith(name + "\t")
    )


def provider(git_dir: Path) -> Path:
    candidates = sorted(git_dir.rglob("backend/src/darrow_review/result.py"))
    if not candidates:
        raise InvalidProofError("installed review-result tool is missing")
    first = candidates[0]
    for candidate in candidates[1:]:
        for name in ("result.py", "scope.py"):
            if (first.parent / name).read_bytes() != (
                candidate.parent / name
            ).read_bytes():
                raise InvalidProofError("conflicting fixture review-tool copies")
    return first.parents[2]


def invoke(backend: Path, repo: Path, *args: str) -> str:
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
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode:
        raise InvalidProofError(result.stderr.strip() or result.stdout.strip())
    return result.stdout


def canonical_record(git_dir: Path, selected: str) -> Path:
    path = Path(selected).resolve()
    if not path.is_file():
        raise InvalidProofError(f"unreadable artifact: {selected}")
    if not path.is_relative_to(git_dir) or not path.parent.name.startswith(
        "darrow-review."
    ):
        raise InvalidProofError(f"not a canonical fixture review artifact: {path}")
    if path.name not in {
        "result.tsv",
        "verification.tsv",
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
        ("result.tsv", "render")
        if path.name == "review.md"
        else ("verification.tsv", "render-verification")
    )
    record = path.with_name(name)
    rendered = invoke(backend, repo, "review-report", render, str(record))
    if rendered.encode() != path.read_bytes():
        raise InvalidProofError("human report differs from its canonical result")
    return record


def original_record(git_dir: Path, target: str) -> Path:
    matches = [
        path
        for path in git_dir.rglob("result.tsv")
        if path.parent.name.startswith("darrow-review.")
        and field(path, "target") == target
    ]
    if len(matches) != 1:
        reason = "ambiguous" if matches else "missing"
        raise InvalidProofError(f"original comprehensive result is {reason}")
    return matches[0]


def reviewed_target(backend: Path, repo: Path, git_dir: Path, path: Path) -> str:
    format_name = field(path, "format")
    if format_name == "darrow-review-result-v1":
        return comprehensive_target(backend, repo, path)
    if format_name == "darrow-review-verification-v1":
        return verification_target(backend, repo, git_dir, path)
    raise InvalidProofError(f"unsupported format: {format_name}")


def comprehensive_target(backend: Path, repo: Path, path: Path) -> str:
    if path.name != "result.tsv":
        raise InvalidProofError("wrong comprehensive artifact name")
    invoke(backend, repo, "review-result", "validate", str(path))
    if field(path, "verdict") != "pass":
        raise InvalidProofError("review is not clear")
    if field(path, "next_action") != "return control to enclosing goal":
        raise InvalidProofError("review did not return control")
    return field(path, "target")


def verification_target(backend: Path, repo: Path, git_dir: Path, path: Path) -> str:
    if path.name != "verification.tsv":
        raise InvalidProofError("wrong verification artifact name")
    invoke(backend, repo, "review-result", "validate-verification", str(path))
    if field(path, "outcome") != "clear":
        raise InvalidProofError("verification is not clear")
    original = original_record(git_dir, field(path, "original_target"))
    invoke(
        backend, repo, "review-result", "validate-original", str(original), str(path)
    )
    return field(path, "current_target")


def current(backend: Path, repo: Path, target: str) -> None:
    if not (backend / "src/darrow_review/scope.py").is_file():
        raise InvalidProofError("installed review-scope tool is missing")
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
    )
    actual = "\n".join(
        row.split("\t")[1] for row in scope.splitlines() if row.startswith("target\t")
    )
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
    git_dir = metadata(repo)
    proof = git_dir / "fixture-state/high-risk-review-proof"
    if mode != "complete":
        selected = proof.read_text(encoding="utf-8").strip()
    path = canonical_record(git_dir, selected)
    backend = provider(git_dir)
    path = machine_record(backend, repo, path)
    target = reviewed_target(backend, repo, git_dir, path)
    if mode != "artifact":
        current(backend, repo, target)
    if mode == "complete":
        proof.parent.mkdir(exist_ok=True)
        proof.write_text(str(path) + "\n", encoding="utf-8", newline="\n")
        (git_dir / "goal-complete").write_text(
            "complete\n", encoding="utf-8", newline="\n"
        )
    return f"valid clear review: {path}\n"
