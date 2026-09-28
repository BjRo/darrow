"""Public exit codes and evidence, through the installed frozen entrypoints."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from conftest import git
from darrow_review.common import entrypoint, serialize
from darrow_review.records import Records
from fixtures import result_record, verification_record, write


def invoke(repo: Path, command: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        entrypoint(command, *args),
        cwd=repo,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )


def check_destination(repo: Path) -> Path:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    prepared = invoke(
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
    assert prepared.returncode == 0, prepared.stderr
    return Path(Records(prepared.stdout).value("manifest")).parent / "check.json"


@pytest.mark.parametrize(
    ("base", "extra", "code", "diagnostic"),
    [
        ("missing", [], 2, "invalid base"),
        ("HEAD", [], 3, "declared review scope is empty"),
        ("HEAD", ["--allow-empty"], 2, "valid only with --prior-manifest"),
    ],
)
def test_scope_exit_codes(
    repo: Path, base: str, extra: list[str], code: int, diagnostic: str
) -> None:
    process = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        base,
        "--target",
        "HEAD",
        *extra,
    )
    assert process.returncode == code
    assert diagnostic in process.stderr
    assert not process.stdout


def test_repair_scope_inherits_prior_base(repo: Path) -> None:
    base = git(repo, "rev-parse", "HEAD")
    (repo / "file.txt").write_text("broken\n", encoding="utf-8")
    git(repo, "commit", "-qam", "broken")
    prior = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--base",
        base,
        "--target",
        "HEAD",
    )
    assert prior.returncode == 0, prior.stderr
    prior_manifest = Records(prior.stdout).value("manifest")
    (repo / "file.txt").write_text("base\n", encoding="utf-8")
    before = git(repo, "status", "--porcelain=v1")
    current = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--target",
        "WORKTREE",
        "--allow-empty",
        "--prior-manifest",
        prior_manifest,
    )
    assert current.returncode == 0, current.stderr
    packet = Records(current.stdout)
    assert packet.value("base") == base
    assert packet.strings("changed_files") == [str(repo / "file.txt")]
    delta = invoke(
        repo,
        "review-scope",
        "compare",
        "--prior-manifest",
        prior_manifest,
        "--current-manifest",
        packet.value("manifest"),
    )
    assert delta.returncode == 0, delta.stderr
    assert "+-broken\n++base\n" in delta.stdout
    assert git(repo, "status", "--porcelain=v1") == before


@pytest.mark.parametrize("operation", ["scope-records", "original-findings"])
@pytest.mark.parametrize("kind", ["missing", "directory"])
def test_invalid_input_produces_no_partial_records(
    repo: Path, operation: str, kind: str
) -> None:
    source = repo / "missing" if kind == "missing" else repo
    process = invoke(repo, "review-result", operation, str(source))
    assert process.returncode != 0
    assert process.stderr
    assert not process.stdout


@pytest.mark.parametrize(
    ("code", "status"), [(0, "pass"), (1, "fail"), (127, "blocked")]
)
def test_check_capture_preserves_status_and_exit_code(
    repo: Path, code: int, status: str
) -> None:
    command = (
        f"Write-Output 'observed'; exit {code}"
        if os.name == "nt"
        else f"printf 'observed\\n'; exit {code}"
    )
    destination = check_destination(repo)
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    assert process.stdout == serialize({"check_record": str(destination)})
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.items("checks") == [
        {
            "command": command,
            "applicability": "applicable",
            "status": status,
            "evidence": f"exited {code}: observed{os.linesep}",
        }
    ]
    assert evidence.value("exit_code") == str(code)


def test_unavailable_command_retains_real_diagnostic(repo: Path) -> None:
    destination = check_destination(repo)
    command = "darrow-command-that-does-not-exist"
    process = invoke(
        repo, "review-check", "run", "--output", str(destination), "--command", command
    )
    assert process.returncode == 0, process.stderr
    evidence = Records(destination.read_text(encoding="utf-8"))
    assert evidence.value("exit_code") == "127"
    check = evidence.items("checks")[0]
    assert check["command"] == command
    assert check["applicability"] == "applicable"
    assert check["status"] == "blocked"
    assert command in check["evidence"]


def test_finalization_reads_scope_and_captured_checks(repo: Path) -> None:
    destination = check_destination(repo)
    capture = invoke(
        repo,
        "review-check",
        "run",
        "--output",
        str(destination),
        "--command",
        "darrow-command-that-does-not-exist",
    )
    assert capture.returncode == 0, capture.stderr
    draft = result_record()
    draft["checks"][0]["evidence"] = "invented summary"
    draft_path = write(destination.parent / "draft.json", draft)
    output = destination.parent / "result.json"
    finalized = invoke(
        repo,
        "review-result",
        "finalize",
        "--manifest",
        str(destination.parent / "scope.json"),
        "--draft",
        draft_path,
        "--check",
        str(destination),
        "--output",
        str(output),
    )
    assert finalized.returncode == 0, finalized.stderr
    actual = Records(output.read_text(encoding="utf-8"))
    manifest = Records((destination.parent / "scope.json").read_text(encoding="utf-8"))
    assert actual.value("base") == manifest.value("base")
    assert actual.value("target") == manifest.value("target")
    assert actual.strings("changed_files") == [str(repo / "file.txt")]
    assert actual.items("checks") == Records(
        destination.read_text(encoding="utf-8")
    ).items("checks")
    assert actual.items("findings") == draft["findings"]
    assert invoke(repo, "review-result", "validate", str(output)).returncode == 0
    rendered = invoke(repo, "review-report", "render", str(output))
    assert rendered.returncode == 0, rendered.stderr
    assert (output.parent / "review.md").read_text(encoding="utf-8") == rendered.stdout


def test_verification_finalization_preserves_external_legacy_findings(
    repo: Path,
) -> None:
    prior_path = check_destination(repo).parent / "scope.json"
    prior = Records(prior_path.read_text(encoding="utf-8"))
    original = verification_record()
    original["original_target"] = prior.value("target")
    finding = original["original_findings"][0]
    finding["key"] = f"spec:1:{prior.value('target')}"
    finding.pop("repair_guidance")
    finding.pop("resolution_evidence")
    source = write(
        prior_path.parent / "handoff.json",
        {
            "original_target": prior.value("target"),
            "original_findings": original["original_findings"],
            "previous_verification": {"checksum": "none", "path": "none"},
        },
    )
    (repo / "file.txt").write_text("base\n", encoding="utf-8")
    current = invoke(
        repo,
        "review-scope",
        "prepare",
        "--repo",
        str(repo),
        "--target",
        "WORKTREE",
        "--prior-manifest",
        str(prior_path),
        "--allow-empty",
    )
    assert current.returncode == 0, current.stderr
    manifest = Records(current.stdout)
    run = Path(manifest.value("manifest")).parent
    assert manifest.value("changed_count") == "0"
    check_path = run / "check.json"
    capture = invoke(
        repo,
        "review-check",
        "run",
        "--output",
        str(check_path),
        "--command",
        "echo checked",
    )
    assert capture.returncode == 0, capture.stderr
    draft = verification_record()
    draft["attempts"][0]["key"] = finding["key"]
    draft["outcome"] = "blocked"
    draft_path = write(run / "draft.json", draft)
    output = run / "verification.json"
    finalized = invoke(
        repo,
        "review-result",
        "finalize",
        "--manifest",
        manifest.value("manifest"),
        "--draft",
        draft_path,
        "--original",
        source,
        "--check",
        str(check_path),
        "--output",
        str(output),
    )
    assert finalized.returncode == 0, finalized.stderr
    record = Records(output.read_text(encoding="utf-8"))
    assert record.items("original_findings") == original["original_findings"]
    assert (
        record.value("original_target")
        == record.value("prior_target")
        == prior.value("target")
    )
    assert record.value("current_target") == manifest.value("target")
    assert record.value("outcome") == "clear"
    assert record.items("checks") == Records(
        check_path.read_text(encoding="utf-8")
    ).items("checks")
    rendered = invoke(repo, "review-report", "render-verification", str(output))
    assert rendered.returncode == 0, rendered.stderr
    assert (run / "verification.md").read_text(encoding="utf-8") == rendered.stdout


def test_renderer_keeps_safe_words_readable_and_hostile_markup_literal(
    repo: Path, tmp_path: Path
) -> None:
    record = result_record()
    record["checks"] = [
        {
            "command": "none",
            "applicability": "not_applicable",
            "status": "not_applicable",
            "evidence": "no configured check",
        }
    ]
    record["findings"][0]["evidence"] = "token_count contains __unsafe__ and <script>"
    source = write(tmp_path / "result.json", record)
    rendered = invoke(repo, "review-report", "render", source)
    assert rendered.returncode == 0, rendered.stderr
    assert "**NOT_APPLICABLE** (not_applicable)" in rendered.stdout
    assert (
        "token_count contains &#95;&#95;unsafe&#95;&#95; and &lt;script&gt;"
        in rendered.stdout
    )


def test_review_state_lifecycle_commands(repo: Path) -> None:
    missing = invoke(
        repo, "review-scope", "locate", "--repo", str(repo), "--target", "unknown"
    )
    assert missing.returncode == 4
    assert "unavailable" in missing.stderr

    (repo / "file.txt").write_text("changed", encoding="utf-8")
    prepared = invoke(
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
    assert prepared.returncode == 0, prepared.stderr
    packet = Records(prepared.stdout)
    manifest = packet.value("manifest")
    located = invoke(
        repo,
        "review-scope",
        "locate",
        "--repo",
        str(repo),
        "--target",
        packet.value("target"),
    )
    assert located.stdout == serialize({"manifest": manifest})

    assert invoke(repo, "review-scope", "pin", "--manifest", manifest).returncode == 0
    pinned_prune = invoke(
        repo, "review-scope", "prune", "--all", "--older-than-days", "0"
    )
    assert pinned_prune.stdout == serialize({"pruned": "0", "removed": []})
    assert Path(manifest).exists()

    assert invoke(repo, "review-scope", "unpin", "--manifest", manifest).returncode == 0
    pruned = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert Records(pruned.stdout).value("pruned") == "1"
    assert not Path(manifest).exists()


def test_terminal_scope_has_private_artifact_directory(repo: Path) -> None:
    terminal = invoke(repo, "review-scope", "allocate-terminal", "--repo", str(repo))
    assert terminal.returncode == 0, terminal.stderr
    run = Path(Records(terminal.stdout).value("artifact_dir"))
    assert run.is_dir()
    assert run.parent.parent == Path(os.environ["DARROW_REVIEW_STATE_DIR"])
    assert not run.is_relative_to(repo)
    manifest = Records(terminal.stdout).value("manifest")
    assert manifest == str(run / "scope.json")
    assert invoke(repo, "review-scope", "pin", "--manifest", manifest).returncode == 0
    preserved = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert preserved.stdout == serialize({"pruned": "0", "removed": []})
    assert run.exists()
    assert invoke(repo, "review-scope", "unpin", "--manifest", manifest).returncode == 0
    pruned = invoke(repo, "review-scope", "prune", "--all", "--older-than-days", "0")
    assert Records(pruned.stdout).value("pruned") == "1"
    assert not run.exists()
