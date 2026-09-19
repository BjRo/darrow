import time
from uuid import uuid4

import pytest

from darrow_artificer.admission import admit
from darrow_artificer.github import GitHub
from darrow_artificer.installation import Installation
from darrow_artificer.models import Claim


class Forge(GitHub):
    def __init__(self) -> None:
        super().__init__("unused", "owner/repo")
        self.ready = [1, 2, 3, 4, 5]
        self.claimed: list[int] = []
        self.reservations: list[int] = []
        self.blocked: list[int] = []
        self.unauthorized: list[int] = []
        self.fail = False

    def issues(self, label: str, state: str) -> list[dict[str, object]]:
        numbers = self.ready if label == "artificer:ready" else self.claimed
        return [{"number": number} for number in numbers]

    def nominated(self, issue: int) -> bool:
        return issue not in self.unauthorized

    def unblocked(self, issue: int) -> bool:
        return issue not in self.blocked

    def reserve(self, issue: int, correlation: str) -> None:
        self.reservations.append(issue)
        self.claimed.append(issue)
        if self.fail:
            raise OSError("ambiguous label write")
        self.ready.remove(issue)


def existing(site: Installation, issue: int) -> Claim:
    claim = Claim(
        id=str(uuid4()),
        issue=issue,
        activation="old",
        grant=site.grant.id,
        worktree="/unused",
        branch="old",
        status="question",
        created_at=time.time(),
    )
    site.save(claim)
    return claim


@pytest.mark.parametrize(
    ("wip", "starts", "expected"), [(5, 1, 1), (5, 3, 3), (2, 3, 0), (0, 3, 0)]
)
def test_claims_and_launches(
    installation: Installation, wip: int, starts: int, expected: int
) -> None:
    grant = installation.grant
    grant.WORK_IN_PROGRESS_LIMIT = wip
    grant.MAX_STARTS_PER_ACTIVATION = starts
    installation.save_grant(grant)
    existing(installation, 10)
    existing(installation, 11)
    forge = Forge()
    forge.claimed = [10, 11]
    launches: list[int] = []

    def launch(site: Installation, claim: Claim) -> None:
        assert site.claim(claim.id).issue == claim.issue
        assert claim.issue in forge.claimed
        assert claim.issue not in forge.ready
        launches.append(claim.issue)

    admit(installation, forge, "activation", launch)
    assert launches == list(range(1, expected + 1))
    assert forge.reservations == launches


@pytest.mark.parametrize("failure", ["reservation", "launch"])
def test_ambiguous_effect_consumes_allowance(
    installation: Installation, failure: str
) -> None:
    forge = Forge()
    forge.fail = failure == "reservation"

    def launch(site: Installation, claim: Claim) -> None:
        raise OSError("launch response lost")

    admit(installation, forge, "activation", launch)
    assert forge.reservations == [1]
    (claim,) = installation.claims()
    assert claim.issue == 1 and claim.status == "needs-attention"
    # No missing label or subsequent tick recovers the ambiguous reservation.
    forge.claimed.clear()
    admit(installation, forge, "later", launch)
    assert forge.reservations == [1]


def test_only_eligible_scope(installation: Installation) -> None:
    grant = installation.grant
    grant.WORK_IN_PROGRESS_LIMIT = 5
    grant.MAX_STARTS_PER_ACTIVATION = 5
    grant.issue_scope = [1, 2, 3, 4]
    installation.save_grant(grant)
    forge = Forge()
    forge.blocked = [1, 2]
    forge.unauthorized = [3]
    admit(installation, forge, "activation", lambda site, claim: None)
    assert forge.reservations == [4]


def test_external_claims_hold_capacity(installation: Installation) -> None:
    forge = Forge()
    forge.claimed = [999]
    admit(installation, forge, "activation", lambda site, claim: None)
    assert not forge.reservations
