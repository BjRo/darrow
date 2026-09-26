from __future__ import annotations

import os
from pathlib import Path

import pytest

from conftest import git
from darrow_review import cli, result, scope
from darrow_review.common import ReviewError, command_line, entrypoint, run, serialize
from darrow_review.records import Records
from fixtures import change, result_rows, write


def prepared(repo: Path, *extra: str) -> Records:
    return Records(
        str(
            cli.scope_command(
                [
                    "prepare",
                    "--repo",
                    str(repo),
                    "--base",
                    "HEAD",
                    "--target",
                    "WORKTREE",
                    *extra,
                ]
            )
        )
    )


def test_all_layers_and_scope_binding(
    repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (repo / "file.txt").write_text("staged\n", encoding="utf-8")
    git(repo, "add", ".")
    (repo / "file.txt").write_text("unstaged\n", encoding="utf-8")
    (repo / "unicode-é.txt").write_text("untracked\n", encoding="utf-8")
    before = git(repo, "status", "--porcelain=v1")
    for key in (
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    ):
        monkeypatch.setenv(key, str(tmp_path / "wrong"))
    manifest = prepared(repo)
    assert manifest.value("repository") == str(repo)
    assert manifest.value("layers") == "staged unstaged untracked"
    assert manifest.value("changed_count") == "2"
    patch = cli.scope_command(["show", "--manifest", manifest.value("manifest")])
    assert isinstance(patch, bytes) and b"+untracked" in patch and b"+unstaged" in patch
    source = [
        row for row in result_rows() if row[0] not in ("base", "target", "changed_file")
    ]
    source += result.scope_records(manifest.value("manifest"))
    path = write(tmp_path / "result.json", source)
    assert "matches pinned scope" in cli.result_command(
        ["validate-scope", manifest.value("manifest"), path]
    )
    wrong = write(tmp_path / "wrong.json", change(source, "target", "wrong"))
    with pytest.raises(ReviewError, match="differs from pinned scope"):
        result.validate_scope(manifest.value("manifest"), wrong)
    assert Records(
        cli.result_command(["scope-records", manifest.value("manifest")])
    ).value("base")
    for key in tuple(os.environ):
        if key.startswith("GIT_"):
            monkeypatch.delenv(key)
    assert git(repo, "status", "--porcelain=v1") == before
    only_staged = prepared(repo, "--staged")
    assert only_staged.value("layers") == "staged"
    assert b"+unstaged" not in scope.show(only_staged.value("manifest"))


def test_committed_merge_and_repair(repo: Path) -> None:
    base = git(repo, "rev-parse", "HEAD")
    (repo / "file.txt").write_text("committed\n", encoding="utf-8")
    git(repo, "commit", "-am", "change", "-q")
    data = scope.prepare(scope.ScopeOptions(str(repo), base, "HEAD", merge_base=True))
    assert Records(data).value("layers") == "committed"
    (repo / "file.txt").write_text("repair\n", encoding="utf-8")
    prior = prepared(repo).value("manifest")
    (repo / "file.txt").write_text("committed\n", encoding="utf-8")
    current = prepared(repo, "--allow-empty", "--prior-manifest", prior).value(
        "manifest"
    )
    assert "-+repair" in str(
        cli.scope_command(
            ["compare", "--prior-manifest", prior, "--current-manifest", current]
        )
    )
    with pytest.raises(ReviewError, match="same effective base"):
        scope.compare(Records(data).value("manifest"), current)
    with pytest.raises(ReviewError, match="current effective base"):
        scope.prepare(scope.ScopeOptions(str(repo), base, "HEAD", prior_manifest=prior))
    with pytest.raises(ReviewError, match="resolve to HEAD"):
        scope.prepare(scope.ScopeOptions(str(repo), base, base, staged=True))


def test_scope_refusals_and_tampering(repo: Path, tmp_path: Path) -> None:
    with pytest.raises(ReviewError) as error:
        prepared(repo)
    assert error.value.code == 3
    for options in (
        scope.ScopeOptions(str(repo), "HEAD", "HEAD", allow_empty=True),
        scope.ScopeOptions(str(repo), "missing", "HEAD"),
        scope.ScopeOptions(str(repo), "-bad", "HEAD"),
        scope.ScopeOptions(str(repo)),
    ):
        with pytest.raises(ReviewError):
            scope.prepare(options)
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    manifest = prepared(repo)
    path = manifest.value("manifest")
    for bad_path in ("relative", str(tmp_path / "missing")):
        with pytest.raises(ReviewError):
            scope.show(bad_path)
    Path(manifest.value("diff")).write_bytes(b"tampered")
    with pytest.raises(ReviewError, match="checksum"):
        scope.show(path)
    with pytest.raises(ReviewError, match="cannot validate pinned scope"):
        result.scope_records(path)


def test_scope_identity_records(repo: Path, tmp_path: Path) -> None:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    records = prepared(repo)
    variants = [
        change(records.rows, "changed_count", "2"),
        change(records.rows, "changed_count", "0"),
        change(records.rows, "changed_file", "relative"),
        records.rows,
        records.rows + records.get("changed_file"),
        change(records.rows, "format", "wrong"),
        change(records.rows, "repository", "relative"),
        change(records.rows, "diff", "relative"),
    ]
    for index, variant in enumerate(variants):
        path = tmp_path / f"scope-{index}.json"
        if index == 3:
            path.write_text(
                serialize(variant).replace(
                    '  "base":', '  "base": "duplicate",\n  "base":', 1
                ),
                encoding="utf-8",
            )
        else:
            write(path, variant)
        with pytest.raises(ReviewError):
            result.scope_records(str(path))


def test_fixed_command_from_unrelated_directory(repo: Path, tmp_path: Path) -> None:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    packet = prepared(repo)
    args = entrypoint("review-scope", "show", "--manifest", packet.value("manifest"))
    assert packet.value("show_command") == command_line(args)
    # Execute the retained shell command, not a reconstructed equivalent.
    shell = ["pwsh", "-NoProfile", "-Command"] if os.name == "nt" else ["bash", "-c"]
    shown = run([*shell, packet.value("show_command")], cwd=tmp_path)
    assert shown.returncode == 0, shown.stderr
    assert shown.stdout == Path(packet.value("diff")).read_bytes()


@pytest.mark.parametrize(
    "mutation", ["base", "target", "omitted", "duplicate", "extra"]
)
def test_scope_set_requires_exact_binding(
    repo: Path, tmp_path: Path, mutation: str
) -> None:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    (repo / "extra.txt").write_text("untracked", encoding="utf-8")
    manifest = prepared(repo).value("manifest")
    records = [
        row for row in result_rows() if row[0] not in ("base", "target", "changed_file")
    ]
    records += result.scope_records(manifest)
    original = write(tmp_path / "original.json", [records[0], *reversed(records[1:])])
    result.validate_scope(manifest, original)
    variants = {
        "base": change(records, "base", "wrong"),
        "target": change(records, "target", "wrong"),
        "omitted": [
            row for row in records if row != ["changed_file", str(repo / "extra.txt")]
        ],
        "duplicate": [*records, ["changed_file", str(repo / "extra.txt")]],
        "extra": [*records, ["changed_file", str(tmp_path / "unrelated")]],
    }
    path = write(tmp_path / "changed.json", variants[mutation])
    # Format validity alone cannot prove the scope identity or full file set.
    cli.result_command(["validate", path])
    with pytest.raises(ReviewError) as error:
        result.validate_scope(manifest, path)
    assert error.value.code == 4


@pytest.mark.parametrize(
    "mutation", ["target", "count", "duplicate", "invalid", "file"]
)
def test_incomplete_manifests_never_emit_scope_records(
    repo: Path, tmp_path: Path, mutation: str
) -> None:
    (repo / "file.txt").write_text("changed", encoding="utf-8")
    (repo / "extra.txt").write_text("untracked", encoding="utf-8")
    records = prepared(repo).rows
    variants = {
        "target": [row for row in records if row[0] != "target"],
        "count": [row for row in records if row[0] != "changed_count"],
        "duplicate": records,
        "invalid": change(records, "changed_count", "invalid"),
        "file": [
            row for row in records if row != ["changed_file", str(repo / "extra.txt")]
        ],
    }
    path = tmp_path / "bad.json"
    if mutation == "duplicate":
        path.write_text(
            serialize(records).replace(
                '  "changed_count":',
                '  "changed_count": "2",\n  "changed_count":',
                1,
            ),
            encoding="utf-8",
        )
    else:
        write(path, variants[mutation])
    with pytest.raises(ReviewError):
        cli.result_command(["scope-records", str(path)])


def test_merge_base_excludes_main_only_paths(repo: Path) -> None:
    base = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-qb", "feature")
    (repo / "feature.txt").write_text("feature\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "feature")
    target = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-q", "main")
    (repo / "main.txt").write_text("main\n", encoding="utf-8")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "main")
    packet = Records(
        scope.prepare(scope.ScopeOptions(str(repo), "main", target, merge_base=True))
    )
    assert packet.value("base") == base
    assert packet.value("target") == target
    assert packet.get("changed_file") == [["changed_file", str(repo / "feature.txt")]]
