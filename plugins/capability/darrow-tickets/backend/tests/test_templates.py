"""Installed issue templates are additive and remain repository-owned."""

import subprocess
from pathlib import Path

import pytest

from darrow_tickets.templates import main


def repository(root: Path) -> Path:
    root.mkdir()
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    return root


def test_install_and_inspect_all_three_templates(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo with spaces")
    target = root / ".github" / "ISSUE_TEMPLATE"
    target.mkdir(parents=True)
    (target / "config.yml").write_text("blank_issues_enabled: false\n")

    assert main(["install", "--repo", str(root)]) == 0
    output = capsys.readouterr().out
    for kind in ("dependency-upgrade", "retirement", "bug-fix-regression"):
        path = target / f"{kind}.md"
        assert path.is_file()
        assert f"created: {path}" in output
        assert "name:" in path.read_text()
        assert "about:" in path.read_text()
        assert main(["show", "--repo", str(root), "--file", f"{kind}.md"]) == 0
        shown = capsys.readouterr().out
        assert f"path: {path}" in shown
        assert "status: installed" in shown
        assert path.read_text() in shown
    assert (target / "config.yml").read_text() == "blank_issues_enabled: false\n"

    assert main(["install", "--repo", str(root)]) == 0
    second = capsys.readouterr().out
    assert second.count("unchanged:") == 3


def test_customization_is_preserved_and_shown(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo")
    target = root / ".github" / "ISSUE_TEMPLATE"
    target.mkdir(parents=True)
    customized = target / "dependency-upgrade.md"
    customized.write_text("local compatibility check\n")

    assert main(["install", "--repo", str(root)]) == 0
    assert f"preserved: {customized}" in capsys.readouterr().out
    assert customized.read_text() == "local compatibility check\n"
    assert main(["show", "--repo", str(root), "--file", "dependency-upgrade.md"]) == 0
    assert "local compatibility check" in capsys.readouterr().out


def test_install_refuses_case_variant_without_partial_installation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo")
    target = root / ".github" / "ISSUE_TEMPLATE"
    target.mkdir(parents=True)
    existing = target / "Dependency-Upgrade.MD"
    existing.write_text("custom upgrade\n")

    assert main(["install", "--repo", str(root)]) == 2
    output = capsys.readouterr()
    assert not output.out
    assert f"case-variant template blocks installation: {existing}" in output.err
    assert existing.read_text() == "custom upgrade\n"
    assert not any(path.name == "dependency-upgrade.md" for path in target.iterdir())
    assert not (target / "retirement.md").exists()


def test_missing_installed_template_never_falls_back_to_bundle(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo")
    assert main(["show", "--repo", str(root), "--file", "retirement.md"]) == 0
    output = capsys.readouterr().out
    assert "status: missing" in output
    assert "name:" not in output
    assert not (root / ".github").exists()


def test_user_defined_markdown_and_yaml_forms_are_discoverable(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo")
    target = root / ".github" / "ISSUE_TEMPLATE"
    target.mkdir(parents=True)
    markdown = target / "security-hardening.md"
    markdown.write_text(
        "---\nname: Security hardening\nabout: Reduce exposed surface\n---\n"
    )
    form = target / "upgrade-service.yml"
    form.write_text(
        "name: Service upgrade\ndescription: Update a service safely\nbody: []\n"
    )
    (target / "config.yml").write_text("blank_issues_enabled: false\n")

    assert main(["list", "--repo", str(root)]) == 0
    listing = capsys.readouterr().out
    assert "security-hardening.md" in listing
    assert "Security hardening" in listing
    assert "upgrade-service.yml" in listing
    assert "Service upgrade" in listing
    assert "config.yml" not in listing
    assert main(["show", "--repo", str(root), "--file", "upgrade-service.yml"]) == 0
    assert form.read_text() in capsys.readouterr().out


def test_show_rejects_path_traversal(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = repository(tmp_path / "repo")
    assert main(["show", "--repo", str(root), "--file", "../secret.md"]) == 2
    assert "filename" in capsys.readouterr().err


def test_install_refuses_non_repository_and_symlink_directory(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    ordinary = tmp_path / "ordinary"
    ordinary.mkdir()
    assert main(["install", "--repo", str(ordinary)]) == 2
    assert "repository" in capsys.readouterr().err

    root = repository(tmp_path / "repo")
    outside = tmp_path / "outside"
    outside.mkdir()
    (root / ".github").symlink_to(outside, target_is_directory=True)
    assert main(["install", "--repo", str(root)]) == 2
    assert "symlink" in capsys.readouterr().err
    assert not list(outside.iterdir())
