from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


def hook_command(host: str, plugin: Path) -> list[str]:
    executable = (
        shutil.which("bash")
        if host == "bash"
        else (shutil.which("pwsh") or shutil.which("powershell.exe"))
    )
    if executable is None:
        pytest.skip(f"{host} is not installed")
    if host == "bash":
        return [executable, str(plugin / "hooks/session-start.sh")]
    return [
        executable,
        "-NoProfile",
        "-NonInteractive",
        "-File",
        str(plugin / "hooks/session-start.ps1"),
    ]


@pytest.mark.parametrize("host", ["bash", "powershell"])
def test_session_hint_resolves_its_installed_skill_from_another_cwd(
    tmp_path: Path, host: str
) -> None:
    plugin = tmp_path / "plugin with ' quotes"
    source = Path(__file__).resolve().parents[2]
    shutil.copytree(source / "hooks", plugin / "hooks")
    skill = plugin / "skills/code-review/SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("Complete skill fixture.\n", encoding="utf-8")
    invocation = hook_command(host, plugin)
    result = subprocess.run(
        invocation,
        cwd=tmp_path,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert result.returncode == 0, result.stderr
    prefix = "DARROW_REVIEW_SKILL_PATH_V1: For matching review or repair-verification requests, read this complete skill file: "
    first_line = result.stdout.splitlines()[0]
    assert first_line.startswith(prefix)
    reported_skill = first_line.removeprefix(prefix)
    if host == "bash":
        # Compare file identity in the shell that owns this path notation (MSYS on Windows).
        identity = subprocess.run(
            [
                invocation[0],
                "-c",
                'test "$1" -ef "$2"',
                "_",
                reported_skill,
                str(skill),
            ],
            cwd=tmp_path,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        assert identity.returncode == 0, identity.stderr
    else:
        assert Path(reported_skill).resolve(strict=True) == skill.resolve()
    assert "DARROW_REVIEW_SESSION_HINT_V1:" in result.stdout
    assert "matching" in result.stdout
    skill.unlink()
    missing = subprocess.run(
        invocation, cwd=tmp_path, capture_output=True, text=True, check=False
    )
    assert missing.returncode != 0
    assert "DARROW_REVIEW_SKILL_PATH_V1:" not in missing.stdout
