"""Repair-fixture records survive setup teardown without changing input or product."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import git
from darrow_review import cli, eval_fixture, result
from darrow_review.common import ReviewError, document, read_text, serialize
from darrow_review.records import validate_result
from darrow_review.verification import validate_verification

ASSETS = Path(__file__).resolve().parents[2] / "skills/code-review/evals/fixtures"


def broken(repo: Path) -> str:
    (repo / "file.txt").write_text("broken\n")
    git(repo, "add", "file.txt")
    git(repo, "commit", "-qm", "broken")
    revision = git(repo, "rev-parse", "HEAD")
    (repo / "file.txt").write_text("repaired\n")
    return revision


def input_record(repo: Path, revision: str) -> dict[str, object]:
    value: dict[str, object] = {
        "original_target": revision,
        "prior_target": revision,
        "previous_verification": {"checksum": "none", "path": "none"},
        "original_findings": [{"key": f"spec:1:{revision}", "evidence": "broken"}],
    }
    eval_fixture.write(repo / ".git/verification-input", value)
    return value


def receipt(repo: Path, mode: str) -> dict[str, object]:
    return document(read_text(eval_fixture.initialize(repo, mode).strip()))


def test_first_round_preserves_inputs_and_product(repo: Path) -> None:
    revision = broken(repo)
    value = input_record(repo, revision)
    immutable = (repo / ".git/verification-input").read_bytes()
    initialized = receipt(repo, "first")
    manifest = Path(str(initialized["prior_manifest"]))
    assert not manifest.is_relative_to(repo)
    assert document(read_text(manifest))["target"] == revision
    assert initialized["original_findings"] == value["original_findings"]
    assert (repo / ".git/verification-input").read_bytes() == immutable
    assert (repo / "file.txt").read_text() == "repaired\n"


def test_authored_review_rebinds_paths_and_complete_findings(repo: Path) -> None:
    revision = broken(repo)
    value = input_record(repo, revision)
    template = eval_fixture.authored(
        read_text(ASSETS / "name-trim-review.fixture.json"), {"repo": str(repo)}
    )
    template.update(
        base=git(repo, "rev-parse", "HEAD^"),
        target=revision,
        changed_files=[str(repo / "file.txt")],
    )
    value["original_findings"] = result.original_findings(
        validate_result(serialize(template))
    )
    eval_fixture.write(repo / ".git/verification-input", value)
    shutil.copyfile(
        ASSETS / "name-trim-review.fixture.json",
        repo / ".git/fixture-name-trim-template.json",
    )
    initialized = receipt(repo, "first")
    review = validate_result(read_text(str(initialized["original_result"])))
    assert review.value("target") == revision
    assert review.items("findings") == validate_result(serialize(template)).items(
        "findings"
    )
    assert result.original_findings(review) == value["original_findings"]


def test_second_round_reconstructs_valid_checksum_bound_previous_state(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    revision = broken(repo)
    setup_home = tmp_path / "setup-state"
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(setup_home))
    eval_fixture.seed_second(repo, ASSETS / "second-round-verification.fixture.json")
    immutable = (repo / ".git/verification-input").read_bytes()
    shutil.rmtree(setup_home)
    monkeypatch.setenv("DARROW_REVIEW_STATE_DIR", str(tmp_path / "actor-state"))
    initialized = receipt(repo, "second")
    prev = initialized["previous_verification"]
    assert isinstance(prev, dict)
    path = str(prev["path"])
    previous = validate_verification(read_text(path))
    assert previous.value("current_target") == revision
    assert previous.items("regressions")[0]["key"] == initialized["regression_key"]
    assert previous.items("regressions")[0]["status"] == "unresolved"
    assert prev["checksum"] == git(repo, "hash-object", "--no-filters", path)
    assert Path(path).is_relative_to(tmp_path / "actor-state")
    assert (repo / ".git/verification-input").read_bytes() == immutable
    assert (repo / "file.txt").read_text() == "repaired\n"


@pytest.mark.parametrize("mutation", ["prior", "previous", "findings"])
def test_first_round_refuses_inconsistent_original_evidence(
    repo: Path, mutation: str
) -> None:
    value = input_record(repo, broken(repo))
    if mutation == "prior":
        value["prior_target"] = "different"
    elif mutation == "previous":
        value["previous_verification"] = {"path": "old", "checksum": "old"}
    else:
        shutil.copyfile(
            ASSETS / "name-trim-review.fixture.json",
            repo / ".git/fixture-name-trim-template.json",
        )
    eval_fixture.write(repo / ".git/verification-input", value)
    with pytest.raises(ReviewError):
        receipt(repo, "first")


def test_command_and_second_round_refusals(repo: Path) -> None:
    broken(repo)
    with pytest.raises(ReviewError, match="requires an authored template"):
        eval_fixture.command(["seed-second", "--repo", str(repo)])
    eval_fixture.command(
        [
            "seed-second",
            "--repo",
            str(repo),
            "--template",
            str(ASSETS / "second-round-verification.fixture.json"),
        ]
    )
    value = document(read_text(repo / ".git/verification-input"))
    record = value["previous_record"]
    assert isinstance(record, dict)
    record["current_target"] = "different"
    eval_fixture.write(repo / ".git/verification-input", value)
    with pytest.raises(ReviewError, match="previous target mismatch"):
        eval_fixture.command(["second", "--repo", str(repo)])
    with pytest.raises(ReviewError, match="must be an object"):
        eval_fixture.serialize_document([])
    with pytest.raises(ReviewError, match="requires one causal chain"):
        record["current_target"] = git(repo, "rev-parse", "HEAD")
        record["regressions"] = []
        record["outcome"] = "clear"
        record["checks"] = [
            {
                "command": "bash check.sh",
                "applicability": "applicable",
                "status": "pass",
                "evidence": "exit 0",
            }
        ]
        template = repo / ".git/empty-chain.json"
        eval_fixture.write(template, record)
        eval_fixture.seed_second(repo, template)


@pytest.mark.parametrize("shell", ["bash", "/bin/bash"])
@pytest.mark.parametrize("mount", [".agents", ".sevro-marketplace/plugin"])
def test_copied_plugin_launchers_keep_records_private(
    repo: Path,
    tmp_path: Path,
    shell: str,
    mount: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    revision = broken(repo)
    input_record(repo, revision)
    plugin = ASSETS.parents[3]
    destination = repo / mount
    for name in (
        "backend/src",
        "backend/scripts",
        "backend/pyproject.toml",
        "backend/uv.lock",
        ".claude-plugin/plugin.json",
        ".codex-plugin/plugin.json",
    ):
        source, copied = plugin / name, destination / name
        copied.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir():
            shutil.copytree(source, copied)
        else:
            shutil.copyfile(source, copied)
    home = tmp_path / "actor-home"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.delenv("DARROW_REVIEW_STATE_DIR")
    environment = dict(os.environ, UV_PYTHON=sys.executable)
    immutable = (repo / ".git/verification-input").read_bytes()
    first = subprocess.run(
        [shell, str(ASSETS / "initialize-prior-input.sh")],
        cwd=repo,
        env=environment,
        capture_output=True,
        text=True,
        check=True,
    )
    initialized = document(read_text(first.stdout.strip()))
    assert Path(str(initialized["prior_manifest"])).is_relative_to(home)
    assert (repo / ".git/verification-input").read_bytes() == immutable
    eval_fixture.seed_second(repo, ASSETS / "second-round-verification.fixture.json")
    immutable = (repo / ".git/verification-input").read_bytes()
    prior = subprocess.run(
        [shell, str(ASSETS / "initialize-second-round-input.sh")],
        cwd=repo,
        env=environment,
        capture_output=True,
        text=True,
        check=True,
    )
    initialized = document(read_text(prior.stdout.strip()))
    previous = initialized["previous_verification"]
    assert isinstance(previous, dict)
    assert Path(str(previous["path"])).is_relative_to(home)
    assert (
        validate_verification(read_text(str(previous["path"]))).value("current_target")
        == revision
    )
    assert (repo / ".git/verification-input").read_bytes() == immutable
    assert (repo / "file.txt").read_text() == "repaired\n"


def test_cli_first_round(repo: Path) -> None:
    input_record(repo, broken(repo))
    assert Path(eval_fixture.command(["first", "--repo", str(repo)]).strip()).is_file()
    assert (
        json.loads((repo / ".git/verification-input").read_text())[
            "previous_verification"
        ]["path"]
        == "none"
    )


def test_second_round_setup_prepares_complete_regression_only_reader_input(
    repo: Path,
) -> None:
    broken(repo)
    eval_fixture.command(
        [
            "seed-second",
            "--repo",
            str(repo),
            "--template",
            str(ASSETS / "second-round-verification.fixture.json"),
        ]
    )
    handoff = eval_fixture.command(["second", "--repo", str(repo)]).strip()
    value = document(read_text(handoff))
    scope_output = cli.scope_command(
        [
            "prepare",
            "--repo",
            str(repo),
            "--target",
            "WORKTREE",
            "--allow-empty",
            "--prior-manifest",
            str(value["prior_manifest"]),
        ]
    )
    assert isinstance(scope_output, str)
    prepared = document(scope_output)
    reader = document(
        cli.result_command(
            [
                "prepare-reader",
                "--manifest",
                str(prepared["manifest"]),
                "--axis",
                "standards",
                "--original",
                handoff,
                "--attempted-from-input",
                "--no-checks-reason",
                "This input-preparation fixture has no configured checks.",
            ]
        )
    )
    packet = document(
        cli.result_command(["read-reader", "--input", str(reader["input"])])
    )
    repair = packet["repair"]
    assert isinstance(repair, dict)
    assert repair["attempted"] == []
    previous = value["previous_record"]
    assert isinstance(previous, dict)
    assert repair["original_findings"] == previous["original_findings"]
    assert repair["regressions"] == previous["regressions"]
