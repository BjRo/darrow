"""Both unattended host routes allow commits without a commit provider."""

from typing import Literal

import pytest

from conftest import existing
from darrow_artificer import prompts, setup
from darrow_artificer.installation import Installation


@pytest.mark.parametrize("host", ["codex", "claude"])
def test_initial_delivery_uses_native_git(
    installation: Installation, host: Literal["codex", "claude"]
) -> None:
    grant = installation.grant.model_copy(update={"host": host})
    site = Installation(installation.root / host)
    setup.bind(site, grant)
    prompt = prompts.initial(site, existing(site, 41))

    assert (
        "Create intended commits with native Git under repository instructions."
        in prompt
    )
    assert "Git commit and principles providers" not in prompt
    assert "Establish readiness before implementation." in prompt
    assert "selected TDD, independent Review and principles providers" in prompt
    assert "Preserve every required provider and refusal" in prompt
    assert "non-force push and one verified PR" in prompt
    assert "excludes merge, auto-merge, deploy, release, unrelated changes" in prompt
