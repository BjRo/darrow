from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from darrow_adaptive_goal.fixtures import proof


@pytest.fixture(autouse=True)
def review_state(repo: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = repo.parent / "external-review-state"
    state.mkdir()
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(state))


def write(path: Path, text: str = "provider fixture\n") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return path


def provider(repo: Path, name: str = "review-plugin") -> Path:
    root = repo / ".sevro-marketplace"
    package = root / name
    backend = package / "backend"
    manifest = json.dumps({"name": "darrow-review", "version": "1.0.0"})
    for folder in (".claude-plugin", ".codex-plugin"):
        write(package / folder / "plugin.json", manifest)
    catalog = root / ".claude-plugin/marketplace.json"
    plugins = json.loads(catalog.read_text())["plugins"] if catalog.is_file() else []
    plugins.append({"name": "darrow-review", "source": f"./{name}"})
    write(catalog, json.dumps({"plugins": plugins}))
    for filename in ("result.py", "scope.py", "report.py"):
        write(backend / "src/darrow_review" / filename)
    return backend


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, ...]]:
    result: list[tuple[str, ...]] = []

    def invoke(_backend: Path, _repo: Path, *args: str, **_options: object) -> str:
        result.append(args)
        if args[0] == "review-report":
            return "Canonical human report\n"
        return json.dumps({"target": "WORKTREE@current"})

    monkeypatch.setattr(proof, "invoke", invoke)
    return result


def comprehensive(repo: Path) -> Path:
    return write(
        repo.parent
        / "external-review-state/repository/darrow-review.original/result.json",
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
        repo.parent
        / "external-review-state/repository/darrow-review.repair/verification.json",
        json.dumps(
            {
                "format": "darrow-review-verification-v3",
                "outcome": "clear",
                "original_target": "WORKTREE@current",
                "current_target": "WORKTREE@current",
            }
        ),
    )


def test_completion_accepts_current_external_review_state(
    repo: Path, calls: list[tuple[str, ...]], monkeypatch: pytest.MonkeyPatch
) -> None:
    provider(repo)
    old = comprehensive(repo)
    state = repo.parent / "selected-review-state"
    record = write(
        state / "repository/darrow-review.original/result.json", old.read_text()
    )
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(state))
    assert proof.validate(repo, "complete", str(record)).endswith(str(record) + "\n")
    assert (repo / ".fixture-state/goal-complete").read_text() == "complete\n"
    assert (repo / ".fixture-state/high-risk-review-state-root").read_text() == str(
        state
    ) + "\n"


def test_repository_review_state_cannot_clear_completion(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    state = repo / ".fixture-state/reviews"
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(state))
    with pytest.raises(proof.InvalidProofError, match="outside the repository"):
        proof.validate(repo, "complete", str(state / "darrow-review.fake/result.json"))
    assert not (repo / ".fixture-state/goal-complete").exists()


@pytest.mark.parametrize("value", ["", "relative-state"])
def test_review_state_requires_absolute_fixture_root(
    repo: Path, monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    record = comprehensive(repo)
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", value)
    with pytest.raises(
        proof.InvalidProofError, match="absolute DARROW_REVIEW_STATE_DIR"
    ):
        proof.validate(repo, "complete", str(record))


def test_clear_proof_delegates_and_binds_current_candidate(
    repo: Path, calls: list[tuple[str, ...]]
) -> None:
    provider(repo)
    record = comprehensive(repo)
    assert (
        proof.validate(repo, "complete", str(record))
        == f"valid clear review: {record}\n"
    )
    assert (repo / ".fixture-state/goal-complete").read_text() == "complete\n"
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


def test_provider_uses_only_the_declared_marketplace(repo: Path) -> None:
    with pytest.raises(proof.InvalidProofError, match="unreadable provider metadata"):
        proof.provider(repo)
    first = provider(repo, "a")
    write(repo / ".git/cache/backend/src/darrow_review/result.py", "different\n")
    assert proof.provider(repo) == first
    provider(repo, "b")
    with pytest.raises(proof.InvalidProofError, match="exactly one declared"):
        proof.provider(repo)


@pytest.mark.parametrize(
    "catalog,error",
    [
        ("[]", "invalid provider metadata"),
        ("{", "unreadable provider metadata"),
        ('{"plugins":[] ,"plugins":[]}', "duplicate provider JSON"),
        ('{"plugins":{}}', "invalid provider catalog plugins"),
        ('{"plugins":[null]}', "invalid provider catalog entry"),
        ('{"plugins":[]}', "exactly one declared"),
        ('{"plugins":[{"name":"other","source":"./other"}]}', "exactly one declared"),
        ('{"plugins":[{"name":"darrow-review","source":{}}]}', "local source"),
        ('{"plugins":[{"name":"darrow-review","source":"/absolute"}]}', "unsafe"),
        ('{"plugins":[{"name":"darrow-review","source":"./../outside"}]}', "escaping"),
        ('{"plugins":[{"name":"darrow-review","source":"./bad\\\\path"}]}', "unsafe"),
    ],
)
def test_provider_catalog_refusals(repo: Path, catalog: str, error: str) -> None:
    write(repo / ".sevro-marketplace/.claude-plugin/marketplace.json", catalog)
    with pytest.raises(proof.InvalidProofError, match=error):
        proof.provider(repo)


@pytest.mark.parametrize("nested", [False, True])
def test_provider_source_links_are_refused(repo: Path, nested: bool) -> None:
    backend = provider(repo)
    root = repo / ".sevro-marketplace"
    (root / "alias").symlink_to(backend.parent, target_is_directory=True)
    source = "./alias/child" if nested else "./alias"
    write(
        root / ".claude-plugin/marketplace.json",
        json.dumps({"plugins": [{"name": "darrow-review", "source": source}]}),
    )
    with pytest.raises(proof.InvalidProofError, match="linked"):
        proof.provider(repo)


@pytest.mark.parametrize(
    "manifest,error",
    [
        ({"name": "another", "version": "1.0.0"}, "identity differs"),
        ({"name": "darrow-review", "version": "2.0.0"}, "versions differ"),
        ({"name": "darrow-review", "version": ""}, "versions differ"),
        ({"name": "darrow-review", "version": 1}, "versions differ"),
    ],
)
def test_provider_identity_refusals(
    repo: Path, manifest: dict[str, object], error: str
) -> None:
    backend = provider(repo)
    write(backend.parent / ".claude-plugin/plugin.json", json.dumps(manifest))
    with pytest.raises(proof.InvalidProofError, match=error):
        proof.provider(repo)


def test_declared_provider_requires_result_tool(repo: Path) -> None:
    backend = provider(repo)
    (backend / "src/darrow_review/result.py").unlink()
    with pytest.raises(proof.InvalidProofError, match="tool is missing"):
        proof.provider(repo)


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
    assert not (repo / ".fixture-state/goal-complete").exists()


def test_bad_modes_and_missing_saved_evidence(repo: Path) -> None:
    with pytest.raises(proof.InvalidProofError, match="expected complete"):
        proof.validate(repo, "bad")
    with pytest.raises(proof.InvalidProofError):
        proof.validate(repo, "current")


@pytest.mark.parametrize(
    "replacement,error",
    [
        (('"verdict": "pass"', '"verdict": "fail"'), "not clear"),
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
    assert not (repo / ".fixture-state/goal-complete").exists()


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
    write(
        original.parent.parent / "darrow-review.duplicate/result.json",
        original.read_text(),
    )
    assert proof.validate(repo, "complete", str(record)).startswith(
        "valid clear review"
    )
    record.write_text(
        record.read_text().replace('"outcome": "clear"', '"outcome": "continue"')
    )
    with pytest.raises(proof.InvalidProofError, match="verification is not clear"):
        proof.validate(repo, "complete", str(record))


@pytest.mark.parametrize("matching", [False, True])
def test_verification_binds_findings_among_reports_for_one_target(
    repo: Path, monkeypatch: pytest.MonkeyPatch, matching: bool
) -> None:
    provider(repo)
    decoy = comprehensive(repo)
    original = write(
        decoy.parent.parent / "darrow-review.bound/result.json", decoy.read_text()
    )
    repaired = verification(repo)

    def invoke(_backend: Path, _repo: Path, *args: str, **_options: object) -> str:
        if args[1] == "validate-original" and (
            not matching or args[2] != str(original)
        ):
            raise proof.InvalidProofError("complete ordered finding set differs")
        return json.dumps({"target": "WORKTREE@current"})

    monkeypatch.setattr(proof, "invoke", invoke)
    if matching:
        assert proof.validate(repo, "complete", str(repaired)).startswith(
            "valid clear review"
        )
        assert (repo / ".fixture-state/goal-complete").is_file()
    else:
        with pytest.raises(
            proof.InvalidProofError, match=r"original.*missing|original.*match"
        ):
            proof.validate(repo, "complete", str(repaired))
        assert not (repo / ".fixture-state/goal-complete").exists()


@pytest.mark.parametrize(
    "status,stdout,stderr",
    [(0, "valid\n", ""), (2, "", "invalid\n"), (2, "invalid\n", "")],
)
@pytest.mark.parametrize("separate_state", [False, True])
def test_provider_subprocess_arguments(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    status: int,
    stdout: str,
    stderr: str,
    separate_state: bool,
) -> None:
    backend = provider(repo)
    state_root = repo.parent / "comparison-state" if separate_state else None
    monkeypatch.setenv("DARROW_PROOF_CONTEXT", "preserved")

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
        environment = kwargs["env"]
        if state_root is None:
            assert environment is None
        else:
            assert isinstance(environment, dict)
            assert environment["DARROW_REVIEW_STATE_DIR"] == str(state_root)
            assert environment["DARROW_PROOF_CONTEXT"] == "preserved"
        return subprocess.CompletedProcess(args, status, stdout, stderr)

    monkeypatch.setattr(subprocess, "run", run)
    if status:
        with pytest.raises(proof.InvalidProofError, match="invalid"):
            proof.invoke(
                backend,
                repo,
                "review-result",
                "validate",
                "artifact with spaces",
                state_root=state_root,
            )
    else:
        assert (
            proof.invoke(
                backend,
                repo,
                "review-result",
                "validate",
                "artifact with spaces",
                state_root=state_root,
            )
            == "valid\n"
        )
