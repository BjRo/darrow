"""Release eval checks reject metadata and reachability counterexamples."""

import subprocess
from pathlib import Path

import pytest
from eval_release_skill import metadata, native_release, resident_intent, skills


@pytest.mark.parametrize("value", ["Release a build", '"true"', "'quoted string'"])
def test_string_metadata(tmp_path: Path, value: str) -> None:
    path = tmp_path / "SKILL.md"
    path.write_text(f"---\nname: release-build\ndescription: {value}\n---\n")
    metadata(path)


@pytest.mark.parametrize(
    "value", ["", "null", "~", "true", "123", "[]", "{}", '""', "''"]
)
def test_non_string_metadata_is_rejected(tmp_path: Path, value: str) -> None:
    path = tmp_path / "SKILL.md"
    path.write_text(f"---\nname: release-build\ndescription: {value}\n---\n")
    with pytest.raises(AssertionError):
        metadata(path)


def test_resident_route_must_bind_intent_and_exact_path() -> None:
    target = "skills/release-build/SKILL.md"
    assert resident_intent(f"Read {target} when publishing a release.", target)
    assert not resident_intent(f"See {target}\nRead release instructions.", target)
    assert not resident_intent("Read skills/other/SKILL.md for releases.", target)


@pytest.mark.parametrize("header", ["|", ">", "|-", ">+", "|2", ">-2"])
def test_block_description_requires_nonempty_content(
    tmp_path: Path, header: str
) -> None:
    path = tmp_path / "SKILL.md"
    template = f"---\nname: release-build\ndescription: {header}\n"
    path.write_text(template + "  \n---\n")
    with pytest.raises(AssertionError):
        metadata(path)
    path.write_text(template + "  Release the build.\n---\n")
    metadata(path)


def test_native_loader_requires_visible_complete_procedure(tmp_path: Path) -> None:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    path = tmp_path / ".agents/skills/release/SKILL.md"
    path.parent.mkdir(parents=True)
    path.write_text(
        "preflight package.json build-release dist/checksums.txt tools/publish"
    )
    assert not native_release(tmp_path, ".agents/skills")
    path.write_text(path.read_text() + " explicit confirmation")
    assert native_release(tmp_path, ".agents/skills")
    (tmp_path / ".gitignore").write_text(".agents/\n")
    assert not native_release(tmp_path, ".agents/skills")


def test_skill_walk_handles_spaces_and_symlink_cycles(tmp_path: Path) -> None:
    directory = tmp_path / "release skill"
    directory.mkdir()
    path = directory / "SKILL.md"
    path.write_text("release")
    try:
        (directory / "cycle").symlink_to(tmp_path, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks are unavailable on this host")
    assert skills(tmp_path) == [path]
