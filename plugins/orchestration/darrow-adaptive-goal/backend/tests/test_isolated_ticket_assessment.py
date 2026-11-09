"""Public assessment oracle controls; synthetic records are not native evidence."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

PLUGIN = Path(__file__).resolve().parents[1]
REVIEW = PLUGIN.parents[2] / "capability/darrow-review"
ORACLE = PLUGIN / "tests/evals/isolated_ticket_assessment.py"


def write(path: Path, value: object) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


@pytest.fixture(scope="module")
def provider(tmp_path_factory: pytest.TempPathFactory) -> Path:
    target = tmp_path_factory.mktemp("frozen-review") / "review"
    shutil.copytree(
        REVIEW, target, ignore=shutil.ignore_patterns(".venv", "__pycache__")
    )
    return target


class Evidence:
    def __init__(self, root: Path, provider: Path) -> None:
        self.root = root
        git(root, "init", "-q")
        git(root, "config", "user.name", "Fixture")
        git(root, "config", "user.email", "fixture@example.invalid")
        git(root, "commit", "--allow-empty", "-qm", "base")
        self.base = git(root, "rev-parse", "HEAD")
        git(root, "commit", "--allow-empty", "-qm", "candidate")
        self.target = git(root, "rev-parse", "HEAD")
        (root / ".git/integration-base").write_text(self.base)
        write(
            root / ".sevro-marketplace/.claude-plugin/marketplace.json",
            {
                "plugins": [{"name": "darrow-review", "source": "review"}],
            },
        )
        (root / ".sevro-marketplace/review").symlink_to(
            provider, target_is_directory=True
        )
        self.state = root / "read-only-review-grant"
        self.original = self.state / "original/result.json"
        self.current = self.state / "repair/verification.json"
        self.checks = [
            {
                "command": "bash test.sh",
                "applicability": "applicable",
                "status": "pass",
                "evidence": "exited 0",
            }
        ]
        self.finding = {
            "axis": "spec",
            "severity": "high",
            "disposition": "blocking",
            "location": "file.txt:1",
            "source": "request",
            "evidence": "wrong value",
            "repair_guidance": "restore value",
            "resolution_evidence": "test value",
        }
        self.result: dict[str, Any] = {
            "format": "darrow-review-result-v3",
            "base": self.base,
            "target": self.target,
            "changed_files": [str(root / "file.txt")],
            "standards": "pass",
            "standards_sources": ["AGENTS.md"],
            "spec": "pass",
            "spec_source": "request",
            "findings": [],
            "checks": self.checks,
            "verdict": "pass",
            "risks": ["none"],
            "next_action": "return",
        }
        self.verification: dict[str, Any] = {}
        self.save()

    def save(self) -> None:
        write(self.original, self.result)
        write(
            self.original.parent / "scope.json",
            {"base": self.base, "target": self.result["target"]},
        )
        if self.verification:
            write(self.current, self.verification)
            write(
                self.current.parent / "scope.json",
                {"base": self.base, "target": self.verification["current_target"]},
            )

    def repair(self) -> None:
        self.result.update(
            target=self.base, spec="fail", verdict="fail", findings=[self.finding]
        )
        key = f"spec:1:{self.base}"
        self.verification = {
            "format": "darrow-review-verification-v3",
            "original_target": self.base,
            "prior_target": self.base,
            "current_target": self.target,
            "previous_verification": {"checksum": "none", "path": "none"},
            "original_findings": [{**self.finding, "key": key, "order": "1"}],
            "attempts": [
                {
                    "key": key,
                    "status": "resolved",
                    "progress": "resolved",
                    "evidence": "fixed",
                }
            ],
            "checks": self.checks,
            "outcome": "clear",
            "next_action": "return",
        }
        self.save()

    def run(self) -> subprocess.CompletedProcess[str]:
        command = [
            sys.executable,
            str(ORACLE),
            "--base-file",
            ".git/integration-base",
            "--target",
            "HEAD",
            "--marketplace",
            ".sevro-marketplace/.claude-plugin/marketplace.json",
        ]
        return subprocess.run(
            command,
            cwd=self.root,
            env={**os.environ, "SEVRO_CANDIDATE_ARTIFACT_REVIEWS": str(self.state)},
            text=True,
            capture_output=True,
        )


@pytest.fixture
def evidence(tmp_path: Path, provider: Path) -> Evidence:
    return Evidence(tmp_path, provider)


@pytest.mark.parametrize("repair", [False, True])
def test_clear_current_assessment(evidence: Evidence, repair: bool) -> None:
    if repair:
        evidence.repair()
    before = {p: p.read_bytes() for p in evidence.state.rglob("*.json")}
    result = evidence.run()
    assert result.returncode == 0, result.stderr + result.stdout
    assert {p: p.read_bytes() for p in evidence.state.rglob("*.json")} == before


@pytest.mark.parametrize("repair", [False, True])
@pytest.mark.parametrize(
    "field,value", [("base", "wrong-base"), ("target", "stale-target")]
)
def test_rejects_wrong_current_scope(
    evidence: Evidence, repair: bool, field: str, value: str
) -> None:
    if repair:
        evidence.repair()
    current = evidence.current if repair else evidence.original
    write(
        current.parent / "scope.json",
        {"base": evidence.base, "target": evidence.target, field: value},
    )
    assert evidence.run().returncode != 0


@pytest.mark.parametrize("repair", [False, True])
def test_rejects_missing_or_ambiguous_original(
    evidence: Evidence, repair: bool
) -> None:
    if repair:
        evidence.repair()
    original = evidence.original.read_bytes()
    evidence.original.unlink()
    assert evidence.run().returncode != 0
    evidence.original.write_bytes(original)
    write(evidence.state / "duplicate/result.json", evidence.result)
    assert evidence.run().returncode != 0


@pytest.mark.parametrize(
    "field,value",
    [("base", "wrong-base"), ("target", "stale-target"), ("spec", "not_available")],
)
def test_rejects_unbound_original(evidence: Evidence, field: str, value: str) -> None:
    evidence.result[field] = value
    evidence.save()
    assert evidence.run().returncode != 0


def test_rejects_missing_ambiguous_or_uncleared_repair(evidence: Evidence) -> None:
    evidence.repair()
    evidence.current.unlink()
    assert evidence.run().returncode != 0
    evidence.save()
    duplicate = write(
        evidence.state / "duplicate/verification.json", evidence.verification
    )
    assert evidence.run().returncode != 0
    duplicate.unlink()
    evidence.verification["outcome"] = "continue"
    evidence.save()
    assert evidence.run().returncode != 0


@pytest.mark.parametrize("repair", [False, True])
@pytest.mark.parametrize(
    "checks",
    [
        [],
        [
            {
                "command": "test",
                "applicability": "applicable",
                "status": "fail",
                "evidence": "failed",
            }
        ],
        [
            {
                "command": "test",
                "applicability": "not_applicable",
                "status": "not_run",
                "evidence": "skipped",
            }
        ],
    ],
)
def test_rejects_missing_failed_or_skipped_checks(
    evidence: Evidence, repair: bool, checks: list[dict[str, str]]
) -> None:
    if repair:
        evidence.repair()
    record = evidence.verification if repair else evidence.result
    record["checks"] = checks
    evidence.save()
    assert evidence.run().returncode != 0


def test_validates_complete_linked_repair_history(evidence: Evidence) -> None:
    evidence.repair()
    previous = evidence.state / "previous/verification.json"
    first = {**evidence.verification, "current_target": "intermediate"}
    write(previous, first)
    evidence.verification.update(
        prior_target="intermediate",
        history_targets=[evidence.base],
        previous_verification={
            "path": str(previous),
            "checksum": git(
                evidence.root, "hash-object", "--no-filters", str(previous)
            ),
        },
    )
    evidence.save()
    result = evidence.run()
    assert result.returncode == 0, result.stderr + result.stdout
    previous.write_text(previous.read_text() + " ")
    assert evidence.run().returncode != 0
    previous.unlink()
    assert evidence.run().returncode != 0


def test_rejects_changed_original_findings(evidence: Evidence) -> None:
    evidence.repair()
    evidence.verification["original_findings"][0]["evidence"] = "invented"
    evidence.save()
    assert evidence.run().returncode != 0


@pytest.mark.parametrize("field", ["current_target", "original_target"])
def test_rejects_unbound_repair_target(evidence: Evidence, field: str) -> None:
    evidence.repair()
    evidence.verification[field] = "wrong-target"
    evidence.save()
    assert evidence.run().returncode != 0
