import time
from pathlib import Path
from uuid import uuid4

import pytest

from darrow_artificer import setup
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim, Grant


@pytest.fixture
def installation(tmp_path: Path) -> Installation:
    site = Installation(tmp_path / "state")
    grant = Grant(
        id=str(uuid4()),
        repository="owner/repo",
        checkout=str(tmp_path),
        common_git=str(tmp_path / ".git"),
        grantor="maintainer",
        executable="/bin/false",
        gh="/bin/false",
        git="/usr/bin/git",
        effects="claims,reports,worktrees,recipe,commits,push,pr",
    )
    setup.bind(site, grant)
    return site


def existing(site: Installation, issue: int) -> Claim:
    claim = Claim(
        id=str(uuid4()),
        issue=issue,
        activation="old",
        grant=site.grant.id,
        worktree="/unused",
        branch="old",
        created_at=time.time(),
    )
    site.save(claim)
    return claim
