"""Known route unavailability saves honest scope-bound reports through the CLI."""

from __future__ import annotations

import sys
from importlib.metadata import distribution
from json import loads
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from conftest import git
from darrow_review import cli
from fixtures import result_record, verification_record, write
from test_cli_contract import invoke
from test_finalization import capture, prepare, prior_with_regression


def selected_route(repo: Path, manifest: str) -> str:
    path = str(Path(manifest).parent / "reviewer-route.json")
    cli.route_command(
        ["select", "--repo", str(repo), "--host", "codex", "--record", path]
    )
    return path


def test_block_route_retains_canonical_review_without_launch_inputs(repo: Path) -> None:
    (repo / "file.txt").write_text("unsafe\n", encoding="utf-8")
    manifest = prepare(repo)
    route = selected_route(repo, manifest)
    selected = Path(route).read_bytes()
    before = git(repo, "status", "--porcelain=v1")
    reason = "The host reports the configured reviewer route unavailable for this run."
    process = invoke(
        repo,
        "review-result",
        "block-route",
        "--manifest",
        manifest,
        "--route-record",
        route,
        "--reason",
        reason,
        "--spec-source",
        "Originating request: exported mode must equal safe.",
        "--no-checks-reason",
        "No repository check applies.",
    )
    assert process.returncode == 0, process.stderr
    locations = loads(process.stdout)
    run = Path(manifest).parent
    assert locations == {
        "result_record": str(run / "result.json"),
        "report": str(run / "review.md"),
    }
    result = loads((run / "result.json").read_text(encoding="utf-8"))
    assert result["verdict"] == result["standards"] == result["spec"] == "blocked"
    assert (
        result["spec_source"] == "Originating request: exported mode must equal safe."
    )
    assert result["changed_files"] == [str(repo / "file.txt")]
    assert not result.get("findings")
    assert result["checks"][0]["evidence"] == "No repository check applies."
    assert reason in (run / "review.md").read_text(encoding="utf-8")
    assert (run / "review.md").read_text(encoding="utf-8") == cli.report_command(
        ["render", str(run / "result.json")]
    )
    assert not list(run.glob("*-input.json"))
    assert not (run / "standards-route.json").exists()
    assert not (run / "spec-route.json").exists()
    assert Path(route).read_bytes() == selected
    assert git(repo, "status", "--porcelain=v1") == before


def test_block_route_preserves_repair_history_and_check_receipts(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    prior, original = prior_with_regression(repo)
    original_bytes = Path(original).read_bytes()
    previous = loads(original_bytes)
    (repo / "file.txt").write_text("second repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    route = selected_route(repo, manifest)
    receipt = capture(repo, manifest, monkeypatch)
    reason = "Host reports the selected reviewer route unavailable."
    process = invoke(
        repo,
        "review-result",
        "block-route",
        "--manifest",
        manifest,
        "--route-record",
        route,
        "--reason",
        reason,
        "--original",
        original,
        "--check",
        receipt,
        "--present",
    )
    assert process.returncode == 0, process.stderr
    run = Path(manifest).parent
    result = loads((run / "verification.json").read_text(encoding="utf-8"))
    assert result["outcome"] == "blocked"
    assert result["original_findings"] == previous["original_findings"]
    assert result["previous_verification"]["path"] == original
    assert result["attempts"] == previous["attempts"]
    assert result["evidence_gaps"] == [reason]
    assert result["regressions"] == [
        {
            **previous["regressions"][0],
            "status": "blocked",
            "progress": "unavailable",
            "evidence": reason,
        }
    ]
    assert result["checks"] == loads(Path(receipt).read_bytes())["checks"]
    assert "**Outcome:** blocked" in process.stdout and reason in process.stdout
    assert (run / "verification.md").read_text(encoding="utf-8") == cli.report_command(
        ["render-verification", str(run / "verification.json")]
    )
    assert Path(original).read_bytes() == original_bytes
    assert not (run / "result.json").exists()


def block_arguments(manifest: str, route: str) -> dict[str, str]:
    return {
        "--manifest": manifest,
        "--route-record": route,
        "--reason": "Host reports the selected route unavailable.",
        "--spec-source": "Originating requirement",
        "--no-checks-reason": "No repository checks apply.",
    }


def test_prelaunch_shortcut_refuses_to_drop_a_prepared_reader_finding(
    repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "file.txt").write_text("wrong value\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    route = selected_route(repo, manifest)
    cli.result_command(
        [
            "prepare-reader",
            "--manifest",
            manifest,
            "--axis",
            "spec",
            "--objective",
            "Restore the required value.",
            "--no-checks-reason",
            "No repository checks apply.",
            "--route-record",
            route,
        ]
    )
    findings = result_record()["findings"]
    reader = write(
        run / "spec.json",
        {
            "format": "darrow-review-axis-v3",
            "axis": "spec",
            "status": "fail",
            "sources": ["Originating requirement"],
            "findings": [
                {k: v for k, v in row.items() if k != "axis"} for row in findings
            ],
        },
    )
    reader_bytes = Path(reader).read_bytes()
    arguments = block_arguments(manifest, route)
    assert_refused(
        arguments,
        "prepared readers require partial-review finalization",
        monkeypatch,
        capsys,
    )
    assert Path(reader).read_bytes() == reader_bytes
    draft = write(
        run / "partial-draft.json",
        {
            "format": "darrow-review-result-v3",
            "standards": "blocked",
            "standards_sources": [
                "Native Standards reviewer failed with a capacity error."
            ],
            "spec": "fail",
            "spec_source": "Originating requirement",
            "findings": findings,
            "checks": [
                {
                    "command": "none",
                    "applicability": "not_applicable",
                    "status": "not_applicable",
                    "evidence": "No repository checks apply.",
                }
            ],
            "risks": ["Standards evidence unavailable."],
            "next_action": "Return retained findings.",
        },
    )
    process = invoke(
        repo,
        "review-result",
        "finalize",
        "--manifest",
        manifest,
        "--draft",
        draft,
        "--output",
        str(run / "result.json"),
        "--present",
    )
    assert process.returncode == 0, process.stderr
    saved = loads((run / "result.json").read_bytes())
    assert saved["standards"] == "blocked" and saved["spec"] == "fail"
    assert saved["verdict"] == "fail" and saved["findings"] == findings
    assert "wrong value" in process.stdout


def test_block_route_keeps_unresolved_cause_for_carried_regression(
    repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    prior, original = prior_with_regression(repo)
    previous = loads(Path(original).read_bytes())
    previous["attempts"][0].update(
        status="unresolved",
        progress="progressing",
        evidence="The partial repair is incomplete.",
    )
    write(Path(original), previous)
    original_bytes = Path(original).read_bytes()
    (repo / "file.txt").write_text("second partial repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    receipt = capture(repo, manifest, monkeypatch)
    arguments = block_arguments(manifest, selected_route(repo, manifest))
    arguments.pop("--spec-source")
    arguments["--original"] = original
    arguments["--check"] = receipt
    result_entrypoint([part for row in arguments.items() for part in row], monkeypatch)
    locations = loads(capsys.readouterr().out)
    current = loads(Path(locations["result_record"]).read_bytes())
    assert current["outcome"] == "blocked"
    assert current["attempts"] == [
        {
            "key": previous["attempts"][0]["key"],
            "status": "blocked",
            "progress": "unavailable",
            "evidence": arguments["--reason"],
        }
    ]
    assert current["regressions"][0]["caused_by"] == current["attempts"][0]["key"]
    assert current["regressions"][0]["progress"] == "unavailable"
    assert Path(locations["report"]).is_file()
    assert Path(original).read_bytes() == original_bytes


def result_entrypoint(arguments: list[str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["review-result", "block-route", *arguments])
    next(
        entry
        for entry in distribution("darrow-review").entry_points
        if entry.name == "review-result"
    ).load()()


def test_block_route_retains_failed_check_without_causal_judgment(
    repo: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (repo / "file.txt").write_text("original defect\n", encoding="utf-8")
    prior = prepare(repo)
    target = loads(Path(prior).read_bytes())["target"]
    finding = {
        **verification_record()["original_findings"][0],
        "key": f"spec:1:{target}",
    }
    original = write(
        Path(prior).parent / "handoff.json",
        {
            "original_target": target,
            "original_findings": [finding],
        },
    )
    (repo / "file.txt").write_text("unverified repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    receipt = capture(repo, manifest, monkeypatch, "exit 1")
    arguments = block_arguments(manifest, selected_route(repo, manifest))
    arguments.pop("--spec-source")
    arguments["--original"] = original
    arguments["--check"] = receipt
    result_entrypoint([part for row in arguments.items() for part in row], monkeypatch)
    locations = loads(capsys.readouterr().out)
    saved = loads(Path(locations["result_record"]).read_bytes())
    assert saved["outcome"] == "blocked"
    assert saved["checks"] == loads(Path(receipt).read_bytes())["checks"]
    assert saved["checks"][0]["status"] == "fail"
    assert saved["evidence_gaps"] == [arguments["--reason"]]
    assert not saved.get("regressions")
    assert not saved.get("attempts")
    assert Path(locations["report"]).is_file()
    gap_variants: list[list[str]] = [[], saved["evidence_gaps"]]
    for gaps in gap_variants:
        unsupported = write(
            Path(manifest).parent / "unsupported-clear.json",
            {
                **saved,
                "evidence_gaps": gaps,
                "outcome": "clear",
            },
        )
        rejected = invoke(repo, "review-result", "validate-verification", unsupported)
        assert rejected.returncode != 0


def assert_refused(
    arguments: dict[str, str],
    diagnostic: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as error:
        result_entrypoint(
            [part for row in arguments.items() for part in row], monkeypatch
        )
    assert error.value.code != 0
    assert diagnostic in capsys.readouterr().err
    run = Path(arguments["--manifest"]).parent
    assert not (run / "result.json").exists()
    assert not (run / "verification.json").exists()


@pytest.mark.parametrize(
    ("changes", "diagnostic"),
    [
        ({"--reason": " \n\t"}, "requires a concrete reason"),
        ({"--spec-source": None}, "requires explicit Spec availability"),
        ({"--no-checks-reason": None}, "declare checks or their inapplicability"),
        ({"--original": "some-original"}, "original Spec evidence"),
        (
            {"--spec-source": None, "--original": "some-original"},
            "pinned prior manifest",
        ),
    ],
)
def test_block_route_refuses_invalid_arguments(
    repo: Path,
    changes: dict[str, str | None],
    diagnostic: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    arguments = block_arguments(manifest, selected_route(repo, manifest))
    for flag, value in changes.items():
        if value is None:
            arguments.pop(flag)
        else:
            arguments[flag] = value
    assert_refused(arguments, diagnostic, monkeypatch, capsys)


@pytest.mark.parametrize(
    ("invalid", "diagnostic"),
    [
        ("foreign-route", "blocked route must belong to the current scope run"),
        ("changed-scope", "cannot validate pinned scope"),
        ("malformed-route", "route record"),
    ],
)
def test_block_route_refuses_mismatched_or_corrupt_artifacts(
    repo: Path,
    invalid: str,
    diagnostic: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    route = selected_route(repo, manifest)
    arguments = block_arguments(manifest, route)
    if invalid == "foreign-route":
        other = Path(prepare(repo)).parent / "reviewer-route.json"
        other.write_bytes(Path(route).read_bytes())
        arguments["--route-record"] = str(other)
    if invalid == "changed-scope":
        diff = Path(loads(Path(manifest).read_bytes())["diff"])
        diff.write_text("corrupted pinned diff\n", encoding="utf-8")
    if invalid == "malformed-route":
        Path(route).write_text("{}", encoding="utf-8")
    assert_refused(arguments, diagnostic, monkeypatch, capsys)


@settings(
    max_examples=10,
    derandomize=True,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
@given(
    suffix=st.text(
        st.characters(exclude_categories=["Cs"], exclude_characters="\0"),
        max_size=80,
    )
)
def test_unavailability_reason_round_trips_without_inventing_spec(
    repo: Path,
    suffix: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    route = selected_route(repo, manifest)
    reason = f'Host reports unavailable: "quoted"\n{suffix}'
    result_entrypoint(
        [
            "--manifest",
            manifest,
            "--route-record",
            route,
            "--reason",
            reason,
            "--spec-source",
            "not_available",
            "--no-checks-reason",
            "No checks apply.",
        ],
        monkeypatch,
    )
    assert loads(capsys.readouterr().out)["report"] == str(
        Path(manifest).parent / "review.md"
    )
    result = loads((Path(manifest).parent / "result.json").read_bytes())
    assert result["risks"] == [reason]
    assert result["spec"] == result["spec_source"] == "not_available"
    assert result["verdict"] == "blocked"


@pytest.mark.parametrize("mode", ["comprehensive", "first-repair", "later-repair"])
def test_installed_entrypoint_presents_blocked_evidence_in_each_mode(
    repo: Path,
    mode: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    prior, original = "", ""
    if mode == "later-repair":
        prior, original = prior_with_regression(repo)
    if mode == "first-repair":
        (repo / "file.txt").write_text("original defect\n", encoding="utf-8")
        prior = prepare(repo)
        target = loads(Path(prior).read_bytes())["target"]
        finding = {
            **verification_record()["original_findings"][0],
            "key": f"spec:1:{target}",
        }
        original = write(
            Path(prior).parent / "handoff.json",
            {
                "original_target": target,
                "original_findings": [finding],
            },
        )
    (repo / "file.txt").write_text("current change\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    arguments = block_arguments(manifest, selected_route(repo, manifest))
    if original:
        arguments.pop("--spec-source")
        arguments["--original"] = original
    result_entrypoint(
        [part for row in arguments.items() for part in row] + ["--present"], monkeypatch
    )
    message = capsys.readouterr().out
    assert "blocked" in message and arguments["--reason"] in message
    run = Path(manifest).parent
    name = "verification.json" if original else "result.json"
    saved = loads((run / name).read_bytes())
    assert saved["checks"][0]["status"] == "not_applicable"
    if original:
        assert (
            saved["original_findings"]
            == loads(Path(original).read_bytes())["original_findings"]
        )
