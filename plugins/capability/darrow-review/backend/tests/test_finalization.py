"""File-backed finalization through the public command dispatcher."""

from __future__ import annotations

import html
import tempfile
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli
from darrow_review.common import ReviewError, blob_hash, serialize
from darrow_review.records import Records
from fixtures import result_record, verification_record, write
from test_verification import regression


def prepare(repo: Path, prior: str = "") -> str:
    extra = (
        ["--prior-manifest", prior, "--allow-empty"] if prior else ["--base", "HEAD"]
    )
    return Records(
        str(
            cli.scope_command(
                [
                    "prepare",
                    "--repo",
                    str(repo),
                    "--target",
                    "WORKTREE",
                    *extra,
                ]
            )
        )
    ).value("manifest")


def capture(repo: Path, manifest: str, monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.chdir(repo)
    path = str(Path(manifest).parent / "check.json")
    cli.check_command(["run", "--output", path, "--command", "echo checked"])
    return path


def finalize(manifest: str, draft: str, receipt: str, original: str = "") -> str:
    name = "verification.json" if original else "result.json"
    output = str(Path(manifest).parent / name)
    extra = ["--original", original] if original else []
    cli.result_command(
        [
            "finalize",
            "--manifest",
            manifest,
            "--draft",
            draft,
            "--output",
            output,
            "--check",
            receipt,
            *extra,
        ]
    )
    return output


def test_prior_verification_history_is_carried_without_transcription(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (repo / "file.txt").write_text("original\n", encoding="utf-8")
    original_scope = prepare(repo)
    original = finalize(
        original_scope,
        write(Path(original_scope).parent / "draft.json", result_record()),
        capture(repo, original_scope, monkeypatch),
    )
    original_target = Records(Path(original).read_text(encoding="utf-8")).value(
        "target"
    )
    key = f"spec:1:{original_target}"
    prior_scope, original_input = original_scope, original
    draft = verification_record()
    draft["attempts"][0]["key"] = key
    for content in ("repair-one\n", "repair-two\n"):
        (repo / "file.txt").write_text(content, encoding="utf-8")
        current_scope = prepare(repo, prior_scope)
        current = finalize(
            current_scope,
            write(Path(current_scope).parent / "draft.json", draft),
            capture(repo, current_scope, monkeypatch),
            original_input,
        )
        prior_scope, original_input = current_scope, current
    result = Records(Path(current).read_text(encoding="utf-8"))
    prior = result.object("previous_verification")["path"]
    previous = Records(Path(prior).read_text(encoding="utf-8"))
    assert result.object("previous_verification")["checksum"] == blob_hash(
        Path(prior).read_bytes()
    )
    assert result.strings("history_targets") == [original_target]
    assert result.value("prior_target") == previous.value("current_target")
    assert result.items("original_findings") == previous.items("original_findings")
    assert result.value("outcome") == "clear"


def test_assessment_correction_clears_same_candidate_and_retains_prior_result(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(repo.parent / "review-state_"))
    (repo / "file.txt").write_text("original\n", encoding="utf-8")
    original_scope = prepare(repo)
    original = finalize(
        original_scope,
        write(Path(original_scope).parent / "draft.json", result_record()),
        capture(repo, original_scope, monkeypatch),
    )
    original_target = Records(Path(original).read_text(encoding="utf-8")).value(
        "target"
    )
    (repo / "file.txt").write_text("repaired\n", encoding="utf-8")
    prior_scope = prepare(repo, original_scope)
    blocked = {
        "format": "darrow-review-verification-v3",
        "attempts": [],
        "evidence_gaps": ["The independent reader did not return its assessment."],
        "next_action": "Obtain the missing reader assessment.",
    }
    previous = finalize(
        prior_scope,
        write(Path(prior_scope).parent / "draft.json", blocked),
        capture(repo, prior_scope, monkeypatch),
        original,
    )
    prior_bytes = Path(previous).read_bytes()
    manifest = prepare(repo, prior_scope)
    reason = (
        "The reader now independently confirms the repaired value; no code changed."
    )
    correction = {
        "format": "darrow-review-verification-v3",
        "assessment_correction": reason,
        "attempts": [
            {
                "key": f"spec:1:{original_target}",
                "status": "resolved",
                "progress": "resolved",
                "evidence": "Fresh reader observed the required repaired value.",
            }
        ],
        "next_action": "Return the corrected assessment to the same owner.",
    }
    output = finalize(
        manifest,
        write(Path(manifest).parent / "draft.json", correction),
        capture(repo, manifest, monkeypatch),
        previous,
    )
    final = Records(Path(output).read_text(encoding="utf-8"))
    assert final.value("outcome") == "clear"
    assert final.value("current_target") == final.value("prior_target")
    assert final.object("previous_verification") == {
        "path": previous,
        "checksum": blob_hash(prior_bytes),
    }
    assert final.strings("history_targets") == [original_target]
    assert final.items("original_findings") == Records(
        prior_bytes.decode("utf-8")
    ).items("original_findings")
    assert Path(previous).read_bytes() == prior_bytes
    rendered = str(cli.report_command(["render-verification", output]))
    assert reason in rendered
    assert previous in html.unescape(rendered)


def prior_with_regression(repo: Path) -> tuple[str, str]:
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    original_scope = prepare(repo)
    original_target = Records(Path(original_scope).read_text(encoding="utf-8")).value(
        "target"
    )
    (repo / "file.txt").write_text("first repair\n", encoding="utf-8")
    prior_scope = prepare(repo, original_scope)
    prior_target = Records(Path(prior_scope).read_text(encoding="utf-8")).value(
        "target"
    )
    record = verification_record()
    record.update(
        original_target=original_target,
        prior_target=original_target,
        current_target=prior_target,
        outcome="continue",
    )
    key = f"spec:1:{original_target}"
    record["original_findings"][0]["key"] = key
    record["attempts"][0]["key"] = key
    carried = regression()
    carried.update(key=f"regression:1:{key}", caused_by=key)
    record["regressions"] = [carried]
    original = write(Path(prior_scope).parent / "verification.json", record)
    return prior_scope, original


@pytest.mark.parametrize("history", [None, [], ["unbound"]])
def test_external_history_finalization(
    repo: Path, monkeypatch: pytest.MonkeyPatch, history: list[str] | None
) -> None:
    prior_scope, previous = prior_with_regression(repo)
    old = Records(Path(previous).read_text(encoding="utf-8"))
    handoff: dict[str, object] = {
        "original_target": old.value("original_target"),
        "original_findings": old.items("original_findings"),
        "previous_verification": {
            "path": previous,
            "checksum": blob_hash(Path(previous).read_bytes()),
        },
    }
    if history is not None:
        handoff["history_targets"] = history
    source = write(Path(prior_scope).parent / "external.json", handoff)
    (repo / "file.txt").write_text("second repair\n", encoding="utf-8")
    manifest = prepare(repo, prior_scope)
    draft = {**old.data, "next_action": "return control to enclosing goal"}
    # History comes from the bound prior artifact, never a copied draft.
    draft.pop("history_targets", None)
    draft_path = write(Path(manifest).parent / "draft.json", draft)
    receipt = capture(repo, manifest, monkeypatch)
    if history is not None:
        with pytest.raises(ReviewError, match="history"):
            finalize(manifest, draft_path, receipt, source)
        assert not (Path(manifest).parent / "verification.json").exists()
        return
    output = finalize(manifest, draft_path, receipt, source)
    final = Records(Path(output).read_text(encoding="utf-8"))
    assert final.strings("history_targets") == [old.value("original_target")]
    assert final.items("original_findings") == old.items("original_findings")
    assert final.value("outcome") == "continue"


def test_assessment_correction_requires_fresh_original_judgment(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prior_scope, previous = prior_with_regression(repo)
    prior = Records(Path(previous).read_text(encoding="utf-8"))
    manifest = prepare(repo, prior_scope)
    draft = {
        "format": "darrow-review-verification-v3",
        "assessment_correction": "The previous regression assessment was incorrect.",
        "attempts": [],
        "regressions": [
            {
                **row,
                "status": "resolved",
                "progress": "resolved",
                "evidence": "verified",
            }
            for row in prior.items("regressions")
        ],
        "next_action": "Return the correction.",
    }
    with pytest.raises(ReviewError, match="every blocking original finding"):
        finalize(
            manifest,
            write(Path(manifest).parent / "draft.json", draft),
            capture(repo, manifest, monkeypatch),
            previous,
        )
    assert not (Path(manifest).parent / "verification.json").exists()


@pytest.mark.parametrize("reopened", [False, True])
def test_regression_only_finalization_preserves_resolved_originals(
    repo: Path, monkeypatch: pytest.MonkeyPatch, reopened: bool
) -> None:
    prior_scope, previous = prior_with_regression(repo)
    old = Records(Path(previous).read_text(encoding="utf-8"))
    (repo / "file.txt").write_text("regression repaired\n", encoding="utf-8")
    manifest = prepare(repo, prior_scope)
    current = {
        **old.items("attempts")[0],
        "status": "unresolved",
        "progress": "unchanged",
        "evidence": "current verifier observed the original defect again",
    }
    draft = {
        "format": "darrow-review-verification-v3",
        "attempts": [current] if reopened else [],
        "regressions": [
            {**row, "status": "resolved", "progress": "resolved", "evidence": "fixed"}
            for row in old.items("regressions")
        ],
        "next_action": "return control to enclosing goal",
    }
    source = write(Path(manifest).parent / "draft.json", draft)
    output = finalize(manifest, source, capture(repo, manifest, monkeypatch), previous)
    final = Records(Path(output).read_text(encoding="utf-8"))
    assert final.items("attempts") == ([current] if reopened else old.items("attempts"))
    assert final.value("outcome") == ("no_progress" if reopened else "clear")


@pytest.mark.parametrize(
    "override",
    [
        {"format": "wrong"},
        {"exit_code": "-1"},
        {"exit_code": "127"},
        {"checks": []},
        {"checks": "bad"},
        {
            "checks": [
                {
                    "command": "none",
                    "applicability": "not_applicable",
                    "status": "not_applicable",
                    "evidence": "exited 0: no check",
                }
            ]
        },
        {
            "checks": [
                {
                    "command": "echo checked",
                    "applicability": "applicable",
                    "status": "pass",
                    "evidence": "authored evidence",
                }
            ]
        },
    ],
)
def test_invalid_capture_never_publishes_a_result(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    override: dict[str, Any],
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    content = Records(Path(receipt).read_text(encoding="utf-8")).data
    Path(receipt).write_text(serialize(content | override), encoding="utf-8")
    draft = write(Path(manifest).parent / "draft.json", result_record())
    with pytest.raises(ReviewError) as error:
        finalize(manifest, draft, receipt)
    assert error.value.code == 4
    assert not (Path(manifest).parent / "result.json").exists()
    assert not (Path(manifest).parent / "review.md").exists()


def test_missing_duplicate_and_foreign_receipts_are_refused(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    draft = write(Path(manifest).parent / "draft.json", result_record())
    foreign = tmp_path / "check.json"
    foreign.write_bytes(Path(receipt).read_bytes())
    output = str(Path(manifest).parent / "result.json")
    common = ["finalize", "--manifest", manifest, "--draft", draft, "--output", output]
    for extra in (
        [],
        ["--check", receipt, "--check", receipt],
        ["--check", str(foreign)],
    ):
        with pytest.raises(ReviewError) as error:
            cli.result_command([*common, *extra])
        assert error.value.code == 4
        assert not Path(output).exists()


def test_explicit_inapplicability_and_output_boundary(
    repo: Path, tmp_path: Path
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    draft = result_record()
    draft["checks"] = [
        {
            "command": "none",
            "applicability": "not_applicable",
            "status": "not_applicable",
            "evidence": "no configured check",
        }
    ]
    source = write(Path(manifest).parent / "draft.json", draft)
    args = ["finalize", "--manifest", manifest, "--draft", source]
    with pytest.raises(ReviewError, match="current scope run"):
        cli.result_command([*args, "--output", str(tmp_path / "outside.json")])
    with pytest.raises(ReviewError, match="only to fix verification"):
        cli.result_command(
            [
                *args,
                "--output",
                str(Path(manifest).parent / "result.json"),
                "--original",
                source,
            ]
        )
    output = Path(manifest).parent / "result.json"
    cli.result_command([*args, "--output", str(output)])
    assert (
        Records(output.read_text(encoding="utf-8")).items("checks") == draft["checks"]
    )
    assert not (tmp_path / "outside.json").exists()


@settings(max_examples=60, derandomize=True)
@given(st.text(alphabet="abcXYZ012_<>*#[]|\\&`", min_size=1, max_size=80))
def test_report_field_round_trip_preserves_literal_markup(evidence: str) -> None:
    data = result_record()
    data["findings"][0]["evidence"] = evidence
    with tempfile.TemporaryDirectory() as directory:
        source = write(Path(directory) / "result.json", data)
        rendered = cli.report_command(["render", source])
    line = next(
        row for row in rendered.splitlines() if row.startswith("- **Evidence:** ")
    )
    value = line.removeprefix("- **Evidence:** ")
    assert html.unescape(value) == evidence
    assert not any(character in value for character in "<*>`[]|\\")
