"""Reader handoffs through the public dispatcher and real retained evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_review import cli
from darrow_review.common import ReviewError, document, package_root, serialize
from fixtures import result_record, verification_record, write
from test_cli_contract import invoke
from test_finalization import capture, finalize, prepare
from test_verification import regression


def context(run: Path, **values: object) -> str:
    return write(
        run / "context.json",
        {
            "sources": [],
            "checks": [
                {
                    "command": "none",
                    "applicability": "not_applicable",
                    "status": "not_applicable",
                    "evidence": "No applicable configured checks",
                }
            ],
            **values,
        },
    )


def prepared(manifest: str, axis: str, source: str, *extra: str) -> dict[str, Any]:
    return document(
        cli.result_command(
            [
                "prepare-reader",
                "--manifest",
                manifest,
                "--axis",
                axis,
                "--context",
                source,
                *extra,
            ]
        )
    )


def read_packet(path: str) -> dict[str, Any]:
    return document(cli.result_command(["read-reader", "--input", path]))


@pytest.mark.parametrize("axis", ["standards", "spec"])
def test_inputs_bind_exact_scope_and_installed_baseline(repo: Path, axis: str) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    guidance = repo / "AGENTS.md"
    guidance.write_text("Keep the local design\n", encoding="utf-8")
    source = context(run, sources=[str(guidance)], objective="Return the change")
    result = prepared(manifest, axis, source)
    packet = read_packet(result["input"])
    assert packet["axis"] == axis
    assert packet["mode"] == "comprehensive"
    assert packet["scope"]["manifest"] == manifest
    assert packet["scope"]["repository"] == str(repo)
    assert packet["scope"]["changed_files"] == [str(repo / "file.txt")]
    assert packet["sources"][0]["text"] == guidance.read_text(encoding="utf-8")
    assert result["message"].startswith(f"- review_axis: {axis}\n")
    assert "[READER_INPUT_COMMAND]" not in result["message"]
    assert "read-reader" in result["message"]
    if axis == "standards":
        baseline = (
            package_root().parent / "skills/code-review/references/design-smells.md"
        )
        assert packet["baseline"]["path"] == str(baseline)
        assert packet["baseline"]["text"] == baseline.read_text(encoding="utf-8")
    else:
        assert "baseline" not in packet


def test_captured_checks_are_copied_without_reinterpretation(
    repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    receipt = capture(repo, manifest, monkeypatch)
    source = context(Path(manifest).parent)
    result = prepared(manifest, "standards", source, "--check", receipt)
    assert (
        read_packet(result["input"])["checks"]
        == document(Path(receipt).read_text(encoding="utf-8"))["checks"]
    )


def test_fix_input_preserves_axis_findings_and_prior_scope(repo: Path) -> None:
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    prior = prepare(repo)
    target = document(Path(prior).read_text(encoding="utf-8"))["target"]
    original = verification_record()["original_findings"]
    original[0]["key"] = f"spec:1:{target}"
    original[0].pop("repair_guidance")
    original[0].pop("resolution_evidence")
    standards = {
        **original[0],
        "axis": "standards",
        "order": "2",
        "key": f"standards:2:{target}",
    }
    handoff = write(
        Path(prior).parent / "original.json",
        {
            "original_target": target,
            "original_findings": [*original, standards],
        },
    )
    (repo / "file.txt").write_text("fixed\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    source = context(Path(manifest).parent, attempted=[original[0]["key"]])
    result = prepared(manifest, "spec", source, "--original", handoff)
    packet = read_packet(result["input"])
    assert packet["mode"] == "fix-verification"
    assert packet["repair"]["original_findings"] == original
    assert packet["repair"]["attempted"] == [original[0]["key"]]
    assert packet["repair"]["prior_scope"]["manifest"] == prior
    assert "repair_show_command" in packet["scope"]
    assert "Standards" not in result["message"]


@pytest.mark.parametrize("kind", ["manifest", "source", "packet"])
def test_changed_inputs_are_refused_before_reader_use(repo: Path, kind: str) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    rule = repo / "AGENTS.md"
    rule.write_text("original\n", encoding="utf-8")
    source = context(Path(manifest).parent, sources=[str(rule)])
    packet = prepared(manifest, "standards", source)["input"]
    path = {"manifest": Path(manifest), "source": rule, "packet": Path(packet)}[kind]
    data = path.read_text(encoding="utf-8")
    if kind == "source":
        path.write_text("changed\n", encoding="utf-8")
    elif kind == "packet":
        altered = document(data)
        cast(dict[str, object], altered["evidence"])["axis"] = "spec"
        path.write_text(serialize(altered), encoding="utf-8")
    else:
        path.write_text(data + " ", encoding="utf-8")
    with pytest.raises(ReviewError):
        read_packet(packet)


@pytest.mark.parametrize(
    "change",
    [
        {"sources": ["relative.md"]},
        {"sources": ["/missing/rule.md"]},
        {"unknown": "field"},
        {"attempted": ["unbound"]},
        {
            "checks": [
                {
                    "command": "echo invented",
                    "applicability": "applicable",
                    "status": "pass",
                    "evidence": "claimed",
                }
            ]
        },
    ],
)
def test_invalid_context_never_publishes_input(
    repo: Path, change: dict[str, object]
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    with pytest.raises(ReviewError):
        prepared(manifest, "standards", context(run, **change))
    assert not (run / "standards-input.json").exists()


def test_correction_is_once_and_bound_to_existing_child(repo: Path) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    packet = prepared(manifest, "standards", context(run))["input"]
    cli.route_command(
        [
            "select",
            "--repo",
            str(repo),
            "--host",
            "codex",
            "--record",
            str(run / "reviewer-route.json"),
        ]
    )
    cli.route_command(
        [
            "confirm-codex",
            "--route-record",
            str(run / "reviewer-route.json"),
            "--axis",
            "standards",
            "--agent-id",
            "/root/standards",
            "--application-record",
            str(run / "standards-route.json"),
        ]
    )
    common = [
        "reader-feedback",
        "--input",
        packet,
        "--error",
        "sources must be an array",
    ]
    with pytest.raises(ReviewError, match="child"):
        cli.result_command([*common, "--agent-id", "/root/other"])
    feedback = document(cli.result_command([*common, "--agent-id", "/root/standards"]))
    assert feedback["agent_id"] == "/root/standards"
    assert "sources must be an array" in str(feedback["message"])
    with pytest.raises(ReviewError, match="already exists"):
        cli.result_command([*common, "--agent-id", "/root/standards"])


@settings(max_examples=30, derandomize=True)
@given(st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_objective_round_trip_is_data_not_prompt_substitution(objective: str) -> None:
    from darrow_review.reader_inputs import validate_context

    value: dict[str, object] = {"sources": [], "objective": objective}
    assert validate_context(document(serialize(value)))["objective"] == objective


def test_installed_commands_work_from_another_directory(repo: Path) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    source = context(Path(manifest).parent, objective="Keep _values and [brackets]\n")
    process = invoke(
        repo,
        "review-result",
        "prepare-reader",
        "--manifest",
        manifest,
        "--axis",
        "spec",
        "--context",
        source,
    )
    assert process.returncode == 0, process.stderr
    packet = str(document(process.stdout)["input"])
    read = invoke(repo.parent, "review-result", "read-reader", "--input", packet)
    assert read.returncode == 0, read.stderr
    assert document(read.stdout)["objective"] == "Keep _values and [brackets]\n"


@pytest.mark.parametrize("axis", ["standards", "spec"])
def test_comprehensive_original_can_seed_fix_inputs(
    repo: Path, monkeypatch: pytest.MonkeyPatch, axis: str
) -> None:
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    prior = prepare(repo)
    draft = result_record()
    draft["findings"][0]["axis"] = axis
    draft["standards"], draft["spec"] = (
        ("fail", "pass") if axis == "standards" else ("pass", "fail")
    )
    original = finalize(
        prior,
        write(Path(prior).parent / "draft.json", draft),
        capture(repo, prior, monkeypatch),
    )
    target = str(document(Path(prior).read_text())["target"])
    (repo / "file.txt").write_text("fixed\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    source = context(Path(manifest).parent, attempted=[f"{axis}:1:{target}"])
    packet = prepared(manifest, axis, source, "--original", original)["input"]
    assert (
        read_packet(packet)["repair"]["original_findings"][0]["key"]
        == f"{axis}:1:{target}"
    )


def prior_with_regression(repo: Path) -> tuple[str, str]:
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    original_scope = prepare(repo)
    original_target = str(document(Path(original_scope).read_text())["target"])
    (repo / "file.txt").write_text("first repair\n", encoding="utf-8")
    prior_scope = prepare(repo, original_scope)
    prior_target = str(document(Path(prior_scope).read_text())["target"])
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


@pytest.mark.parametrize("external", [False, True])
def test_prior_history_and_carried_regressions_survive_reader_handoff(
    repo: Path, external: bool
) -> None:
    from darrow_review.common import blob_hash

    prior, previous = prior_with_regression(repo)
    old = document(Path(previous).read_text())
    original = previous
    if external:
        original = write(
            Path(prior).parent / "handoff.json",
            {
                "original_target": old["original_target"],
                "original_findings": old["original_findings"],
                "previous_verification": {
                    "path": previous,
                    "checksum": blob_hash(Path(previous).read_bytes()),
                },
            },
        )
    (repo / "file.txt").write_text("second repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    source = context(Path(manifest).parent, attempted=[])
    packet = prepared(manifest, "spec", source, "--original", original)["input"]
    repair = read_packet(packet)["repair"]
    assert repair["regressions"] == old["regressions"]
    assert repair["history_targets"] == [old["original_target"]]
    assert repair["previous_verification"]["path"] == previous


@pytest.mark.parametrize(
    "kind", ["matching", "absent", "extra", "omitted", "duplicate", "malformed"]
)
def test_external_history_must_match_validated_prior(repo: Path, kind: str) -> None:
    from darrow_review.common import blob_hash

    prior, previous = prior_with_regression(repo)
    old = document(Path(previous).read_text())
    expected = [old["original_target"]]
    histories: dict[str, object] = {
        "matching": expected,
        "extra": [*expected, "unbound"],
        "omitted": [],
        "duplicate": [*expected, *expected],
        "malformed": "not an array",
    }
    handoff: dict[str, object] = {
        "original_target": old["original_target"],
        "original_findings": old["original_findings"],
        "previous_verification": {
            "path": previous,
            "checksum": blob_hash(Path(previous).read_bytes()),
        },
    }
    if kind != "absent":
        handoff["history_targets"] = histories[kind]
    source = write(Path(prior).parent / "handoff.json", handoff)
    (repo / "file.txt").write_text("second repair\n", encoding="utf-8")
    manifest = prepare(repo, prior)
    run = Path(manifest).parent
    selected = context(run, attempted=[])
    if kind in ("matching", "absent"):
        packet = prepared(manifest, "spec", selected, "--original", source)["input"]
        assert read_packet(packet)["repair"]["history_targets"] == expected
    else:
        with pytest.raises(ReviewError):
            prepared(manifest, "spec", selected, "--original", source)
        assert not (run / "spec-input.json").exists()


@pytest.mark.parametrize(
    "problem",
    [
        "no-prior",
        "wrong-axis",
        "duplicate",
        "no-attempt",
        "wrong-target",
        "unknown-key",
    ],
)
def test_inconsistent_fix_handoffs_are_refused(repo: Path, problem: str) -> None:
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    prior = prepare(repo)
    target = str(document(Path(prior).read_text())["target"])
    original = verification_record()["original_findings"]
    original[0]["key"] = f"spec:1:{target}"
    evidence = {"original_target": target, "original_findings": original}
    attempted = [original[0]["key"]]
    axis = "standards" if problem == "wrong-axis" else "spec"
    if problem == "duplicate":
        attempted *= 2
    if problem == "no-attempt":
        attempted = []
    if problem == "wrong-target":
        evidence["original_target"] = "another-target"
        original[0]["key"] = "spec:1:another-target"
        attempted = [original[0]["key"]]
    if problem == "unknown-key":
        attempted = ["spec:9:unknown"]
    source = write(Path(prior).parent / "original.json", evidence)
    (repo / "file.txt").write_text("fixed\n", encoding="utf-8")
    manifest = prepare(repo, "" if problem == "no-prior" else prior)
    with pytest.raises(ReviewError):
        prepared(
            manifest,
            axis,
            context(Path(manifest).parent, attempted=attempted),
            "--original",
            source,
        )


@pytest.mark.parametrize(
    "problem",
    [
        "empty-source",
        "duplicate-source",
        "no-objective",
        "invalid-axis",
        "existing",
        "foreign-packet",
    ],
)
def test_incomplete_or_misbound_packets_are_refused(
    repo: Path, problem: str, tmp_path: Path
) -> None:
    (repo / "file.txt").write_text("changed\n", encoding="utf-8")
    manifest = prepare(repo)
    run = Path(manifest).parent
    rule = repo / "AGENTS.md"
    rule.write_text("" if problem == "empty-source" else "rule\n", encoding="utf-8")
    source = context(
        run, sources=[str(rule)] * (2 if problem == "duplicate-source" else 1)
    )
    axis = "standards"
    if problem == "no-objective":
        Path(source).write_text(
            serialize(
                {"sources": [], "checks": document(Path(source).read_text())["checks"]}
            )
        )
        axis = "spec"
    if problem == "invalid-axis":
        axis = "other"
    if problem in ("existing", "foreign-packet"):
        packet = prepared(manifest, axis, source)["input"]
        if problem == "foreign-packet":
            foreign = tmp_path / "standards-input.json"
            foreign.write_bytes(Path(packet).read_bytes())
            with pytest.raises(ReviewError, match="another run"):
                read_packet(str(foreign))
            return
    with pytest.raises(ReviewError):
        prepared(manifest, axis, source)
