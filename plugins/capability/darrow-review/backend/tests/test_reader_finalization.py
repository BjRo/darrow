"""Public finalization consumes retained independent records without transcription."""

from __future__ import annotations

import sys
from importlib.metadata import distribution
from json import loads as document
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli
from darrow_review.common import ReviewError
from fixtures import result_record, verification_record, write
from test_cli_contract import invoke
from test_finalization import capture, prepare, prior_with_regression
from test_reader_inputs import context, prepared


def bound_readers(manifest: str, receipt: str) -> list[str]:
    run = Path(manifest).parent
    route = str(run / "reviewer-route.json")
    repo = document(Path(manifest).read_text(encoding="utf-8"))["repository"]
    cli.route_command(["select", "--repo", repo, "--host", "codex", "--record", route])
    records = []
    for axis in ("standards", "spec"):
        source = context(run, objective="Return null for invalid input.")
        prepared(manifest, axis, source, "--check", receipt)
        cli.route_command(
            [
                "confirm-codex",
                "--route-record",
                route,
                "--axis",
                axis,
                "--agent-id",
                f"accepted-{axis}-child",
                "--application-record",
                str(run / f"{axis}-route.json"),
            ]
        )
        findings = result_record()["findings"] if axis == "spec" else []
        records.append(
            write(
                run / f"{axis}.json",
                {
                    "format": "darrow-review-axis-v3",
                    "axis": axis,
                    "status": "fail" if findings else "pass",
                    "sources": [
                        "originating request"
                        if axis == "spec"
                        else "heuristic:design-smells"
                    ],
                    "findings": [
                        {key: value for key, value in row.items() if key != "axis"}
                        for row in findings
                    ],
                },
            )
        )
    return records


def test_finalize_retained_readers_saves_canonical_reports(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    process = invoke(
        repo,
        "review-result",
        "finalize",
        "--manifest",
        manifest,
        "--reader",
        standards,
        "--reader",
        spec,
        "--check",
        receipt,
        "--next-action",
        "Return findings to the requester.",
    )
    assert process.returncode == 0, process.stderr
    locations = document(process.stdout)
    run = Path(manifest).parent
    assert locations == {
        "result_record": str(run / "result.json"),
        "report": str(run / "review.md"),
    }
    result = document((run / "result.json").read_text(encoding="utf-8"))
    assert result["verdict"] == "fail"
    assert result["standards"] == "pass"
    assert result["spec"] == "fail"
    assert result["findings"] == result_record()["findings"]
    assert (
        result["checks"]
        == document(Path(receipt).read_text(encoding="utf-8"))["checks"]
    )
    assert result["changed_files"] == [str(repo / "file.txt")]
    assert (run / "review.md").read_text(encoding="utf-8") == cli.report_command(
        ["render", str(run / "result.json")]
    )


def test_finalize_presents_scope_findings_and_checks_inline(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    process = invoke(
        repo,
        "review-result",
        "finalize",
        "--manifest",
        manifest,
        "--reader",
        standards,
        "--reader",
        spec,
        "--check",
        receipt,
        "--next-action",
        "Return findings to the requester.",
        "--present",
    )
    assert process.returncode == 0, process.stderr
    message = process.stdout
    assert "**Verdict:** fail" in message
    assert "HEAD" in message and "WORKTREE" in message
    assert "BLOCKING" in message and "file.txt:1" in message
    assert "wrong value" in message and "restore value" in message
    assert "test value" in message and "echo checked" in message
    assert "Return findings to the requester." in message
    run = Path(manifest).parent
    assert str(run / "review.md") in message
    assert (run / "result.json").is_file()
    assert (run / "review.md").read_text(encoding="utf-8") == cli.report_command(
        ["render", str(run / "result.json")]
    )
    assert "**Base:**" not in message
    assert "**Standards (pass):**" not in message


@pytest.mark.parametrize("present", [False, True])
def test_finalize_fix_readers_preserves_progress_and_advisory(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    present: bool,
) -> None:
    (repo / "file.txt").write_text("original defect\n", encoding="utf-8")
    prior = prepare(repo)
    target = document(Path(prior).read_text(encoding="utf-8"))["target"]
    blocker = {
        **verification_record()["original_findings"][0],
        "key": f"spec:1:{target}",
    }
    advisory = {
        **blocker,
        "key": f"standards:2:{target}",
        "axis": "standards",
        "order": "2",
        "severity": "low",
        "disposition": "advisory",
    }
    original = write(
        Path(prior).parent / "handoff.json",
        {"original_target": target, "original_findings": [blocker, advisory]},
    )
    (repo / "file.txt").write_text("partial repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    run = Path(manifest).parent
    receipt = capture(repo, manifest, monkeypatch)
    route = str(run / "reviewer-route.json")
    cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", route]
    )
    readers = []
    attempts = []
    for finding in (blocker, advisory):
        axis = finding["axis"]
        source = context(run, attempted=[finding["key"]])
        prepared(manifest, axis, source, "--check", receipt, "--original", original)
        cli.route_command(
            [
                "confirm-codex",
                "--route-record",
                route,
                "--axis",
                axis,
                "--agent-id",
                f"accepted-{axis}-child",
                "--application-record",
                str(run / f"{axis}-route.json"),
            ]
        )
        attempt = {
            "key": finding["key"],
            "status": "unresolved",
            "progress": "progressing" if axis == "spec" else "unchanged",
            "evidence": f"Independent {axis} evidence remains verbatim.",
        }
        attempts.append(attempt)
        readers.extend(
            [
                "--reader",
                write(
                    run / f"{axis}.json",
                    {
                        "format": "darrow-review-fix-axis-v3",
                        "axis": axis,
                        "originals": [finding["key"]],
                        "attempts": [attempt],
                    },
                ),
            ]
        )
    arguments = [
        "finalize",
        "--manifest",
        manifest,
        *readers,
        "--check",
        receipt,
        "--original",
        original,
        "--next-action",
        "Continue the bounded repair.",
        *(["--present"] if present else []),
    ]
    if present:
        monkeypatch.setattr(sys, "argv", ["review-result", *arguments])
        next(
            entry
            for entry in distribution("darrow-review").entry_points
            if entry.name == "review-result"
        ).load()()
        message = capsys.readouterr().out
    else:
        process = invoke(repo, "review-result", *arguments)
        assert process.returncode == 0, process.stderr
        message = process.stdout
    result = document((run / "verification.json").read_text(encoding="utf-8"))
    assert result["outcome"] == "continue"
    assert result["original_findings"] == [blocker, advisory]
    assert sorted(result["attempts"], key=lambda row: row["key"]) == sorted(
        attempts, key=lambda row: row["key"]
    )
    assert result["previous_verification"] == {"checksum": "none", "path": "none"}
    assert (run / "verification.md").read_text(encoding="utf-8") == cli.report_command(
        ["render-verification", str(run / "verification.json")]
    )
    if present:
        assert "**Outcome:** continue" in message
        assert "blocking" in message and "advisory" in message
        assert "Independent spec evidence remains verbatim." in message
        assert "Independent standards evidence remains verbatim." in message
        assert target in message and result["current_target"] in message
        assert "Repair scope" in message
        assert "Continue the bounded repair." in message
        assert "Closed original finding set" not in message


def test_presented_branch_scope_identifies_merge_base(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    from conftest import git

    expected_base = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-qb", "feature")
    (repo / "file.txt").write_text("feature change\n", encoding="utf-8")
    git(repo, "commit", "-qam", "feature")
    git(repo, "checkout", "-q", "main")
    (repo / "main-only.txt").write_text("main change\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "main")
    manifest = document(
        str(
            cli.scope_command(
                [
                    "prepare",
                    "--repo",
                    str(repo),
                    "--base",
                    "main",
                    "--target",
                    "feature",
                    "--merge-base",
                ]
            )
        )
    )["manifest"]
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    arguments = [
        "finalize",
        "--manifest",
        manifest,
        "--reader",
        standards,
        "--reader",
        spec,
        "--check",
        receipt,
        "--present",
    ]
    monkeypatch.setattr(sys, "argv", ["review-result", *arguments])
    next(
        entry
        for entry in distribution("darrow-review").entry_points
        if entry.name == "review-result"
    ).load()()
    message = capsys.readouterr().out
    assert "merge-base" in message
    assert "main" in message and "feature" in message
    record = document(
        (Path(manifest).parent / "result.json").read_text(encoding="utf-8")
    )
    assert record["base"] == expected_base
    assert record["changed_files"] == [str(repo / "file.txt")]


def test_finalize_carried_regression_copies_immutable_reader_evidence(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prior, original = prior_with_regression(repo)
    previous = document(Path(original).read_text(encoding="utf-8"))
    carried = previous["regressions"][0]
    (repo / "file.txt").write_text("regression repaired\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    run = Path(manifest).parent
    receipt = capture(repo, manifest, monkeypatch)
    prepared(manifest, "spec", context(run), "--check", receipt, "--original", original)
    route = str(run / "reviewer-route.json")
    cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", route]
    )
    cli.route_command(
        [
            "confirm-codex",
            "--route-record",
            route,
            "--axis",
            "spec",
            "--agent-id",
            "accepted-spec-child",
            "--application-record",
            str(run / "spec-route.json"),
        ]
    )
    action = {
        "key": carried["key"],
        "status": "resolved",
        "progress": "resolved",
        "evidence": "Independent verifier confirms the carried regression is fixed.",
    }
    reader = write(
        run / "spec.json",
        {
            "format": "darrow-review-fix-axis-v3",
            "axis": "spec",
            "originals": [],
            "prior_regressions": [
                {"key": carried["key"], "caused_by": carried["caused_by"]}
            ],
            "regression_attempts": [action],
        },
    )
    cli.result_command(
        [
            "finalize",
            "--manifest",
            manifest,
            "--reader",
            reader,
            "--original",
            original,
            "--check",
            receipt,
        ]
    )
    result = document((run / "verification.json").read_text(encoding="utf-8"))
    assert result["outcome"] == "clear"
    assert result["regressions"] == [{**carried, **action}]
    assert result["original_findings"] == previous["original_findings"]
    assert result["attempts"] == previous["attempts"]
    assert result["previous_verification"]["path"] == original


def test_finalize_new_regression_keeps_verifier_guidance_and_assigns_identity(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("defect\n", encoding="utf-8")
    prior = prepare(repo)
    target = document(Path(prior).read_text(encoding="utf-8"))["target"]
    original_finding = {
        **verification_record()["original_findings"][0],
        "key": f"spec:1:{target}",
    }
    original = write(
        Path(prior).parent / "handoff.json",
        {
            "original_target": target,
            "original_findings": [original_finding],
        },
    )
    (repo / "file.txt").write_text("repair with regression\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    run = Path(manifest).parent
    receipt = capture(repo, manifest, monkeypatch, "exit 1")
    key = original_finding["key"]
    prepared(
        manifest,
        "spec",
        context(run, attempted=[key]),
        "--check",
        receipt,
        "--original",
        original,
    )
    route = str(run / "reviewer-route.json")
    cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", route]
    )
    cli.route_command(
        [
            "confirm-codex",
            "--route-record",
            route,
            "--axis",
            "spec",
            "--agent-id",
            "accepted-spec-child",
            "--application-record",
            str(run / "spec-route.json"),
        ]
    )
    regression = {
        "caused_by": key,
        "severity": "high",
        "location": "file.txt:1",
        "source": "Preserve signed results",
        "evidence": "Repair discards the negative sign.",
        "repair_guidance": "Advisory: retain multiplication without taking the absolute value.",
        "resolution_evidence": "scale(-2) returns -4 while multiplier remains 2.",
    }
    reader = write(
        run / "spec.json",
        {
            "format": "darrow-review-fix-axis-v3",
            "axis": "spec",
            "originals": [key],
            "attempts": [
                {
                    "key": key,
                    "status": "resolved",
                    "progress": "resolved",
                    "evidence": "Original requirement is restored.",
                }
            ],
            "regressions": [regression],
        },
    )
    cli.result_command(
        [
            "finalize",
            "--manifest",
            manifest,
            "--reader",
            reader,
            "--original",
            original,
            "--check",
            receipt,
        ]
    )
    result = document((run / "verification.json").read_text(encoding="utf-8"))
    assert result["outcome"] == "continue"
    assert result["regressions"] == [
        {
            **regression,
            "key": f"regression:1:{key}",
            "order": "1",
            "axis": "spec",
            "status": "unresolved",
            "progress": "progressing",
        }
    ]


def test_empty_scope_saves_blocked_json_and_markdown_without_coordinator_draft(
    repo: Path,
) -> None:
    process = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        "HEAD",
        "--target",
        "WORKTREE",
        "--report-terminal",
    )
    assert process.returncode == 3
    assert "the declared review scope is empty" in process.stderr
    locations = document(process.stdout)
    result_path = Path(locations["result_record"])
    report_path = Path(locations["report"])
    assert result_path.name == "result.json"
    assert report_path == result_path.with_name("review.md")
    assert not result_path.is_relative_to(repo)
    result = document(result_path.read_text(encoding="utf-8"))
    assert result["verdict"] == result["standards"] == "blocked"
    assert result["spec"] == "not_available"
    assert "changed_files" not in result
    assert "findings" not in result
    assert result["checks"][0]["status"] == "blocked"
    assert (
        result["checks"][0]["evidence"]
        == "exited 3: the declared review scope is empty"
    )
    assert report_path.read_text(encoding="utf-8") == cli.report_command(
        ["render", str(result_path)]
    )


def test_finalize_standards_only_preserves_explicit_check_inapplicability(
    repo: Path,
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    prepared(manifest, "standards", context(run))
    route = str(run / "reviewer-route.json")
    cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", route]
    )
    cli.route_command(
        [
            "confirm-codex",
            "--route-record",
            route,
            "--axis",
            "standards",
            "--agent-id",
            "accepted-standards-child",
            "--application-record",
            str(run / "standards-route.json"),
        ]
    )
    reader = write(
        run / "standards.json",
        {
            "format": "darrow-review-axis-v3",
            "axis": "standards",
            "status": "pass",
            "sources": ["heuristic:design-smells"],
            "findings": [],
        },
    )
    cli.result_command(
        ["finalize", "--manifest", manifest, "--reader", reader, "--spec-not-available"]
    )
    result = document((run / "result.json").read_text(encoding="utf-8"))
    assert result["verdict"] == "pass"
    assert result["spec"] == result["spec_source"] == "not_available"
    assert result["checks"] == [
        {
            "command": "none",
            "applicability": "not_applicable",
            "status": "not_applicable",
            "evidence": "No applicable configured checks",
        }
    ]


@pytest.mark.parametrize(
    ("override", "diagnostic"),
    [
        ({"format": "wrong"}, "route application"),
        ({"axis": "spec"}, "route application"),
        ({"route_bound": "false"}, "route application"),
        ({"route_applied_by": "coordinator"}, "route application"),
        ({"agent_id": ""}, "child ID"),
        ({"selected_route": {}}, "selected route"),
        ({"requested_route": {}}, "selected route"),
    ],
)
def test_finalize_refuses_tampered_reader_route(
    repo: Path,
    monkeypatch: pytest.MonkeyPatch,
    override: dict[str, Any],
    diagnostic: str,
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    run = Path(manifest).parent
    application = run / "standards-route.json"
    write(application, document(application.read_text(encoding="utf-8")) | override)
    with pytest.raises(ReviewError, match=diagnostic) as error:
        cli.result_command(
            [
                "finalize",
                "--manifest",
                manifest,
                "--reader",
                standards,
                "--reader",
                spec,
                "--check",
                receipt,
            ]
        )
    assert error.value.code == 4
    assert not (run / "result.json").exists()
    assert not (run / "review.md").exists()


@pytest.mark.parametrize("reuse_child", [False, True])
def test_finalize_requires_distinct_reader_axes_and_children(
    repo: Path, monkeypatch: pytest.MonkeyPatch, reuse_child: bool
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    run = Path(manifest).parent
    if reuse_child:
        application = run / "spec-route.json"
        write(
            application,
            {
                **document(application.read_text(encoding="utf-8")),
                "agent_id": "accepted-standards-child",
            },
        )
    with pytest.raises(
        ReviewError,
        match="distinct child IDs" if reuse_child else "duplicate standards",
    ) as error:
        cli.result_command(
            [
                "finalize",
                "--manifest",
                manifest,
                "--reader",
                standards,
                "--reader",
                spec if reuse_child else standards,
                "--check",
                receipt,
            ]
        )
    assert error.value.code == 4
    assert not (run / "result.json").exists()


@pytest.mark.parametrize("missing", ["reader", "check", "prepared-source"])
def test_finalize_refuses_missing_or_changed_bound_evidence(
    repo: Path, monkeypatch: pytest.MonkeyPatch, missing: str
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    standards, spec = bound_readers(manifest, receipt)
    run = Path(manifest).parent
    readers = (
        ["--reader", standards]
        if missing == "reader"
        else ["--reader", standards, "--reader", spec]
    )
    checks = [] if missing == "check" else ["--check", receipt]
    if missing == "prepared-source":
        packet = run / "standards-input.json"
        data = document(packet.read_text(encoding="utf-8"))
        data["evidence"]["objective"] = "Unbound replacement objective"
        write(packet, data)
    with pytest.raises(ReviewError) as error:
        cli.result_command(["finalize", "--manifest", manifest, *readers, *checks])
    assert error.value.code == 4
    assert not (run / "result.json").exists()


@settings(max_examples=20, derandomize=True, deadline=None)
@given(st.text(alphabet="abcXYZ012_<>*#[]|\\&`\t\n", min_size=1, max_size=80))
def test_reader_guidance_round_trip_is_verbatim(value: str) -> None:
    from tempfile import TemporaryDirectory

    from conftest import git

    with TemporaryDirectory() as directory, pytest.MonkeyPatch.context() as patch:
        root = Path(directory)
        patch.setenv("DARROW_REVIEW_STATE_DIR", str(root / "review-state"))
        repo = root / "repository"
        repo.mkdir()
        for args in (
            ("init", "-q", "-b", "main"),
            ("config", "user.name", "Fixture"),
            ("config", "user.email", "fixture@example.invalid"),
        ):
            git(repo, *args)
        (repo / "file.txt").write_text("base\n", encoding="utf-8")
        git(repo, "add", ".")
        git(repo, "commit", "-qm", "base")
        (repo / "file.txt").write_text("changed\n", encoding="utf-8")
        manifest = prepare(repo)
        receipt = capture(repo, manifest, patch)
        standards, spec = bound_readers(manifest, receipt)
        data = document(Path(spec).read_text(encoding="utf-8"))
        data["findings"][0]["repair_guidance"] = value
        data["findings"][0]["evidence"] = "Evidence before\n## Scope\nEvidence after."
        write(Path(spec), data)
        human = cli.result_command(
            [
                "finalize",
                "--manifest",
                manifest,
                "--reader",
                standards,
                "--reader",
                spec,
                "--check",
                receipt,
                "--present",
            ]
        )
        final = document(
            (Path(manifest).parent / "result.json").read_text(encoding="utf-8")
        )
        assert final["findings"][0]["repair_guidance"] == value
        assert "Evidence after." in human
        assert "**Scope:**" in human


def test_terminal_refusal_requires_valid_scope_before_retry(repo: Path) -> None:
    process = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        "missing",
        "--target",
        "HEAD",
        "--report-terminal",
    )
    assert process.returncode == 2
    locations = document(process.stdout)
    result = document(Path(locations["result_record"]).read_text(encoding="utf-8"))
    assert result["next_action"] == (
        "Provide a valid base and target for a nonempty, unambiguous review scope "
        "before retrying. invalid base: missing"
    )
    assert result["checks"][0]["evidence"] == "exited 2: invalid base: missing"
    assert result["risks"] == ["invalid base: missing"]
    assert result["next_action"] in Path(locations["report"]).read_text(
        encoding="utf-8"
    )


def test_terminal_dispatcher_preserves_invalid_scope_and_available_spec(
    repo: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    with pytest.raises(ReviewError, match="invalid base") as error:
        cli.scope_command(
            [
                "prepare",
                "--repo",
                str(repo),
                "--base",
                "missing",
                "--target",
                "HEAD",
                "--report-terminal",
                "--spec-source",
                "Originating request",
            ]
        )
    assert error.value.code == 2
    locations = document(capsys.readouterr().out)
    result = document(Path(locations["result_record"]).read_text(encoding="utf-8"))
    assert result["base"] == "missing"
    assert result["spec"] == "blocked"
    assert result["spec_source"] == "Originating request"
    assert Path(locations["report"]).read_text(encoding="utf-8") == cli.report_command(
        ["render", locations["result_record"]]
    )
