from pathlib import Path
from uuid import uuid4

import pytest

from darrow_artificer.installation import Installation
from darrow_artificer.models import Grant
from darrow_artificer.storage import write_object


@pytest.fixture
def installation(tmp_path: Path) -> Installation:
    site = Installation(tmp_path / "state")
    site.save_grant(
        Grant(
            id=str(uuid4()),
            repository="owner/repo",
            checkout=str(tmp_path),
            common_git=str(tmp_path / ".git"),
            grantor="maintainer",
            codex="/bin/false",
            gh="/bin/false",
            git="/usr/bin/git",
            model="gpt-5.6-terra",
            effort="medium",
            credential_home=str(tmp_path / "credentials"),
            subscription_only_confirmed=True,
            effects="claims,questions,worktrees,recipe,commits,push,pr,archives",
        )
    )
    write_object(
        tmp_path / ".git/artificer/installation.json",
        {"root": str(site.root), "grant": site.grant.id},
    )
    return site
