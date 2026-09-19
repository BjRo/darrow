import os
import time
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from darrow_artificer import archive, operations, processes, reconciliation
from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation
from darrow_artificer.models import Native
from test_admission import existing
from test_native import rollout
from test_reconciliation import Replies, waiting


def test_expiry_retains_claim(installation: Installation) -> None:
    claim = waiting(installation)
    claim.saved_at = time.time() - 6 * 86400
    operations.expire(installation, claim)
    assert not (installation.delivery_dir(claim.id) / "session.enc").exists()
    assert installation.claim(claim.id).status == "needs-attention"
    assert len(installation.claims()) == 1


def test_expired_archive_does_not_disable_pr_completion(
    installation: Installation,
) -> None:
    claim = waiting(installation)
    claim.saved_at = time.time() - 6 * 86400
    claim.status, claim.pr = "pr-open", 12
    installation.save(claim)
    operations.expire(installation, claim)
    assert installation.claim(claim.id).status == "pr-open"
    assert not (installation.delivery_dir(claim.id) / "session.enc").exists()
    forge = Replies()
    reconciliation.reconcile(installation, forge, lambda site, claim: None)
    assert not forge.released
    forge.pr_state = "closed"
    reconciliation.reconcile(installation, forge, lambda site, claim: None)
    assert installation.claim(claim.id).status == "released"
    assert forge.released == [1]


def test_nonexpired_and_running_snapshots(installation: Installation) -> None:
    claim = waiting(installation)
    operations.expire(installation, claim)
    assert (installation.delivery_dir(claim.id) / "session.enc").exists()
    claim.saved_at = None
    operations.expire(installation, claim)
    claim.saved_at = 1
    claim.process = processes.identity(os.getpid())
    operations.expire(installation, claim)
    assert (installation.delivery_dir(claim.id) / "session.enc").exists()
    claim.process, claim.status = None, "cancelled"
    operations.expire(installation, claim)
    assert installation.claim(claim.id).status == "cancelled"


def test_cancel_one_and_revoke(installation: Installation) -> None:
    first, second = existing(installation, 1), existing(installation, 2)
    assert operations.cancel(installation, first.id).status == "cancelled"
    assert installation.claim(second.id).status == "question"
    first.status = "released"
    installation.save(first)
    with pytest.raises(ValueError, match="already released"):
        operations.cancel(installation, first.id)
    operations.revoke(installation)
    assert installation.grant.enabled is False
    assert operations.tick(installation) == []


def test_failed_cancellation_does_not_claim_execution_stopped(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    claim = existing(installation, 1)

    def refuse(process: object) -> None:
        raise RuntimeError("orphaned execution needs reconciliation")

    monkeypatch.setattr(processes, "cancel_process", refuse)
    with pytest.raises(RuntimeError, match="orphaned"):
        operations.cancel(installation, claim.id)
    retained = installation.claim(claim.id)
    assert retained.status == "needs-attention"
    assert "not confirmed" in retained.detail
    assert len(installation.claims()) == 1


def test_recovery_preserves_native_identity(installation: Installation) -> None:
    (installation.root / "archive.key").write_bytes(Fernet.generate_key())
    claim = existing(installation, 1)
    home = installation.delivery_dir(claim.id) / "native"
    rollout(home, "parent")
    rollout(home, "child", "parent", "/root/owner")
    result = operations.recover(installation, claim.id, "parent", "/root/owner")
    assert result.status == "needs-attention" and result.native is not None
    assert result.attention_since is not None and result.saved_at is not None
    assert (installation.delivery_dir(claim.id) / "session.enc").is_file()
    original = result.native
    result.native = Native(**{**original.model_dump(), "owner_model": "different"})
    installation.save(result)
    with pytest.raises(ValueError, match="preserve"):
        operations.recover(installation, claim.id, "parent", "/root/owner")
    result.status = "released"
    installation.save(result)
    with pytest.raises(ValueError, match="running or released"):
        operations.recover(installation, claim.id, "parent", "/root/owner")


def test_installation_refuses_wrong_binding(installation: Installation) -> None:
    from darrow_artificer.storage import write_object

    write_object(
        Path(installation.grant.common_git) / "artificer/installation.json", {}
    )
    with pytest.raises(ValueError, match="different"):
        installation.verify_binding()
    with pytest.raises(ValueError):
        installation.claim_path("../other")
    with pytest.raises(ValueError, match="canonical"):
        installation.claim_path("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA")
    claim = existing(installation, 1)
    claim.grant = "wrong"
    installation.save(claim)
    with pytest.raises(ValueError, match="correlation"):
        installation.claim(claim.id)


def test_model_free_paused_tick_and_revoked_permission(
    installation: Installation, monkeypatch: pytest.MonkeyPatch
) -> None:
    grant = installation.grant
    grant.WORK_IN_PROGRESS_LIMIT = 0
    installation.save_grant(grant)
    monkeypatch.setattr(GitHub, "writable", lambda self, user: True)
    monkeypatch.setattr(GitHub, "issues", lambda self, label, state: [])
    waiting(installation)
    monkeypatch.setattr(GitHub, "comments", lambda self, issue: [])
    assert operations.tick(installation) == []
    monkeypatch.setattr(GitHub, "writable", lambda self, user: False)
    with pytest.raises(ValueError, match="no longer"):
        operations.tick(installation)


def test_missing_home_requires_fresh_original_archive(
    installation: Installation,
) -> None:
    claim = existing(installation, 1)
    home = installation.delivery_dir(claim.id) / "native"
    with pytest.raises(ValueError, match="expired"):
        operations.restore_missing_home(installation, claim, home)
    source = installation.root / "source"
    rollout(source, "parent")
    rollout(source, "child", "parent", "/root/owner")
    key = Fernet.generate_key()
    (installation.root / "archive.key").write_bytes(key)
    archive.save(source, installation.delivery_dir(claim.id) / "session.enc", key)
    claim.saved_at = time.time()
    claim.question_comment = 123
    installation.save(claim)
    restored = operations.recover(installation, claim.id, "parent", "/root/owner")
    assert restored.status == "question"
    assert (home / "auth.json").is_symlink()
