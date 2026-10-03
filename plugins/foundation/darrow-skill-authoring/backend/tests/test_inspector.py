from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest

from darrow_skill_authoring import inspector
from darrow_skill_authoring.inspector import InspectionError, MetadataFormatError, run


def make_skill(root: Path, name: str = "author-release-skill") -> tuple[Path, Path]:
    skill = root / "skills" / name
    (skill / "references").mkdir(parents=True)
    (skill / "scripts").mkdir()
    (skill / "SKILL.md").write_text(
        "---\n"
        f"name: {name}\n"
        "description: Create release workflow skills for repeatable publishing.\n"
        "---\n\n"
        "Read [policy](references/policy.md) before changing safeguards.\n",
        encoding="utf-8",
    )
    (skill / "references" / "policy.md").write_text("# Policy\n", encoding="utf-8")
    (skill / "scripts" / "check-release").write_text("exit 0\n", encoding="utf-8")
    return root, skill


def invoke(*arguments: str) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    status = run(list(arguments), stdout=stdout, stderr=stderr)
    return status, stdout.getvalue(), stderr.getvalue()


def test_valid_skill_reports_absolute_stable_evidence(tmp_path: Path) -> None:
    plugin, skill = make_skill(tmp_path)

    status, output, error = invoke("inspect", str(skill), str(plugin))

    assert status == 0
    assert error == ""
    assert "format\tdarrow-skill-inspection-v1\n" in output
    assert f"plugin_root\t{plugin.resolve()}\n" in output
    assert f"skill_directory\t{skill.resolve()}\n" in output
    assert (
        f"local_reference\t{skill.resolve() / 'references' / 'policy.md'}\n" in output
    )
    assert (
        f"bundled_script\t{skill.resolve() / 'scripts' / 'check-release'}\n" in output
    )
    assert output.endswith("status\tvalid\n")


@pytest.mark.parametrize("value", ["true", "false"])
def test_optional_invocation_boolean_is_accepted(tmp_path: Path, value: str) -> None:
    plugin, skill = make_skill(tmp_path)
    path = skill / "SKILL.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            "description:", f"disable-model-invocation: {value}\ndescription:"
        ),
        encoding="utf-8",
    )

    assert invoke("inspect", str(skill), str(plugin))[0] == 0


@pytest.mark.parametrize(
    ("frontmatter", "message"),
    [
        (
            "name: author-release-skill\ndescription: valid\nunknown: true",
            "frontmatter must contain",
        ),
        (
            "name: author-release-skill\ndescription: valid\n"
            "disable-model-invocation: sometimes",
            "frontmatter must contain",
        ),
        (
            "name: author-release-skill\ndescription: valid\n"
            "disable-model-invocation: true\ndisable-model-invocation: false",
            "frontmatter must contain",
        ),
        (
            'name: "author-release-skill\ndescription: valid',
            "unmatched double quote",
        ),
        ("name: different-name\ndescription: valid", "does not match directory"),
    ],
)
def test_malformed_metadata_fails_closed(
    tmp_path: Path, frontmatter: str, message: str
) -> None:
    plugin, skill = make_skill(tmp_path)
    (skill / "SKILL.md").write_text(f"---\n{frontmatter}\n---\n", encoding="utf-8")

    status, _, error = invoke("inspect", str(skill), str(plugin))

    assert status == 2
    assert message in error
    assert str(skill.resolve() / "SKILL.md") in error


def test_missing_inputs_report_absolute_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    status, _, skill_error = invoke("inspect", "missing", ".")
    assert status == 2
    assert str(tmp_path / "missing" / "SKILL.md") in skill_error

    status, _, plugin_error = invoke("inspect", ".", "missing-plugin")
    assert status == 2
    assert str(tmp_path / "missing-plugin") in plugin_error


def test_skill_and_references_cannot_escape_plugin(tmp_path: Path) -> None:
    plugin = tmp_path / "plugin"
    external, skill = make_skill(tmp_path / "external")
    plugin.mkdir()

    status, _, error = invoke("inspect", str(skill), str(plugin))
    assert status == 2
    assert "skill directory escapes plugin root" in error

    plugin, skill = make_skill(tmp_path / "contained")
    (skill / "SKILL.md").write_text(
        (skill / "SKILL.md").read_text(encoding="utf-8")
        + "Read [outside](../../../outside.md).\n",
        encoding="utf-8",
    )
    (tmp_path / "outside.md").write_text("outside\n", encoding="utf-8")
    status, _, error = invoke("inspect", str(skill), str(plugin))
    assert status == 2
    assert "local reference escapes plugin root" in error
    assert external.exists()


def test_symlinked_skill_and_reference_are_rejected(tmp_path: Path) -> None:
    if not hasattr(os, "symlink"):
        pytest.skip("symbolic links are unavailable")
    plugin, skill = make_skill(tmp_path / "plugin")
    external = tmp_path / "external.md"
    external.write_text("outside\n", encoding="utf-8")
    reference = skill / "references" / "policy.md"
    reference.unlink()
    try:
        reference.symlink_to(external)
    except OSError:
        pytest.skip("symbolic links are unavailable")

    status, _, error = invoke("inspect", str(skill), str(plugin))
    assert status == 2
    assert "local reference must not be a symbolic link" in error

    linked_skill = plugin / "skills" / "linked-skill"
    linked_skill.mkdir()
    (linked_skill / "SKILL.md").symlink_to(skill / "SKILL.md")
    status, _, error = invoke("inspect", str(linked_skill), str(plugin))
    assert status == 2
    assert "skill file must not be a symbolic link" in error


def test_reported_symlinks_are_rejected_on_hosts_without_symlink_creation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    plugin, skill = make_skill(tmp_path)
    skill_file = skill / "SKILL.md"
    reference = skill / "references" / "policy.md"
    original = Path.is_symlink

    def report_skill(path: Path) -> bool:
        return path == skill_file or original(path)

    monkeypatch.setattr(Path, "is_symlink", report_skill)
    with pytest.raises(InspectionError, match="skill file must not be a symbolic link"):
        inspector._read_skill(skill)

    def report_reference(path: Path) -> bool:
        return path == reference or original(path)

    monkeypatch.setattr(Path, "is_symlink", report_reference)
    with pytest.raises(
        InspectionError, match="local reference must not be a symbolic link"
    ):
        inspector._local_reference("references/policy.md", skill, plugin)


def test_space_bearing_relative_paths_work_outside_skill(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    plugin, skill = make_skill(tmp_path / "plugin with spaces")
    monkeypatch.chdir(tmp_path)

    status, output, _ = invoke(
        "inspect", str(skill.relative_to(tmp_path)), str(plugin.relative_to(tmp_path))
    )

    assert status == 0
    assert f"skill_directory\t{skill.resolve()}" in output


def test_usage_and_argument_errors_keep_exit_two(tmp_path: Path) -> None:
    assert invoke()[0:2] == (2, "")
    assert "Usage: inspect-skill" in invoke()[2]
    status, _, error = invoke("inspect", str(tmp_path))
    assert status == 2
    assert error == "inspect-skill: inspect requires SKILL_DIRECTORY and PLUGIN_ROOT\n"


@pytest.mark.parametrize(
    "text",
    [
        "",
        "name: missing-delimiters",
        "---\nname: missing-end",
        "---\nname: missing-description\n---\n",
        "---\nname: duplicate\nname: duplicate\ndescription: valid\n---\n",
    ],
)
def test_frontmatter_parser_rejects_incomplete_shapes(text: str) -> None:
    with pytest.raises(MetadataFormatError):
        inspector._parse_frontmatter(text)


def test_frontmatter_comments_and_blank_lines_are_ignored() -> None:
    metadata = inspector._parse_frontmatter(
        "---\n# host-neutral fields\n\nname: valid-name\ndescription: valid\n---\n"
    )
    assert metadata == inspector.Metadata("valid-name", "valid")


@pytest.mark.parametrize("name", ["Upper", "-leading", "trailing-", "two--hyphens"])
def test_invalid_portable_names_are_rejected(tmp_path: Path, name: str) -> None:
    skill = tmp_path / "valid-directory"
    skill.mkdir()
    with pytest.raises(InspectionError, match="lower-case letters"):
        inspector._validate_metadata(inspector.Metadata(name, "valid"), skill)


def test_empty_description_and_unmatched_single_quote_are_rejected(
    tmp_path: Path,
) -> None:
    skill = tmp_path / "valid-directory"
    skill.mkdir()
    with pytest.raises(InspectionError, match="description is empty"):
        inspector._validate_metadata(inspector.Metadata("valid-directory", ""), skill)
    with pytest.raises(InspectionError, match="unmatched single quote"):
        inspector._validate_metadata(
            inspector.Metadata("valid-directory", "'unfinished"), skill
        )


@pytest.mark.parametrize(
    "target", ["", "#section", "https://example.test", "mailto:a@b"]
)
def test_nonlocal_links_are_ignored(target: str) -> None:
    assert inspector._portable_target(target) is None


@pytest.mark.parametrize(
    "target", ["/absolute/path", r"C:\absolute\path", r"references\policy.md", "C:file"]
)
def test_nonportable_local_links_are_rejected(target: str) -> None:
    with pytest.raises(InspectionError, match="portable relative paths"):
        inspector._portable_target(target)


def test_angle_wrapped_link_loses_anchor() -> None:
    assert inspector._portable_target("<references/policy.md#rule>") == (
        "references/policy.md"
    )


def test_missing_reference_parent_and_file_are_distinct(tmp_path: Path) -> None:
    plugin, skill = make_skill(tmp_path)
    with pytest.raises(InspectionError, match="parent is not readable"):
        inspector._local_reference("missing/policy.md", skill, plugin)
    with pytest.raises(InspectionError, match="not a readable regular file"):
        inspector._local_reference("references/missing.md", skill, plugin)


def test_skill_without_scripts_has_empty_inventory(tmp_path: Path) -> None:
    plugin, skill = make_skill(tmp_path)
    for path in (skill / "scripts").iterdir():
        path.unlink()
    (skill / "scripts").rmdir()
    assert inspector._bundled_scripts(skill) == []
    assert plugin.exists()


def test_non_directory_scripts_path_is_rejected(tmp_path: Path) -> None:
    _, skill = make_skill(tmp_path)
    for path in (skill / "scripts").iterdir():
        path.unlink()
    (skill / "scripts").rmdir()
    (skill / "scripts").write_text("invalid\n", encoding="utf-8")
    with pytest.raises(
        InspectionError, match="scripts path is not a readable directory"
    ):
        inspector._bundled_scripts(skill)


def test_walk_failure_is_translated(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, skill = make_skill(tmp_path)

    def fail_walk(_: Path) -> list[Path]:
        raise OSError

    monkeypatch.setattr(inspector, "_walk_scripts", fail_walk)
    with pytest.raises(InspectionError, match="cannot enumerate bundled scripts"):
        inspector._bundled_scripts(skill)


def test_invalid_utf8_skill_is_rejected(tmp_path: Path) -> None:
    _, skill = make_skill(tmp_path)
    (skill / "SKILL.md").write_bytes(b"\xff")
    with pytest.raises(InspectionError, match="not a readable regular file"):
        inspector._read_skill(skill)


def test_directory_resolution_failure_is_translated(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = Path.resolve

    def fail_selected(path: Path, strict: bool = False) -> Path:
        if path == tmp_path:
            raise OSError
        return original(path, strict=strict)

    monkeypatch.setattr(Path, "resolve", fail_selected)
    with pytest.raises(InspectionError, match="cannot resolve plugin root"):
        inspector._readable_directory(str(tmp_path), "plugin root")


def test_entrypoint_returns_run_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["inspect-skill"])
    with pytest.raises(SystemExit) as raised:
        inspector.entrypoint()
    assert raised.value.code == 2
