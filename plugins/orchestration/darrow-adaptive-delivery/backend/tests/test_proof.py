from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from darrow_adaptive_delivery.fixtures import proof


def write(path: Path, text: str = "provider fixture\n") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return path


def provider(repo: Path, name: str = "review-plugin") -> Path:
    backend = repo / ".git" / name / "backend"
    for filename in ("result.py", "scope.py", "report.py"):
        write(backend / "src/darrow_review" / filename)
    return backend


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, ...]]:
    result: list[tuple[str, ...]] = []

    def invoke(_backend: Path, _repo: Path, *args: str) -> str:
        result.append(args)
        if args[0] == "review-report":
            return "Canonical human report\n"
        return json.dumps({"target": "WORKTREE@current"})

    monkeypatch.setattr(proof, "invoke", invoke)
    return result


def comprehensive(repo: Path) -> Path:
    return write(
        repo / ".git/darrow-review.original/result.json",
        json.dumps(
            {
                "format": "darrow-review-result-v3",
                "verdict": "pass",
                "next_action": "return control to enclosing goal",
                "target": "WORKTREE@current",
            }
        ),
    )


def verification(repo: Path) -> Path:
    return write(
        repo / ".git/darrow-review.repair/verification.json",
        json.dumps(
            {
                "format": "darrow-review-verification-v3",
                "outcome": "clear",
                "original_target": "WORKTREE@current",
                "current_target": "WORKTREE@current",
            }
        ),
    )


def test_clear_proof_delegates_and_binds_current_candidate(
    repo: Path, calls: list[tuple[str, ...]]
) -> None:
    provider(repo)
    record = comprehensive(repo)
    assert (
        proof.validate(repo, "complete", str(record))
        == f"valid clear review: {record}\n"
    )
    assert (repo / ".git/goal-complete").read_text() == "complete\n"
    assert calls[0] == ("review-result", "validate", str(record))
    assert calls[1] == (
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        "HEAD",
        "--target",
        "WORKTREE",
    )
    assert proof.validate(repo, "artifact").startswith("valid clear review")
    assert proof.validate(repo, "current").startswith("valid clear review")
    repaired = verification(repo)
    assert proof.validate(repo, "complete", str(repaired)).startswith(
        "valid clear review"
    )
    assert ("review-result", "validate-original", str(record), str(repaired)) in calls


@pytest.mark.parametrize("followup", [False, True])
def test_human_reports_are_canonical(
    repo: Path, calls: list[tuple[str, ...]], followup: bool
) -> None:
    backend = provider(repo)
    original = comprehensive(repo)
    record = verification(repo) if followup else original
    report = write(
        record.with_name("verification.md" if followup else "review.md"),
        "Canonical human report\n",
    )
    assert proof.validate(repo, "complete", str(report)).endswith(str(record) + "\n")
    report.write_text("Forged human report\n")
    with pytest.raises(proof.InvalidProofError, match="differs"):
        proof.validate(repo, "complete", str(report))
    (backend / "src/darrow_review/report.py").unlink()
    with pytest.raises(proof.InvalidProofError, match="renderer is missing"):
        proof.validate(repo, "complete", str(report))


def test_provider_discovery_and_conflicts(repo: Path) -> None:
    with pytest.raises(proof.InvalidProofError, match="tool is missing"):
        proof.provider(repo / ".git")
    first = provider(repo, "a")
    second = provider(repo, "b")
    assert proof.provider(repo / ".git") == first
    write(second / "src/darrow_review/scope.py", "different\n")
    with pytest.raises(proof.InvalidProofError, match="conflicting"):
        proof.provider(repo / ".git")


@pytest.mark.parametrize(
    "relative,error",
    [
        ("missing", "unreadable"),
        ("outside.json", "not a canonical"),
        (".git/darrow-review.test/other.json", "not a canonical"),
    ],
)
def test_proof_path_refusals(repo: Path, relative: str, error: str) -> None:
    path = repo / relative
    if relative != "missing":
        write(path)
    with pytest.raises(proof.InvalidProofError, match=error):
        proof.validate(repo, "complete", str(path))
    assert not (repo / ".git/goal-complete").exists()


def test_bad_modes_and_missing_saved_evidence(repo: Path) -> None:
    with pytest.raises(proof.InvalidProofError, match="expected complete"):
        proof.validate(repo, "bad")
    with pytest.raises(proof.InvalidProofError):
        proof.validate(repo, "current")


@pytest.mark.parametrize(
    "replacement,error",
    [
        (('"verdict": "pass"', '"verdict": "fail"'), "not clear"),
        (
            (
                '"next_action": "return control to enclosing goal"',
                '"next_action": "continue"',
            ),
            "did not return",
        ),
        (('"target": "WORKTREE@current"', '"target": "WORKTREE@old"'), "stale review"),
        (
            ('"format": "darrow-review-result-v3"', '"format": "unknown"'),
            "unsupported format",
        ),
    ],
)
def test_comprehensive_refusals(
    repo: Path, calls: list[tuple[str, ...]], replacement: tuple[str, str], error: str
) -> None:
    provider(repo)
    path = comprehensive(repo)
    path.write_text(path.read_text().replace(*replacement))
    with pytest.raises(proof.InvalidProofError, match=error):
        proof.validate(repo, "complete", str(path))
    assert not (repo / ".git/goal-complete").exists()


def test_proof_rejects_legacy_array_record(repo: Path) -> None:
    provider(repo)
    record = comprehensive(repo)
    record.write_text(
        json.dumps(
            [
                ["format", "darrow-review-result-v2"],
                ["target", "WORKTREE@current"],
                ["verdict", "pass"],
            ]
        ),
        encoding="utf-8",
    )
    with pytest.raises(
        proof.InvalidProofError, match="invalid review JSON field format"
    ):
        proof.validate(repo, "complete", str(record))


def test_artifact_names(repo: Path, calls: list[tuple[str, ...]]) -> None:
    backend = provider(repo)
    original = comprehensive(repo)
    wrong = original.with_name("verification.json")
    original.rename(wrong)
    with pytest.raises(proof.InvalidProofError, match="wrong comprehensive"):
        proof.validate(repo, "complete", str(wrong))
    repaired = verification(repo)
    wrong = repaired.with_name("result.json")
    repaired.rename(wrong)
    with pytest.raises(proof.InvalidProofError, match="wrong verification"):
        proof.validate(repo, "complete", str(wrong))
    (backend / "src/darrow_review/scope.py").unlink()
    with pytest.raises(proof.InvalidProofError, match="scope tool is missing"):
        proof.current(backend, repo, "WORKTREE@current")


def test_verification_requires_clear_and_original(
    repo: Path, calls: list[tuple[str, ...]]
) -> None:
    provider(repo)
    record = verification(repo)
    with pytest.raises(proof.InvalidProofError, match=r"original.*missing"):
        proof.validate(repo, "complete", str(record))
    original = comprehensive(repo)
    write(repo / ".git/darrow-review.duplicate/result.json", original.read_text())
    with pytest.raises(proof.InvalidProofError, match=r"original.*ambiguous"):
        proof.validate(repo, "complete", str(record))
    record.write_text(
        record.read_text().replace('"outcome": "clear"', '"outcome": "continue"')
    )
    with pytest.raises(proof.InvalidProofError, match="verification is not clear"):
        proof.validate(repo, "complete", str(record))


@pytest.mark.parametrize(
    "status,stdout,stderr",
    [(0, "valid\n", ""), (2, "", "invalid\n"), (2, "invalid\n", "")],
)
def test_provider_subprocess_arguments(
    repo: Path, monkeypatch: pytest.MonkeyPatch, status: int, stdout: str, stderr: str
) -> None:
    backend = provider(repo)

    def run(args: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        assert args == [
            "uv",
            "run",
            "--quiet",
            "--no-project",
            str((backend / "scripts/run_locked.py").resolve()),
            "review-result",
            "validate",
            "artifact with spaces",
        ]
        assert kwargs["cwd"] == repo
        return subprocess.CompletedProcess(args, status, stdout, stderr)

    monkeypatch.setattr(subprocess, "run", run)
    if status:
        with pytest.raises(proof.InvalidProofError, match="invalid"):
            proof.invoke(
                backend, repo, "review-result", "validate", "artifact with spaces"
            )
    else:
        assert (
            proof.invoke(
                backend, repo, "review-result", "validate", "artifact with spaces"
            )
            == "valid\n"
        )
