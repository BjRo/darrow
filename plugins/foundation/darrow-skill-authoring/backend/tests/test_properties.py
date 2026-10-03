from __future__ import annotations

import io
import tempfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from darrow_skill_authoring.inspector import run


@settings(max_examples=30, deadline=None)
@given(st.from_regex(r"[a-z][a-z0-9]{0,5}(?:-[a-z0-9]{1,6}){0,3}", fullmatch=True))
def test_valid_portable_names_round_trip_through_inspection(
    name: str,
) -> None:
    with tempfile.TemporaryDirectory() as directory:
        plugin = Path(directory) / "plugin"
        skill = plugin / "skills" / name
        skill.mkdir(parents=True)
        (skill / "SKILL.md").write_text(
            f"---\nname: '{name}'\ndescription: \"A generated valid description.\"\n---\n",
            encoding="utf-8",
        )
        stdout = io.StringIO()
        stderr = io.StringIO()

        status = run(["inspect", str(skill), str(plugin)], stdout=stdout, stderr=stderr)

        assert status == 0
        assert stderr.getvalue() == ""
        assert f"name\t{name}\n" in stdout.getvalue()
